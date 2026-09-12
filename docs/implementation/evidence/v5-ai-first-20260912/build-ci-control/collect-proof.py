"""Retain a bounded public proof receipt; raw artifact stays outside Git."""
import hashlib
import json
import pathlib
import subprocess

run_id = '34720452622'
artifact_id = '10305788557'
expected_digest = '6375fa76a1f0e6ca30f2c0d9a1ec7001fdf9880450f0c48abe7b8792c60d7b93'
raw = pathlib.Path('C:/Users/user/AppData/Local/Temp/uskoci-v5-proof-run'+run_id)
archive = raw / ('artifact-'+artifact_id+'.zip')
with archive.open('wb') as output:
    subprocess.run(['gh','api',f'repos/Uskoci1/USKOCI-CLEAN/actions/artifacts/{artifact_id}/zip'],stdout=output,check=True)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert digest == expected_digest
receipt = json.loads((raw/'package-integration-receipt.json').read_text())
summary = {key:receipt.get(key) for key in ['sourceCommit','sourceTree','runId','finalHistoryCount','result','liveChanged','providerProven','deviceProven']}
summary['controlCommit']='af0910cd82a85586c4172475c85bab129835bc8e'
source = receipt['sourceRegression']
summary['sourceRegression']={key:source.get(key) for key in ['regressionScope','result','gates','jest','node','nodeFiles']}
report_keys=['unit','result','sourceSha','historyCount','actualAuth','actualDatabase','actualClient','actualClientAuthority','providerCalled','liveAccess','deviceProven']
summary['reports']={name:{**{key:report.get(key) for key in report_keys},
                         'checks':[{key:check[key] for key in ['name','result']} for check in report.get('checks',[])]}
                    for name,report in receipt['reports'].items()}
summary['failure']='Final publication proof expects published.authoritative=true, but the canonical publish RPC return contract contains no authoritative property. Original proof failure is undefined !== true after two completed checks.'
summary['failureClassification']='SOURCE_CONTRACT_ASSERTION_MISMATCH_PENDING_ROOT_REPAIR_AND_REPLAY'
summary['artifact']={'id':artifact_id,'sha256':digest,'independentlyDownloadedAndDigestVerified':True,'rawDirectory':str(raw)}
summary['rawReceiptSha256']=hashlib.sha256((raw/'package-integration-receipt.json').read_bytes()).hexdigest()
out = pathlib.Path(__file__).resolve().parent / ('run'+run_id+'-summary.json')
out.write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'runId':run_id,'result':summary['result'],'artifactSha256Verified':True,'summary':str(out)}))
