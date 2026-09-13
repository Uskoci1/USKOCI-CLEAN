"""Bind the actual Hermes composed map to a fully attested Metro input map.

No external source prefix is accepted. Normalized names are admitted only by
one-to-one correspondence to the exact packager inputs and byte reproduction
using the installed, lock-bound React Native / Metro composer.
"""
import hashlib
import argparse
import json
import pathlib
import shutil
import subprocess
import tempfile
from verify_android_source_map import REQUIRED, REQUIRED_ASSETS, REFERENCE_DATA, require, sha, git_blob_id, verify_source_map

PACKAGER = 'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map'
COMPILER = 'android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.compiler.map'
COMPOSED = 'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map'


def source_arrays(document):
    require(document.get('version') == 3 and document.get('sourceRoot') in (None, ''), 'INVALID_COMPOSED_MAP_HEADER')
    names, contents = document.get('sources'), document.get('sourcesContent')
    require(isinstance(names, list) and isinstance(contents, list) and len(names) == len(contents), 'COMPOSED_ARRAY_LENGTH_MISMATCH')
    require(all(isinstance(name, str) for name in names) and all(isinstance(content, str) for content in contents), 'COMPOSED_MISSING_SOURCE_CONTENT')
    require(len(set(names)) == len(names), 'COMPOSED_DUPLICATE_NAME')
    return names, contents


def bind_composed_sources(packager, composed, normalized_names):
    names, contents = source_arrays(packager)
    final_names, final_contents = source_arrays(composed)
    require(isinstance(normalized_names, list) and len(normalized_names) == len(names)
            and all(isinstance(name, str) for name in normalized_names), 'NORMALIZATION_ARRAY_MISMATCH')
    require(len(set(normalized_names)) == len(normalized_names), 'NORMALIZED_SOURCE_COLLISION')
    bindings = {normalized: (name, content) for normalized, name, content in zip(normalized_names, names, contents)}
    result = []
    for name, content in zip(final_names, final_contents):
        require(name in bindings, 'UNBOUND_COMPOSED_SOURCE: ' + name)
        original, expected = bindings[name]
        require(content == expected, 'COMPOSED_SOURCE_CONTENT_DRIFT: ' + name)
        result.append({'name': name, 'attestedOriginalName': original,
                       'rawSourceContentUtf8Sha256': sha(content.encode('utf8'))})
    return result


NODE_METADATA = r'''
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const [script, packagerPath, output] = process.argv.slice(2);
const fromRN = createRequire(script);
const metroEntry = fromRN.resolve('metro-source-map');
const fromMetro = createRequire(metroEntry);
const utilPath = fromMetro.resolve('source-map/lib/util');
const normalize = fromMetro('source-map/lib/util').normalize;
const packages = ['react-native', 'metro-source-map', 'metro-symbolicate', 'source-map'].map(name => {
  const file = (name === 'react-native' ? fromRN : fromMetro).resolve(name + '/package.json');
  const bytes = fs.readFileSync(file);
  return { name, packageJsonPath: file, version: JSON.parse(bytes).version,
    packageJsonSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
const codeFiles = [script, path.join(path.dirname(metroEntry), 'composeSourceMaps.js'), utilPath];
const code = codeFiles.map(file => ({file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const packager = JSON.parse(fs.readFileSync(packagerPath, 'utf8'));
fs.writeFileSync(output, JSON.stringify({ packages, code, normalizedNames: packager.sources.map(normalize) }));
'''


def verify_composed_source_map(repository, source, shared_vendor=None):
    repository = pathlib.Path(repository).resolve()
    packager_path, compiler_path, composed_path = [repository / relative for relative in (PACKAGER, COMPILER, COMPOSED)]
    for path in (packager_path, compiler_path, composed_path):
        require(path.resolve() == path and path.is_file(), 'MAP_INPUT_REALPATH_ESCAPE_OR_MISSING')
    # The original names and their physical roots pass the unchanged strict
    # Git/asset/generator/vendor verifier before any normalization is considered.
    attested = verify_source_map(repository, source, packager_path, shared_vendor)
    raw_inputs = {relative: (repository / relative).read_bytes() for relative in (PACKAGER, COMPILER, COMPOSED)}
    require(sha(raw_inputs[PACKAGER]) == attested['rawMapSha256'], 'PACKAGER_CHANGED_AFTER_ATTESTATION')
    packager, compiler, composed = [json.loads(raw_inputs[relative]) for relative in (PACKAGER, COMPILER, COMPOSED)]
    source_arrays(packager); source_arrays(composed)
    require(compiler.get('version') == 3 and isinstance(compiler.get('mappings'), str), 'INVALID_HERMES_COMPILER_MAP')
    dependency_root = (repository / 'node_modules').resolve()
    script = (dependency_root / 'react-native/scripts/compose-source-maps.js').resolve()
    require(script.is_relative_to(dependency_root) and script.is_file(), 'COMPOSER_OUTSIDE_DEPENDENCY_ROOT')
    lock_raw = subprocess.check_output(['git', '-C', str(repository), 'show', source + ':package-lock.json'])
    lock = json.loads(lock_raw)
    parent = (repository / 'android/build').resolve()
    scratch = pathlib.Path(tempfile.mkdtemp(prefix='attest-composed-', dir=parent)).resolve()
    require(scratch.is_relative_to(parent), 'INVALID_COMPOSITION_SCRATCH')
    try:
        metadata_script = scratch / 'metadata.cjs'
        metadata_script.write_text(NODE_METADATA, encoding='utf8')
        metadata_path = scratch / 'metadata.json'
        subprocess.run(['node', str(metadata_script), str(script), str(packager_path), str(metadata_path)],
                       check=True, capture_output=True, timeout=30)
        metadata = json.loads(metadata_path.read_bytes())
        for package in metadata['packages']:
            path = pathlib.Path(package['packageJsonPath']).resolve()
            require(path.is_relative_to(dependency_root), 'COMPOSER_PACKAGE_OUTSIDE_LOCKED_ROOT')
            key = 'node_modules/' + path.parent.relative_to(dependency_root).as_posix()
            pin = lock.get('packages', {}).get(key, {})
            require(pin.get('version') == package['version'] and isinstance(pin.get('integrity'), str), 'COMPOSER_PACKAGE_LOCK_MISMATCH')
            package['lockEntry'] = key
            package['lockedIntegrity'] = pin['integrity']
        for code in metadata['code']:
            require(pathlib.Path(code['file']).resolve().is_relative_to(dependency_root), 'COMPOSER_CODE_ROOT_MISMATCH')
        expected_path = scratch / 'composed.map'
        subprocess.run(['node', str(script), str(packager_path), str(compiler_path), '-o', str(expected_path)],
                       cwd=repository, check=True, capture_output=True, timeout=60)
        reproduced = expected_path.read_bytes()
        require(reproduced == raw_inputs[COMPOSED], 'COMPOSED_REPRODUCTION_MISMATCH')
        for package in metadata['packages']:
            require(sha(pathlib.Path(package['packageJsonPath']).read_bytes()) == package['packageJsonSha256'], 'COMPOSER_PACKAGE_CHANGED')
        for code in metadata['code']:
            require(sha(pathlib.Path(code['file']).read_bytes()) == code['sha256'], 'COMPOSER_CODE_CHANGED')
        for relative, raw in raw_inputs.items():
            require((repository / relative).read_bytes() == raw, 'MAP_INPUT_CHANGED_DURING_COMPOSITION')
        bindings = bind_composed_sources(packager, composed, metadata['normalizedNames'])
        originals = {item['attestedOriginalName'] for item in bindings}
        require({'/' + name for name in REQUIRED | REQUIRED_ASSETS | {REFERENCE_DATA}} <= originals,
                'COMPOSED_REQUIRED_FIRST_PARTY_MISSING')
        require(sum(name.startswith('/src/app?ctx=') for name in originals) == 1, 'COMPOSED_REQUIRED_ROUTER_CONTEXT_MISSING')
    finally:
        require(scratch.resolve().is_relative_to(parent) and scratch.name.startswith('attest-composed-'), 'UNSAFE_COMPOSITION_CLEANUP')
        shutil.rmtree(scratch)
    return {'result': 'PASS', 'sourceCommit': source, 'mapPath': str(composed_path),
            'rawMapSha256': sha(raw_inputs[COMPOSED]), 'rawInputSha256': {name: sha(raw) for name, raw in raw_inputs.items()},
            'reproduction': 'Exact raw bytes from installed lock-bound RN composeSourceMaps(packager, Hermes compiler).',
            'gitLockBlobOid': git_blob_id(lock_raw), 'installedComposerPackages': metadata['packages'],
            'installedComposerCode': metadata['code'], 'normalizationHelperSha256': sha(NODE_METADATA.encode('utf8')),
            'packagerAttestation': attested, 'sourceBindings': bindings,
            'sourceComparison': 'Composed sourcesContent is exactly equal to its uniquely bound original packager source; original root and Git checks remain mandatory.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--shared-vendor')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = verify_composed_source_map(args.repository, args.source, args.shared_vendor)
    pathlib.Path(args.output).write_text(json.dumps(result, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'result': result['result'], 'sourceCommit': result['sourceCommit'],
                      'rawMapSha256': result['rawMapSha256'], 'boundSources': len(result['sourceBindings'])}))
