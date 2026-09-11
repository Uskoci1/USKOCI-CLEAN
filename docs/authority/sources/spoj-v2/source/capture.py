from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys,re,time
ROOT=Path(__file__).resolve().parent/'input'
OUT=Path(__file__).resolve().parent.parent
CAT=json.loads((OUT/'contracts/SCREEN_CATALOG_66.json').read_text())
BASE=OUT/'input/BASE_LINEAGE_V1.html'
METRICS="""() => {const p=document.querySelector('#phone'),c=p.querySelector('#content');const pb=p.getBoundingClientRect();return {key:state.screen,actor:state.person,ui:state.ui,text:p.innerText,controls:[...p.querySelectorAll('button,input,select,textarea')].map(e=>({tag:e.tagName,action:e.dataset.act||'',label:e.getAttribute('aria-label')||e.textContent?.trim()||e.getAttribute('placeholder')||'',disabled:e.disabled,box:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}})),icons:[...p.querySelectorAll('svg.ico')].map(e=>({name:e.dataset.icon||'unidentified',stroke:e.getAttribute('stroke-width')})),illustrations:p.querySelectorAll('.state-art,.l-art').length,empty:p.querySelectorAll('.empty,.core-empty,.l-empty').length,horizontalOverflow:p.scrollWidth>p.clientWidth+1||(c&&c.scrollWidth>c.clientWidth+1),overflowElements:[...p.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&(b.right>pb.right+1||b.left<pb.left-1)&&getComputedStyle(e).position!=='absolute'&&!e.closest('svg')}).slice(0,12).map(e=>e.tagName+'.'+e.className)}}"""
def load(b,html,width=390,height=844,large=False):
 page=b.new_page(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load')
 page.evaluate("document.body.classList.add('phoneonly','capture'); state.reduced=true; if(typeof rStopIntro!=='undefined')rStopIntro(true);")
 page.add_style_tag(content='.exitpreview{display:none!important}')
 return page,errors

def jump(page,k):
 page.evaluate('(k)=>USKOCI_DEMO.jump(k)',k)
 page.wait_for_timeout(30)

if __name__=='__main__':
 which=sys.argv[1] if len(sys.argv)>1 else 'before'
 path=Path(sys.argv[2]) if len(sys.argv)>2 else BASE
 html=path.read_text()
 report=[]
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=__import__('os').environ.get('USKOCI_CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),args=['--no-sandbox'])
  for i,meta in enumerate(CAT):
   page,errors=load(b,html)
   try:
    jump(page,meta['key'])
    frame=f"renders/{which}/{i+1:02d}_{meta['key']}.png"
    page.locator('#phone').screenshot(path=str(OUT/frame))
    data=page.evaluate(METRICS);data.update(meta=meta,frame=frame,errors=errors);report.append(data)
   except Exception as e:report.append({'key':meta['key'],'errors':errors+[str(e)],'meta':meta})
   finally:page.close()
   if (i+1)%12==0:print(which,i+1,flush=True)
  b.close()
 (OUT/'evidence'/f'{which}_66.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('DONE',len(report),'errors',[(x['key'],x['errors']) for x in report if x['errors']],flush=True)
