"""Repin an unchanged approved disposable test plan to one saved source commit."""
import argparse
import base64
import json
import pathlib
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--previous-control', required=True)
parser.add_argument('--history-count', type=int, choices=(127, 129, 131, 134, 136, 138, 139, 140, 141, 143, 144, 145, 146, 147), default=127)
args = parser.parse_args()
assert all(re.fullmatch('[a-f0-9]{40}', value) for value in (args.source, args.previous_control))
repo = 'repos/Uskoci1/USKOCI-CLEAN'
branch = 'work/pre-v3-proof-runner-20260911'


def api(path, body=None, method=None):
    command = ['gh', 'api', path]
    if method:
        command += ['--method', method]
    if body is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


assert api(f'{repo}/git/ref/heads/{branch}')['object']['sha'] == args.previous_control
assert api(f'{repo}/git/ref/heads/work/pre-v3-engine-integration-20260911')['object']['sha'] == args.source
source = api(f'{repo}/git/commits/{args.source}')
config_file = api(f'{repo}/contents/.pre-v3/run.json?ref={args.previous_control}')
config = json.loads(base64.b64decode(config_file['content']))
assert config['sourceSha'] != args.source
assert config['regressionScope'] == 'FULL' and not config['focusedJest']
assert config['finalHistoryCount'] == args.history_count and len(config['proofs']) == args.history_count - 116
assert all(config[key] is False for key in ('applyP12OpenAIPrimary', 'alignP12ProviderTests', 'exportSource'))
assert all(config[key] is True for key in ('noLiveWrite', 'noProvider', 'noDevice'))
previous_source = config['sourceSha']
config.update(sourceSha=args.source, sourceTree=source['tree']['sha'])
result = api(f'{repo}/contents/.pre-v3/run.json', {
    'message': f'test(v5): repin unchanged disposable{args.history_count} plan to saved regression fixes',
    'content': base64.b64encode((json.dumps(config, indent=2) + '\n').encode()).decode(),
    'sha': config_file['sha'], 'branch': branch,
}, 'PUT')
receipt = {'previousControlCommit': args.previous_control, 'controlCommit': result['commit']['sha'],
           'previousSourceCommit': previous_source, 'sourceCommit': args.source, 'sourceTree': source['tree']['sha'],
           'changedFiles': ['.pre-v3/run.json'], 'testPlanUnchanged': True, 'expectedHistoryCount': args.history_count,
           'fullRegression': True, 'expectedSqlReports': args.history_count - 110, 'sourceCorrectionFlags': False,
           'noLiveWrite': True, 'noProvider': True, 'noDevice': True, 'automaticPushTrigger': True}
out = pathlib.Path(__file__).resolve().parent / ('repin-' + args.source[:12] + '-receipt.json')
out.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(receipt))
