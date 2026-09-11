from capture import *
import subprocess,json,math
cases=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=__import__('os').environ.get('USKOCI_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 for w in [320,360,390]:
  p,e=load(b,(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text(),w);jump(p,'entry')
  for t in [0,80,400,650,1120,1500,1630,1920,2690,3000,3500,4100,4380]:
   d=p.evaluate('''(t)=>{rIntroFrame(t);const n=rIntroNodes(),p=n.root.getBoundingClientRect(),l=n.svg.getBoundingClientRect();return {time:t,phone:{x:p.x,y:p.y,width:p.width,height:p.height},logo:{x:l.x,y:l.y,width:l.width,height:l.height},mark:n.mark.getAttribute('transform'),parts:[...n.svg.querySelectorAll('[data-r-part]')].map(x=>({opacity:Number(x.getAttribute('opacity')),transform:x.getAttribute('transform')})),clip:Number(n.svg.querySelector('[data-r-word-reveal]').getAttribute('width'))}}''',t)
   cases.append(d)
  p.close()
 b.close()
(OUT/'motion/html-reference-frames.json').write_text(json.dumps(cases,indent=2))
