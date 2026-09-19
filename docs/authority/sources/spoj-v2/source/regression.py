from pathlib import Path
from playwright.sync_api import sync_playwright
from capture import load,jump,OUT,BASE
import json,hashlib
from bs4 import BeautifulSoup
HTML=(OUT/'prototype/USKOCI_SPOJ_V2.html').read_text();REPORT=[]
def check(name,ok,detail=None):
 REPORT.append({'name':name,'passed':bool(ok),'detail':detail});(OUT/'evidence/regression.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));print(('PASS ' if ok else 'FAIL ')+name,flush=True)
def shot(page,name):
 file=f'renders/states/{name}.png';page.locator('#phone').screenshot(path=str(OUT/file));return file
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=__import__('os').environ.get('USKOCI_CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),args=['--no-sandbox'])
 p,errors=load(b,HTML)
 # Recovery parity across actual render paths, no invented event.
 jump(p,'inbox');a=p.locator('.l-art').get_attribute('data-art-kind');t=p.locator('#content').inner_text()
 n=p.evaluate('state.events.length');p.evaluate("state.ui='empty';render(false)")
 check('Inbox natural/forced empty uses same art and content',a=='inbox' and p.locator('.l-art').get_attribute('data-art-kind')==a and p.locator('#content').inner_text()==t)
 check('Empty preview does not create events',p.evaluate('state.events.length')==n)
 shot(p,'inbox_empty');p.evaluate("state.ui='normal';state.mode='w';render(false)");jump(p,'applications')
 nav=p.locator('#phone .nav').inner_text()
 check('Worker navigation retains three canonical destinations','Prijave' in nav and 'Zadaci' in nav and 'Dogovori' in nav,nav);shot(p,'applications_worker_empty')
 # Concrete events: same recipient reads, foreign event remains unread, real deep-link fixture.
 p.evaluate("""state.person='jelena';state.mode='r';state.events.push(
 {id:'audit-j',recipient:'jelena',type:'MESSAGE',title:'Nova poruka',body:'Stižem u dogovorenom terminu.',target:'chat',entityId:'fixture-paket',read:false},
 {id:'audit-m',recipient:'marko',type:'MESSAGE',title:'Samo za Marka',body:'Privatan demo događaj.',target:'chat',entityId:'fixture-paket',read:false});""")
 jump(p,'inbox');shot(p,'inbox_unread');check('Inbox isolates recipient','Samo za Marka' not in p.locator('#phone').inner_text())
 p.locator('[data-act="event:audit-j"]').click();check('Inbox opens exact Agreement chat',p.evaluate("state.screen==='chat'&&state.agreementId==='fixture-paket'"));p.locator('[data-act="back"]').first.click();check('Back returns to Inbox',p.evaluate("state.screen==='inbox'"))
 p.evaluate("act('read-inbox')");check('Mark-read leaves other account unread',p.evaluate("state.events.find(x=>x.id==='audit-m').read===false"))
 p.locator('[data-act="core-inbox-tab:unread"]').click();check('Unread empty has show-all route',p.locator('[data-act="core-inbox-tab:all"]').count()>=2);shot(p,'inbox_all_read')
 check('Recovered icons have specific geometry',p.evaluate("I('bike')!==I('info')&&I('car')!==I('info')&&I('trailer').includes('circle')"))
 p.close()
 # True click journey through exact selection, message and completion; fixtures only.
 p,errors=load(b,HTML);jump(p,'candidate');before=p.evaluate('state.agreements.length');selected=p.evaluate("({person:offer().person,slots:offer().slots,price:offer().priceRsd,taskId:offer().taskId})")
 p.locator('[data-act="go:payment"]').click();check('Fee shown separately as zero','0 RSD' in p.locator('#phone').inner_text());shot(p,'payment_exact_offer')
 p.locator('[data-act="select-offer"]').click()
 try:p.wait_for_function(f'state.agreements.length>{before}',timeout=3500)
 except Exception:pass
 data=p.evaluate("({count:state.agreements.length,screen:state.screen,agreement:agreement(),error:state.formError})")
 check('Exact selection creates one CONFIRMED local Agreement',data['count']==before+1 and data['agreement']['status']=='CONFIRMED',data.get('error'))
 if data['count']==before+1:
  a=data['agreement'];aid=a['id'];check('Accepted price and offered scope survive selection',a['priceRsd']==selected['price'] and a['slots']==selected['slots'] and a['worker']==selected['person'])
  # Repeating same command must not create second Agreement.
  p.evaluate("act('select-offer')");p.wait_for_timeout(500);check('Repeated selection does not duplicate Agreement',p.evaluate('state.agreements.length')==before+1)
  p.evaluate("state.screen='agreement';render(false)");shot(p,'agreement_after_selection')
  original=p.evaluate("agreement().snapshot.title");p.evaluate("tasks.find(t=>t.id===agreement().taskId).title='IZMENJEN RODITELJSKI ZADATAK';render(false)")
  check('Agreement display uses accepted snapshot',original in p.locator('#phone').inner_text() and 'IZMENJEN RODITELJSKI ZADATAK' not in p.locator('#phone').inner_text())
  p.evaluate("go('chat')");inp=p.locator('[data-bind="chatText"]');inp.fill('Vidimo se u dogovorenom terminu.');p.locator('[data-act="send-chat"]').click();p.wait_for_timeout(550)
  check('Message is stored against this Agreement',p.evaluate("state.messages.some(m=>m.text==='Vidimo se u dogovorenom terminu.'&&m.agreementId===state.agreementId&&m.status==='sent')"));shot(p,'chat_sent')
  p.evaluate(f"changePerson('{selected['person']}');state.mode='w';act('agreement:{aid}');go('chat')")
  check('Counterpart sees same Agreement message','Vidimo se u dogovorenom terminu.' in p.locator('#phone').inner_text());shot(p,'chat_counterpart')
  p.evaluate("go('complete');act('mark-complete')");check('Worker completion waits for requester',p.evaluate("agreement().status==='AWAITING_REQUESTER'"))
  p.evaluate(f"changePerson('jelena');state.mode='r';act('agreement:{aid}');go('complete')");p.locator('[data-act="confirm-complete"]').click();check('Requester confirms completion',p.evaluate("agreement().status==='COMPLETED'"))
  p.evaluate("go('review-write')");check('Review starts without a preselected score',p.evaluate('state.rating===0'));shot(p,'review_eligible_unselected')
  p.locator('[data-act="core-rate:5"]').click();p.locator('[data-act="core-send-review"]').click();p.wait_for_function("state.reviews.some(r=>r.by==='jelena'&&r.rating===5)",timeout=3000)
  check('Review remains local and not automatically public',p.evaluate("state.reviews.some(r=>r.by==='jelena'&&r.agreementId===state.agreementId&&r.rating===5&&r.publicVisible!==true)"))
 check('Selection journey has no JavaScript errors',not errors,errors);p.close()
 # Same message attempt after unknown outcome, no new ID.
 p,errors=load(b,HTML);jump(p,'chat');p.evaluate('state.simulateMessageUnknown=true');p.locator('[data-bind="chatText"]').fill('Poruka sa nepoznatim ishodom');p.locator('[data-act="send-chat"]').click();p.wait_for_timeout(550)
 msg=p.evaluate('state.messages.at(-1)');count=p.evaluate('state.messages.length');shot(p,'chat_unknown')
 p.locator(f'[data-act="retry-message:{msg["id"]}"]').click();check('Unknown message retries same ID without duplication',p.evaluate(f'state.messages.length==={count}&&state.messages.at(-1).id==={json.dumps(msg["id"])}&&state.messages.at(-1).status==="sent"'));p.close()
 # Large collections use existing synthetic seeder, not production pagination.
 for kind in ['tasks','applications','agreements']:
  p,errors=load(b,HTML);p.evaluate(f"cSeed('{kind}')");row=p.evaluate(f"cCollectionRows('{kind}')")
  check(f'{kind}: 600 rows, at most 25 rendered',row['total']==600 and len(row['visible'])==25 and p.locator('.co').count()==25,{'total':row['total'],'visible':len(row['visible']),'pages':row['pages']})
  inp=p.locator(f'[data-core-search="{kind}"]');inp.fill('NEPOSTOJEĆI_POJAM_123');p.wait_for_timeout(220)
  check(f'{kind}: no results retains query and controls',p.locator(f'[data-core-search="{kind}"]').input_value()=='NEPOSTOJEĆI_POJAM_123' and p.locator('[data-empty-kind="search"]').count()==1);shot(p,kind+'_no_results')
  p.locator(f'[data-act="core-reset:{kind}"]').click();check(f'{kind}: reset restores all 600, no deletion',p.evaluate(f"cCollectionRows('{kind}').count===600"))
  p.evaluate(f"act('core-page:{kind}:1')");first=p.evaluate(f"cCollectionRows('{kind}').visible[0].id");shot(p,kind+'_600_page2')
  if kind=='tasks':
   p.locator('.co-main').first.click();p.locator('[data-act="back"]').first.click();check('Collection Back preserves page 2 and context',p.evaluate("state.screen==='tasks'&&cCollection('tasks').page===1"))
  check(f'{kind}: large collection no errors',not errors,errors);p.close()
 # Availability and urgency are not conflated, negative capabilities stay disabled.
 p,errors=load(b,HTML);jump(p,'urgent');buttons=p.locator('#phone button').all();check('HITNO activation remains disabled',any(x.is_disabled() and 'Aktivacija' in x.inner_text() for x in buttons));shot(p,'urgent_gated')
 jump(p,'worker');p.evaluate('act("now")');
 if p.locator('[data-act="now-on"]').count():p.locator('[data-act="now-on"]').click()
 active=p.evaluate('state.now');p.evaluate("go('calendar');go('worker')");check('Availability ON survives navigation without becoming HITNO',active and p.evaluate('state.now'))
 jump(p,'ai');sig=p.evaluate('JSON.stringify(state.editor)');p.evaluate("state.ui='offline';render(false)");shot(p,'ai_offline');check('Offline state retains existing editor data',p.evaluate('JSON.stringify(state.editor)')==sig)
 check('Offline write guard remains fail-closed',p.evaluate('!hasWrite()'));p.close()
 # Baseline intro final frame and preserved source authority, without adapter claims.
 old,eo=load(b,BASE.read_text());new,en=load(b,HTML);jump(old,'entry');jump(new,'entry')
 ba=old.locator('#phone').screenshot();bb=new.locator('#phone').screenshot()
 check('Locked intro final rendered frame is byte-identical',ba==bb,{'before_sha256':hashlib.sha256(ba).hexdigest(),'after_sha256':hashlib.sha256(bb).hexdigest()})
 (OUT/'renders/states/intro_locked_before.png').write_bytes(ba);(OUT/'renders/states/intro_locked_after.png').write_bytes(bb)
 sa=BeautifulSoup(BASE.read_text(),'html.parser');sb=BeautifulSoup(HTML,'html.parser')
 check('First two baseline script blocks remain byte-identical',all(sa.find_all('script')[i].get_text()==sb.find_all('script')[i].get_text() for i in [0,1]))
 check('Original intro CSS blocks remain byte-identical',all(sa.find_all('style')[i].get_text()==sb.find_all('style')[i].get_text() for i in [0,1]))
 old.close();new.close();b.close()
(OUT/'evidence/regression.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
print('TOTAL',len(REPORT),'PASS',sum(x['passed'] for x in REPORT),'FAIL',[x['name'] for x in REPORT if not x['passed']])
