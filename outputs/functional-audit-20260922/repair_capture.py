import pathlib, json, base64, hashlib
root = pathlib.Path(__file__).resolve().parents[2]
docs = root / 'docs/implementation/functional-audit-20260922'
path = docs / 'AGREEMENT_PROFILE_LIVE.json'
old = json.loads(path.read_text(encoding='utf-8-sig'))
fresh = json.loads((docs/'AGREEMENT_PROFILE_READBACK_BASE64.json').read_text(encoding='utf-8-sig'))
result = []
corrections = []
for row in fresh:
    body = base64.b64decode(row['body_utf8_base64']).decode('utf-8')
    assert hashlib.md5(body.encode('utf-8')).hexdigest() == row['md5']
    prior = next(x for x in old if x['name']==row['name'])
    corrections.append({'name':row['name'],'previousRecordedMd5':prior['md5'],'verifiedReadbackMd5':row['md5'],'sameBody':body==prior['body']})
    result.append({k:v for k,v in row.items() if k!='body_utf8_base64'} | {'body':body})
assert all(x['sameBody'] for x in corrections), 'Semantic re-read required'
path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(docs/'CAPTURE_CORRECTION.json').write_text(json.dumps(corrections,indent=2)+'\n',encoding='utf-8')
print(json.dumps(corrections))
