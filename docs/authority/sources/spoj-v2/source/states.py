from capture import *
from playwright.sync_api import sync_playwright
import json
HTML=(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text();report=[]
chosen={'inbox','tasks','applications','agreements','ai','chat','calendar','reviews','candidate','payment','voice','permissions','vehicle','task','apply','candidates','discovery','map'}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=__import__('os').environ.get('USKOCI_CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),args=['--no-sandbox'])
 for meta in CAT:
  p,errors=load(b,HTML);jump(p,meta['key']);states=p.evaluate("stateOptions(state.screen).map(x=>x[0])")
  for ui in states:
   if ui=='normal':continue
   p.evaluate('(s)=>{state.ui=s;render(false)}',ui)
   data=p.evaluate(METRICS);data['errors']=errors.copy()
   if meta['key'] in chosen and ui in ['empty','loading','offline','stale','unknown','error','permission']:
    file=f'renders/states/{meta["key"]}_{ui}_inspector.png';p.locator('#phone').screenshot(path=str(OUT/file));data['frame']=file
   report.append(data)
  p.close()
 b.close()
(OUT/'evidence/states_390.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('STATES',len(report),'errors',[(x['key'],x['ui'],x['errors']) for x in report if x['errors']]);print('OVERFLOW',[(x['key'],x['ui']) for x in report if x['horizontalOverflow']])
