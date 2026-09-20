from capture import *
from bs4 import BeautifulSoup
import hashlib,re
manifest=[]
def save_svg(path,xml,source):
 s=BeautifulSoup(xml,'xml');root=s.find('svg')
 if not root:return
 root['xmlns']='http://www.w3.org/2000/svg'
 if 'class' in root.attrs:del root['class']
 text=str(root);path.write_text(text)
 manifest.append({'path':str(path.relative_to(OUT)),'sha256':hashlib.sha256(text.encode()).hexdigest(),'viewBox':root.get('viewBox'),'source':source,'external_dependencies':False})
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=__import__('os').environ.get('USKOCI_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);p,e=load(b,(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text());jump(p,'entry'); names=sorted(set(re.findall(r"I\('([a-zA-Z0-9_-]+)'\)",(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text()))); p.evaluate('(n)=>window.v2ExportIconNames=n',names)
 data=p.evaluate("()=>({brand:R_BRAND,parts:R_PARTS,icons:Object.fromEntries([...new Set([...Object.keys(V13_ICONS),...window.v2ExportIconNames])].map(k=>[k,I(k)])),motifs:V2_MOTIFS,empty:Object.fromEntries(['inbox','tasks','applications','agreements','search','map','chat','calendar','reviews'].map(k=>[k,lArt(k)])),introDuration:R.intro.duration,assetNames:Object.keys(ASSETS)})")
 save_svg(OUT/'assets/brand/uskoci-lockup.svg',data['brand'],'R_BRAND: unchanged original paths')
 doc=BeautifulSoup(data['brand'],'xml');mark=doc.select_one('[data-r-mark]');mark.attrs.pop('transform',None)
 save_svg(OUT/'assets/brand/uskoci-mark.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 291">'+str(mark)+'</svg>','R_BRAND[data-r-mark]: original local geometry')
 for k,xml in data['icons'].items():save_svg(OUT/f'assets/icons/{k}.svg',xml,'I('+k+'): V1/lineage icon registry')
 for k,xml in data['motifs'].items():
  xml=xml.replace('<svg ','<svg fill="none" stroke="#FFFFFF" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" ')
  save_svg(OUT/f'assets/brand/intent-{k}.svg',xml,'V2 contextual vector overlay, not a new mascot')
 for k,xml in data['empty'].items():save_svg(OUT/f'assets/empty/{k}.svg',xml,'Existing lArt/vignette preserved from lineage')
 (OUT/'motion/original-parts.json').write_text(json.dumps(data['parts'],indent=2))
 # Preserve the exact original HTML timeline, as evidence/reference, not native code.
 (OUT/'motion/original-rIntroFrame.js').write_text(p.evaluate('rIntroFrame.toString()'))
 (OUT/'motion/geometry.json').write_text(json.dumps({'durationMs':data['introDuration'],'lockupViewBox':[39,174,320,104],'markViewBox':[0,0,280,291],'markFinalTransform':{'x':42.806,'y':175.496,'scale':.34},'parts':data['parts']},indent=2))
 print('ASSETS',len(manifest),'JS errors',e)
 b.close()
(OUT/'assets/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
