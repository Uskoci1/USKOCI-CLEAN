from capture import *
HTML=(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text()
mode=__import__('sys').argv[1]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=__import__('os').environ.get('USKOCI_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 reports=[]
 for i,meta in enumerate(CAT):
  width=320 if mode=='320_large' else int(mode) if mode.isnumeric() else 390
  if mode=='before' and (OUT/f'renders/before/{i+1:02d}_{meta["key"]}.png').exists():continue
  p,errors=load(b,BASE.read_text() if mode=='before' else HTML,width)
  if mode=='320_large':p.evaluate('state.large=true')
  jump(p,meta['key'])
  if mode=='states':
   for ui in p.evaluate('stateOptions(state.screen).map(x=>x[0])'):
    if ui=='normal':continue
    p.evaluate('(s)=>{state.ui=s;render(false)}',ui);d=p.evaluate(METRICS);d['errors']=errors.copy();reports.append(d)
  elif mode=='before':p.locator('#phone').screenshot(path=str(OUT/f'renders/before/{i+1:02d}_{meta["key"]}.png'))
  else:
   d=p.evaluate(METRICS);d['errors']=errors;d['width']=width;reports.append(d)
  p.close()
  name='states_390' if mode=='states' else 'responsive_'+mode
  if reports:(OUT/f'evidence/{name}.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
  if i%15==0:print(mode,i,len(reports),flush=True)
 b.close()
print('DONE',mode,len(reports),'overflow',[(d['key'],d['ui']) for d in reports if d['horizontalOverflow']],'errors',[(d['key'],d['errors']) for d in reports if d['errors']],flush=True)
