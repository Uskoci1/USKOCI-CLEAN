"""Fail-closed public configuration and packaged-secret checks; never echo values."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

REF = 'leqcwgzvjsxugfgzdmth'
URL = f'https://{REF}.supabase.co'
RECOVERY = 'uskociapp://oporavak'
PUBLIC_NAMES = frozenset({'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
                          'EXPO_PUBLIC_USE_FAKE_SOURCE', 'EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL'})

def require(condition, code):
    if not condition:
        raise ValueError(code)

def jwt_payload(value):
    parts = value.split('.')
    require(len(parts) == 3 and all(re.fullmatch('[A-Za-z0-9_-]+', p) for p in parts), 'PUBLIC_JWT_FORM_INVALID')
    try:
        return json.loads(base64.urlsafe_b64decode(parts[1] + '=' * (-len(parts[1]) % 4)))
    except Exception:
        raise ValueError('PUBLIC_JWT_PAYLOAD_INVALID') from None

def parse_public_config(text, *, add_recovery=False):
    result = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        require('=' in line, 'CONFIG_LINE_INVALID')
        key, value = line.split('=', 1)
        require(key in PUBLIC_NAMES and key not in result, 'CONFIG_NAME_OR_DUPLICATE_INVALID')
        value = value.strip()
        if value[:1] in ('"', "'"):
            require(len(value) >= 2 and value[-1] == value[0], 'CONFIG_QUOTE_INVALID')
            value = value[1:-1]
        require('\n' not in value and '\r' not in value and '${' not in value, 'CONFIG_VALUE_INVALID')
        result[key] = value
    if add_recovery:
        result.setdefault('EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL', RECOVERY)
    require(set(result) == PUBLIC_NAMES, 'EXACT_FOUR_PUBLIC_CONFIGS_REQUIRED')
    require(result['EXPO_PUBLIC_SUPABASE_URL'] == URL, 'CANONICAL_DEV_TARGET_REQUIRED')
    require(result['EXPO_PUBLIC_USE_FAKE_SOURCE'] == '0', 'FAKE_SOURCE_MUST_BE_OFF')
    require(result['EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL'] == RECOVERY, 'EXACT_NATIVE_RECOVERY_REQUIRED')
    # Preserve the already reviewed legacy public key family. Switching key type
    # requires a separate verified project binding, not a loose prefix check.
    payload = jwt_payload(result['EXPO_PUBLIC_SUPABASE_ANON_KEY'])
    require(payload.get('role') == 'anon' and payload.get('ref') == REF, 'CANONICAL_ANON_JWT_REQUIRED')
    return result

def scan_values(values, public_key, firebase_keys):
    roles = []
    jwt_re = re.compile(r'(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![A-Za-z0-9_-])')
    for value in values:
        for token in jwt_re.findall(value):
            p = jwt_payload(token)
            require(token == public_key and p.get('role') == 'anon' and p.get('ref') == REF, 'UNEXPECTED_PACKAGED_JWT')
            roles.append({'role': p['role'], 'ref': p['ref']})
        require(not re.search(r'(?<![A-Za-z0-9_-])sb_secret_[A-Za-z0-9_-]{12,}', value), 'PACKAGED_SUPABASE_SECRET')
        require(not re.search(r'(?<![A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{24,}', value), 'PACKAGED_PROVIDER_SECRET')
        require(not re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END ', value), 'PACKAGED_PRIVATE_KEY')
        for token in re.findall(r'AIza[A-Za-z0-9_-]{20,}', value):
            require(token in firebase_keys, 'UNREVIEWED_GOOGLE_API_KEY')
    return roles

def assert_recovery_function(blocks):
    require(len(blocks) == 1, 'EXACT_RECOVERY_FUNCTION_REQUIRED')
    body = blocks[0]
    require(RECOVERY in body, 'RECOVERY_REDIRECT_NOT_COMPILED')
    require('EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL' not in body, 'RECOVERY_ENV_LEFT_FOR_RUNTIME')
    require(not re.search(r'Function<configuredRecoveryRedirect>[^\n]*\n\s+LoadConstNull\s+r0\s*\n\s+Ret\s+r0\s*$', body), 'RECOVERY_COMPILED_DISABLED')

def read_hermes(executable, bundle, public_key, firebase_keys):
    # Hermes storage concatenates/overlaps strings. Scan decoded table entries,
    # never raw adjacent bytes that can join SDK prefixes or icon names into keys.
    process = subprocess.Popen([str(executable), '-dump-bytecode', '-b', str(bundle)], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, encoding='utf8', errors='strict')
    string_count = None
    seen = set()
    roles = []
    current = None
    recovery_blocks = []
    try:
        for line in process.stdout:
            count = re.fullmatch(r'\s+String count: (\d+)\s*', line)
            if count:
                string_count = int(count[1])
            match = re.fullmatch(r'([is])(\d+)\[(?:ASCII|UTF-16), (\d+)\.\.(-?\d+)\](?: #[0-9A-Fa-f]+)?: (.*)\n?', line)
            if match:
                key = int(match[2])
                start, end, value = int(match[3]), int(match[4]), match[5]
                require(end >= start or (start == 0 and end == -1 and value == ''), 'HERMES_STRING_RANGE_INVALID')
                require(key not in seen, 'DUPLICATE_HERMES_STRING_ID')
                seen.add(key)
                roles.extend(scan_values([value], public_key, firebase_keys))
            if line.startswith('Function<'):
                if current is not None:
                    recovery_blocks.append(''.join(current))
                current = [] if line.startswith('Function<configuredRecoveryRedirect>') else None
            if current is not None:
                current.append(line)
        if current is not None:
            recovery_blocks.append(''.join(current))
        require(process.wait(timeout=30) == 0, 'HERMES_DUMP_FAILED')
    except Exception:
        process.kill()
        process.wait()
        raise
    require(string_count is not None and seen == set(range(string_count)), 'HERMES_STRING_TABLE_INCOMPLETE')
    assert_recovery_function(recovery_blocks)
    require(len(roles) >= 1, 'CANONICAL_ANON_JWT_NOT_PACKAGED')
    return {'stringCount': string_count, 'decodedStringEntriesScanned': len(seen),
            'recoveryCompiledEnabled': True, 'recoveryFunctionSha256': hashlib.sha256(recovery_blocks[0].encode()).hexdigest(),
            'packagedJwtRoles': roles, 'disassemblerSha256': hashlib.sha256(Path(executable).read_bytes()).hexdigest()}

def attest_final_apk_configuration(snapshot, apk, receipt):
    snapshot = Path(snapshot)
    config = parse_public_config((snapshot / '.env.local').read_text(encoding='utf8'))
    require(receipt['publicBuildConfigNames'] == sorted(PUBLIC_NAMES), 'RECEIPT_PUBLIC_CONFIG_NAMES_MISMATCH')
    firebase = json.loads((snapshot / 'config/firebase/google-services.json').read_text(encoding='utf8'))
    firebase_keys = {v['current_key'] for c in firebase['client'] for v in c['api_key']}
    require(len(firebase_keys) == 1 and firebase['project_info']['project_id'] == 'uskoci-ed59b', 'FIREBASE_PUBLIC_KEY_BINDING_INVALID')
    bundle = snapshot / 'android/app/build/generated/assets/react/release/index.android.bundle'
    compiler = snapshot / 'node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe'
    evidence = read_hermes(compiler, bundle, config['EXPO_PUBLIC_SUPABASE_ANON_KEY'], firebase_keys)
    with zipfile.ZipFile(apk) as archive:
        require(archive.read('assets/index.android.bundle') == bundle.read_bytes(), 'PACKAGED_HERMES_BYTES_MISMATCH')
        expo = json.loads(archive.read('assets/app.config'))
        require(expo['scheme'] == 'uskociapp' and expo['android']['package'] == 'rs.uskoci.preview', 'PACKAGED_DEEPLINK_IDENTITY_MISMATCH')
        for item in archive.infolist():
            if item.is_dir() or item.filename == 'assets/index.android.bundle':
                continue
            raw = archive.read(item)
            scan_values([raw.decode('utf8', errors='ignore'), raw.decode('utf-16-le', errors='ignore')], config['EXPO_PUBLIC_SUPABASE_ANON_KEY'], firebase_keys)
    evidence.update(canonicalProjectRef=REF,publicConfigNames=sorted(PUBLIC_NAMES),fakeSource=False,
                    recoveryRedirect=RECOVERY,backendRedirectAllowlistVerified=False,
                    confirmationSiteUrlVerified=False,authJourneyProven=False,
                    providerSecretsFound=False,nativeAndAssetEntriesScanned=True)
    return evidence
