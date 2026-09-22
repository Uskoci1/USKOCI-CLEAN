from pathlib import Path
import json,re,hashlib
from inspect_references import SOURCES

root=Path(__file__).resolve().parent
report={}
for version,path in SOURCES.items():
    text=path.read_text(encoding='utf-8-sig')
    styles=re.findall(r'<style([^>]*)>([\s\S]*?)</style>',text,re.I)
    scripts=re.findall(r'<script([^>]*)>([\s\S]*?)</script>',text,re.I)
    assets=json.JSONDecoder().raw_decode(text.split('const V24_ASSETS=',1)[1])[0]
    report[version]={
      'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'styleBlocks':[{'id':re.search(r'id=[\"\']([^\"\']+)',attrs).group(1) if re.search(r'id=[\"\']([^\"\']+)',attrs) else '(base)','bytes':len(body.encode()),'sha256':hashlib.sha256(body.encode()).hexdigest()} for attrs,body in styles],
      'scriptBlocks':len(scripts),
      'embeddedAnimations':{name:{'bytes':len(json.dumps(data).encode()),'frames':data.get('op'),'fps':data.get('fr'),'externalAssetCount':len(data.get('assets',[]))} for name,data in assets.items()},
      'bodyLines':{name:[i+1 for i,line in enumerate(text.splitlines()) if marker in line] for name,marker in {'card':'function refinedTaskFace','v24Card':'refinedTaskFace=function(t,opts={})','v31Metrics':'function metrics(t,price=taskPrice(t)','v31Public':'function publicFace(t){const apps=appCount(t)','v31Home':'v14HomeTask=function(t,scope){const own=scope','price':'function taskPrice(t)','libraryLoader':'function v24LoadLibraries','v31Style':'id="uskoci-v31-balanced-premium"'}.items()}
    }
old=report['V28']['styleBlocks']
report['comparison']={'unchangedStyleBlocksInSameOrder':sum(a['sha256']==b['sha256'] for a,b in zip(old,report['V31']['styleBlocks'])),'newStyleBlocks':[x['id'] for x in report['V31']['styleBlocks'][len(old):]]}
(root/'evidence.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report['comparison'],ensure_ascii=False,indent=2))
