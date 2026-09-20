import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
from capture import load,jump,METRICS,CAT,OUT
width=int(sys.argv[1]);large=len(sys.argv)>2 and sys.argv[2]=='large';html=(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text()
chosen={'inbox','tasks','applications','agreements','vehicle','calendar','ai','task','candidate','agreement','chat','settings','notifications','map','filters','changes','task-time','apply','reviews','public','qa','support','voice','entry'}
report=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=__import__('os').environ.get('USKOCI_CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),args=['--no-sandbox'])
 for n,meta in enumerate(CAT):
  page,errors=load(b,html,width,844)
  try:
   if large:page.evaluate('state.large=true')
   jump(page,meta['key']);data=page.evaluate(METRICS)
   # Distinguish intentional clipped horizontal scrollers from page overflow.
   data['clippedText']=page.evaluate("""()=>[...document.querySelectorAll('#phone button,#phone h1,#phone h2,#phone label,#phone p')].filter(e=>{const s=getComputedStyle(e);return (s.overflowX==='hidden'||s.overflow==='hidden')&&e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&!e.closest('.core-tabs')&&!e.closest('.weekstrip')}).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,120)}))""")
   data['errors']=errors;data['width']=width;data['largeText']=large
   if meta['key'] in chosen:
    file=f"renders/responsive/{width}{'_large' if large else ''}_{meta['key']}.png";page.locator('#phone').screenshot(path=str(OUT/file));data['frame']=file
   report.append(data)
  except Exception as e:report.append({'key':meta['key'],'errors':errors+[str(e)],'width':width,'largeText':large})
  page.close()
 b.close()
path=OUT/f"evidence/responsive_{width}{'_large' if large else ''}.json";path.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(path.name,len(report),'errors',[(r['key'],r['errors']) for r in report if r.get('errors')]);print('overflow',[(r['key'],r['overflowElements']) for r in report if r.get('horizontalOverflow')]);print('clipping',[(r['key'],r['clippedText']) for r in report if r.get('clippedText')])
