"""Read ONLY the synthetic account+Agreement outbox row on the disposable emulator.

No database download, key enumeration, session/Auth read, UI bypass or write.
The installed AsyncStorage3.1.1 legacy default uses AsyncStorage/Storage(key,value).
If the emulator lacks a root-readable sqlite3 shell, return an explicit limitation.
"""
import json
import re
import shlex
import subprocess

PACKAGE = 'rs.uskoci.n04proof'
DATABASE = f'/data/user/0/{PACKAGE}/databases/AsyncStorage'


def scoped_query(account_id, agreement_id):
    for value in (account_id, agreement_id):
        if not isinstance(value, str) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', value):
            raise ValueError('Outbox observer requires exact synthetic UUIDs')
    key = f'uskoci:agreement-outbox:v1:{account_id}:{agreement_id}'
    return f"SELECT value FROM Storage WHERE key='{key}' LIMIT 1;"


def read_scoped_outbox(account_id, agreement_id, package=PACKAGE):
    if package != PACKAGE:
        raise ValueError('Outbox observer is restricted to the disposable APK')
    query = scoped_query(account_id, agreement_id)
    # Fixed device binary/path; quote the one validated SELECT as one shell arg.
    command = ' '.join(shlex.quote(value) for value in ('su', '0', '/system/bin/sqlite3', '-readonly', DATABASE, query))
    try:
        emulator = subprocess.run(['adb', 'exec-out', 'getprop ro.kernel.qemu'], capture_output=True, text=True, timeout=10)
        if emulator.returncode != 0 or emulator.stdout.strip() != '1':
            return None
        result = subprocess.run(['adb', 'exec-out', command], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        value = json.loads(result.stdout)
        if value.get('version') != 1 or value.get('accountId') != account_id or value.get('agreementId') != agreement_id:
            raise ValueError('Observed outbox ownership differs')
        if not isinstance(value.get('entries'), list):
            raise ValueError('Observed outbox shape differs')
        for entry in value['entries']:
            command = entry.get('command', {})
            if command.get('accountId') != account_id or command.get('agreementId') != agreement_id:
                raise ValueError('Observed outbox command ownership differs')
        return value
    except (json.JSONDecodeError, AttributeError, TypeError):
        return None
