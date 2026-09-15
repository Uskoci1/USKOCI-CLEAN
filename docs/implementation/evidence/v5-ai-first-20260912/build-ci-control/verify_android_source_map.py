"""Fail-closed attestation of an actual Metro/Hermes map against saved Git source.

Artifact hashes cover raw bytes. JS source equivalence uses UTF-8 with CRLF
normalized to LF, matching Git text semantics on this Windows checkout.
"""
import argparse
import hashlib
import io
import json
import pathlib
import re
import shutil
import subprocess
import tarfile
import tempfile

REQUIRED = frozenset([
    'index.js', 'src/app/auth.tsx', 'src/ui/entry/EntryWelcome.tsx',
    'src/ui/entry/entryV49Math.ts', 'src/ui/entry/entryV49Notes.ts',
])
REQUIRED_ASSETS = frozenset([
    'assets/brand/entry-v49/requester.webp', 'assets/brand/entry-v49/worker.jpg',
])
ORIGINAL_ASSET_DIR = 'assets/brand/entry-v49'
ORIGINAL_PORTRAITS = {
    'requester.webp': ('0b995b273406eac9ba85b722ceafe506a235783400047c1765a8317c063b5631', 'image/webp', 'image/webp'),
    'worker.jpg': ('c25266122c8c47f96994c6cff05f9e5e5b7428de4a9d78521eb6f4084612d3d3', 'image/jpeg', 'image/png'),
}
RUNTIME = frozenset([
    '__prelude__', '\0polyfill:external-require', '\0polyfill:environment-variables',
    '\0polyfill:assets-registry',
])
VENDOR = 'vendor/decode-uri-component-compat'
REFERENCE_DATA = 'src/ui/referenceEntry/entryReferenceData.ts'
REFERENCE_GENERATOR = 'scripts/sync-entry-reference-assets.cjs'
REFERENCE_DONOR = 'docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html'
REFERENCE_OUTPUTS = (
    REFERENCE_DATA, 'assets/generated/uskoci-entry-city.webp', 'assets/generated/uskoci-rounded.ttf',
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def git_blob_id(content):
    return hashlib.sha1(b'blob ' + str(len(content)).encode('ascii') + b'\0' + content).hexdigest()


def sha(content):
    return hashlib.sha256(content).hexdigest()


def verify_original_portraits(repository, objects):
    """The filenames and actual formats must match the unchanged owner bytes."""
    relative = ORIGINAL_ASSET_DIR + '/provenance.json'
    require(relative in objects, 'MISSING_ORIGINAL_PROVENANCE')
    physical = (repository / relative).resolve()
    require(physical == repository / relative, 'ORIGINAL_PROVENANCE_REALPATH_ESCAPE')
    require(physical.read_bytes().replace(b'\r\n', b'\n') == objects[relative].replace(b'\r\n', b'\n'),
            'ORIGINAL_PROVENANCE_DRIFT')
    document = json.loads(objects[relative])
    require(document.get('sourceBytes') == 2241863 and document.get('sourceSha256') ==
            'e272a5bf81971765d871bdf8ad9e16a02b9a731bec835477f0cda09415f2dcdc', 'OWNER_V49_SOURCE_PIN_MISMATCH')
    records = document.get('assets')
    require(isinstance(records, list) and len(records) == 4 and all(isinstance(item, dict) for item in records),
            'INVALID_ORIGINAL_ASSET_RECORDS')
    require(len({item.get('name') for item in records}) == 4, 'DUPLICATE_ORIGINAL_ASSET_RECORD')
    by_name = {item['name']: item for item in records}
    evidence = []
    for name, (digest, mime, declared_mime) in ORIGINAL_PORTRAITS.items():
        relative = ORIGINAL_ASSET_DIR + '/' + name
        require(name in by_name and relative in objects, 'MISSING_ORIGINAL_ASSET_PIN: ' + name)
        record, saved = by_name[name], objects[relative]
        require(record.get('sha256') == digest and sha(saved) == digest and record.get('bytes') == len(saved),
                'ORIGINAL_ASSET_HASH_MISMATCH: ' + name)
        actual_format = ('image/webp' if saved[:4] == b'RIFF' and saved[8:12] == b'WEBP' else
                         'image/jpeg' if saved[:3] == b'\xff\xd8\xff' and saved[-2:] == b'\xff\xd9' else None)
        require(actual_format == mime and record.get('mime') == mime and record.get('sourceDeclaredMime') == declared_mime,
                'ORIGINAL_ASSET_MIME_EXTENSION_MISMATCH: ' + name)
        physical = (repository / relative).resolve()
        require(physical == repository / relative and physical.read_bytes() == saved,
                'ORIGINAL_ASSET_PHYSICAL_DRIFT: ' + name)
        evidence.append({'path': relative, 'gitBlobOid': git_blob_id(saved), 'rawAssetSha256': digest,
                         'bytes': len(saved), 'mime': mime, 'sourceDeclaredMime': declared_mime,
                         'magicHex': saved[:16].hex()})
    return {'gitProvenanceBlobOid': git_blob_id(objects[ORIGINAL_ASSET_DIR + '/provenance.json']),
            'portraits': evidence}


def regenerate_reference(repository, objects):
    """Execute only this named saved generator/donor in an owned disposable dir."""
    pins = {}
    for relative in (REFERENCE_GENERATOR, REFERENCE_DONOR):
        require(relative in objects, 'MISSING_REFERENCE_GIT_INPUT: ' + relative)
        physical = (repository / relative).resolve()
        require(physical == repository / relative, 'REFERENCE_INPUT_REALPATH_ESCAPE')
        require(physical.read_bytes().replace(b'\r\n', b'\n') ==
                objects[relative].replace(b'\r\n', b'\n'), 'REFERENCE_INPUT_DRIFT: ' + relative)
        pins[relative] = {'gitBlobOid': git_blob_id(objects[relative]), 'rawGitSha256': sha(objects[relative])}
    parent = (repository / 'android/build').resolve()
    require(parent.is_dir() and parent.is_relative_to(repository), 'INVALID_REFERENCE_SCRATCH_PARENT')
    scratch = pathlib.Path(tempfile.mkdtemp(prefix='attest-reference-', dir=parent)).resolve()
    require(scratch.is_relative_to(parent) and scratch.name.startswith('attest-reference-'), 'UNSAFE_REFERENCE_SCRATCH')
    try:
        for relative in (REFERENCE_GENERATOR, REFERENCE_DONOR):
            target = scratch / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(objects[relative])
        subprocess.run(['node', str(scratch / REFERENCE_GENERATOR)], cwd=scratch, check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        actual_files = {path.relative_to(scratch).as_posix() for path in scratch.rglob('*') if path.is_file()}
        require(actual_files == set(REFERENCE_OUTPUTS) | {REFERENCE_GENERATOR, REFERENCE_DONOR},
                'UNEXPECTED_REFERENCE_GENERATOR_OUTPUT')
        expected = {relative: (scratch / relative).read_bytes() for relative in REFERENCE_OUTPUTS}
    finally:
        # Verify the exact exclusively-created target before recursive cleanup.
        require(scratch.resolve().is_relative_to(parent) and scratch.name.startswith('attest-reference-'),
                'UNSAFE_REFERENCE_CLEANUP')
        shutil.rmtree(scratch)
    return expected, {'inputs': pins, 'generatorExit': 0,
                      'outputs': {relative: {'rawRegeneratedSha256': sha(content)} for relative, content in expected.items()}}


def verify_source_map(repository, source, map_file, shared_vendor=None):
    repository = pathlib.Path(repository).resolve()
    map_file = pathlib.Path(map_file).resolve()
    require(re.fullmatch('[0-9a-f]{40}', source), 'INVALID_SOURCE_COMMIT')
    head = subprocess.check_output(['git', '-C', str(repository), 'rev-parse', 'HEAD']).decode().strip()
    require(head == source, 'SNAPSHOT_HEAD_MISMATCH')
    status = subprocess.check_output(['git', '-C', str(repository), 'status', '--porcelain']).decode().strip()
    require(not status, 'SNAPSHOT_DIRTY')
    require(map_file.is_relative_to(repository), 'SOURCE_MAP_OUTSIDE_SNAPSHOT')
    raw_tar = subprocess.check_output([
        'git', '-C', str(repository), 'archive', '--format=tar', source,
        'src', 'index.js', 'vendor', 'package.json', 'package-lock.json', REFERENCE_GENERATOR, REFERENCE_DONOR,
        ORIGINAL_ASSET_DIR,
    ])
    with tarfile.open(fileobj=io.BytesIO(raw_tar)) as archive:
        objects = {member.name: archive.extractfile(member).read()
                   for member in archive.getmembers() if member.isfile()}
    generated_expected, generator_evidence = regenerate_reference(repository, objects)
    original_evidence = verify_original_portraits(repository, objects)
    dependencies = (repository / 'node_modules').resolve()
    require(dependencies.is_dir(), 'MISSING_DEPENDENCY_ROOT')
    vendor_root = pathlib.Path(shared_vendor).resolve() if shared_vendor else None
    vendor_binding = None
    if vendor_root is not None:
        package = json.loads(objects['package.json'])
        lock = json.loads(objects['package-lock.json'])
        require(package.get('dependencies', {}).get('decode-uri-component') == 'file:' + VENDOR,
                'VENDOR_PACKAGE_BINDING_MISMATCH')
        require(lock.get('packages', {}).get('node_modules/decode-uri-component') ==
                {'resolved': VENDOR, 'link': True}, 'VENDOR_LOCK_BINDING_MISMATCH')
        require((dependencies / 'decode-uri-component').resolve() == vendor_root,
                'VENDOR_REALPATH_BINDING_MISMATCH')
        require(vendor_root.name == 'decode-uri-component-compat', 'VENDOR_NAME_MISMATCH')
        vendor_binding = {
            'package': 'decode-uri-component', 'declared': 'file:' + VENDOR,
            'resolvedRealPath': str(vendor_root), 'gitPackageBlob': git_blob_id(objects['package.json']),
            'gitLockBlob': git_blob_id(objects['package-lock.json']),
        }
    raw_map = map_file.read_bytes()
    document = json.loads(raw_map)
    require(document.get('version') == 3, 'SOURCE_MAP_VERSION')
    require(document.get('sourceRoot') in (None, ''), 'UNEXPECTED_SOURCE_ROOT')
    names, contents = document.get('sources'), document.get('sourcesContent')
    require(isinstance(names, list) and isinstance(contents, list), 'MISSING_SOURCE_ARRAYS')
    require(len(names) == len(contents), 'SOURCE_CONTENT_LENGTH_MISMATCH')
    require(all(isinstance(name, str) for name in names), 'INVALID_SOURCE_NAME')
    require(len(set(names)) == len(names), 'DUPLICATE_SOURCE_NAME')
    require(all(isinstance(content, str) for content in contents), 'MISSING_SOURCE_CONTENT')
    verified, vendor_sources, assets, contexts, runtimes, generated_sources = [], [], [], [], [], []
    dependency_count = 0
    canonical_files = set()
    for name, content in zip(names, contents):
        require('\\' not in name, 'NON_CANONICAL_SOURCE_SEPARATOR: ' + name)
        if name in RUNTIME:
            runtimes.append({'name': name, 'rawUtf8SourceSha256': sha(content.encode('utf-8'))})
            continue
        require(name.startswith('/') and '\0' not in name, 'UNKNOWN_RUNTIME_SOURCE: ' + name)
        require(not name.startswith('//'), 'NETWORK_SOURCE_PATH: ' + name)
        physical = (repository / name[1:].split('?', 1)[0]).resolve()
        if '/node_modules/' in name:
            require('?' not in name and physical.is_relative_to(dependencies) and physical.is_file(),
                    'DEPENDENCY_SOURCE_OUTSIDE_LOCKED_ROOT: ' + name)
            dependency_count += 1
            continue
        if re.fullmatch(r'/src/app\?ctx=[0-9a-f]{40}', name):
            require(physical == repository / 'src/app', 'ROUTER_CONTEXT_ROOT_MISMATCH')
            contexts.append({'name': name, 'rawUtf8SourceSha256': sha(content.encode('utf-8'))})
            continue
        require('?' not in name, 'UNKNOWN_GENERATED_SOURCE: ' + name)
        if '/src/' in name or name == '/index.js':
            require(name.startswith('/src/') or name == '/index.js',
                    'REJECTED_MIXED_ROUTER_SOURCE: ' + name)
            relative = name[1:]
            require(physical == repository / relative and physical.is_relative_to(repository),
                    'FIRST_PARTY_REALPATH_ESCAPE: ' + name)
            target = verified
        elif '/assets/' in name:
            require(name.startswith('/assets/') and physical.is_relative_to(repository / 'assets')
                    and physical.is_file(), 'EXTERNAL_OR_MISSING_APP_ASSET: ' + name)
            asset_bytes = physical.read_bytes()
            if name[1:] in generated_expected:
                require(asset_bytes == generated_expected[name[1:]], 'GENERATED_ASSET_DRIFT: ' + name)
            assets.append({'path': name[1:], 'physicalPath': str(physical),
                           'rawAssetSha256': sha(asset_bytes),
                           'generatedModuleUtf8Sha256': sha(content.encode('utf-8'))})
            continue
        elif vendor_root is not None and physical.is_relative_to(vendor_root):
            require('/vendor/' in name and physical == vendor_root / 'index.cjs',
                    'UNAPPROVED_VENDOR_MODULE: ' + name)
            relative = VENDOR + '/index.cjs'
            target = vendor_sources
        else:
            raise ValueError('UNKNOWN_NON_DEPENDENCY_SOURCE: ' + name)
        if relative == REFERENCE_DATA:
            require(relative not in canonical_files, 'DUPLICATE_CANONICAL_SOURCE: ' + relative)
            canonical_files.add(relative)
            normalized = content.encode('utf-8').replace(b'\r\n', b'\n')
            expected = generated_expected[relative].replace(b'\r\n', b'\n')
            require(normalized == expected, 'REJECTED_GENERATED_SOURCE_MISMATCH')
            require(physical.read_bytes().replace(b'\r\n', b'\n') == expected, 'PHYSICAL_GENERATED_SOURCE_MISMATCH')
            generated_sources.append({'path': relative, 'mapName': name, 'physicalPath': str(physical),
                'normalizedLfSha256': sha(normalized), 'rawMapContentUtf8Sha256': sha(content.encode('utf-8')),
                'derivation': 'Named saved Git generator and donor, regenerated in disposable directory; no generated Git blob is claimed.'})
            continue
        require(relative in objects and physical.is_file(), 'MISSING_GIT_SOURCE: ' + relative)
        require(relative not in canonical_files, 'DUPLICATE_CANONICAL_SOURCE: ' + relative)
        canonical_files.add(relative)
        expected_raw = objects[relative]
        normalized = content.encode('utf-8').replace(b'\r\n', b'\n')
        expected = expected_raw.replace(b'\r\n', b'\n')
        require(normalized == expected, 'REJECTED_GIT_SOURCE_MISMATCH: ' + relative)
        require(physical.read_bytes().replace(b'\r\n', b'\n') == expected,
                'PHYSICAL_SOURCE_MISMATCH: ' + relative)
        target.append({'path': relative, 'mapName': name, 'physicalPath': str(physical),
                       'gitBlobOid': git_blob_id(expected_raw), 'normalizedLfSha256': sha(normalized),
                       'rawMapContentUtf8Sha256': sha(content.encode('utf-8'))})
    require(REQUIRED <= {item['path'] for item in verified}, 'MISSING_REQUIRED_ENTRY_ROUTE_SOURCE')
    require(REQUIRED_ASSETS <= {item['path'] for item in assets}, 'MISSING_REQUIRED_ORIGINAL_ASSETS')
    require({REFERENCE_DATA} == {item['path'] for item in generated_sources}, 'MISSING_REQUIRED_GENERATED_REFERENCE')
    require(len(contexts) == 1, 'MISSING_OR_DUPLICATE_SNAPSHOT_ROUTER_CONTEXT')
    return {
        'result': 'PASS', 'sourceCommit': source, 'repository': str(repository),
        'mapPath': str(map_file), 'rawMapSha256': sha(raw_map),
        'sourceComparison': 'UTF-8; CRLF normalized to LF. Raw artifact SHA is separate.',
        'firstPartySources': verified, 'requiredAssets': sorted(REQUIRED_ASSETS),
        'appAssets': assets, 'routerContexts': contexts, 'runtimeWhitelist': runtimes,
        'dependencyRoot': str(dependencies), 'dependencySourceCount': dependency_count,
        'declaredVendorBinding': vendor_binding, 'gitVerifiedVendorSources': vendor_sources,
        'generatedSources': generated_sources, 'referenceGenerator': generator_evidence,
        'originalPortraits': original_evidence,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--map', required=True)
    parser.add_argument('--shared-vendor')
    parser.add_argument('--output')
    args = parser.parse_args()
    result = verify_source_map(args.repository, args.source, args.map, args.shared_vendor)
    if args.output:
        pathlib.Path(args.output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: result[key] for key in ['result', 'sourceCommit', 'rawMapSha256', 'dependencySourceCount']}))
