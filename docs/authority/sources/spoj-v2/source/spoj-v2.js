/* USKOČI SPOJ V2 — local presentation/interaction reference, NOT a backend.
 * Append-only continuation. Original mutations and receipt guards are reused.
 * No network requests, providers, credentials or production writes are added.
 */
const SPOJ_V2={version:'2.0',lastScreen:null,map:new Map(),exports:new Map(),pointer:null};
function v2MapState(){if(!SPOJ_V2.map.has(state.person))SPOJ_V2.map.set(state.person,{x:0,y:0,z:1,dirty:false,ids:null});return SPOJ_V2.map.get(state.person);}
function v2ExportState(){if(!SPOJ_V2.exports.has(state.person))SPOJ_V2.exports.set(state.person,{status:'idle',id:null});return SPOJ_V2.exports.get(state.person);}
const V2_MOTIFS={
 r:'<svg viewBox="0 0 300 150" aria-hidden="true"><circle cx="104" cy="37" r="12"/><path d="M76 118V79q0-19 20-19h16q20 0 20 19v11m-43-9v37m28-37v37m-28 0-7 22m35-22 7 22M133 89l25-12 13 5M177 26h51a9 9 0 0 1 9 9v55a9 9 0 0 1-9 9h-39l-17 12V35a9 9 0 0 1 5-9Zm8 23h39m-39 15h24m-24 15h32"/><path d="m148 33 4-8m-8 38-11-2m14-17-9-5"/></svg>',
 w:'<svg viewBox="0 0 300 150" aria-hidden="true"><circle cx="133" cy="28" r="12"/><path d="m118 52 26-5 17 24 33-9m-76-9-14 26-24 12m47-36-9 41 24 17 14 28m-38-45-26 18-19 27M190 91h48v45h-48zm0 0 24-13 24 13m-24-13v13M50 45h39M43 59h33M53 73h18"/><path d="m213 39 8 8 17-18"/></svg>'
};
const v2CancelPrev=cCancelChoice;
cCancelChoice=function(){v2CancelPrev();document.querySelector('.v2-intent-motif')?.remove();const b=document.querySelector('.entrychoices');if(b)b.inert=false;};
cChoose=function(mode){
 if(!['r','w'].includes(mode)||CORE.choice||state.screen!=='entry'||R.intro.playing&&!R.intro.done)return;
 rStopIntro(true);rCancelVoice();const actor=state.person,rev=state.accountRev;
 state.mode=mode;CORE.choice={mode,actor,rev};const p=$('#phone');p.classList.add('v2');
 const motif=document.createElement('div');motif.className='v2-intent-motif';motif.setAttribute('aria-hidden','true');motif.innerHTML=V2_MOTIFS[mode];p.querySelector('.entryscreen').append(motif);
 p.classList.add('choice-sweeping');p.dataset.choice=mode;
 const choices=p.querySelector('.entrychoices');if(choices)choices.inert=true;
 p.querySelector(`[data-act="intent:${mode}"]`)?.classList.add('selected-intent');
 CORE.choiceTimer=setTimeout(()=>{if(!CORE.choice)return;const valid=state.person===actor&&state.accountRev===rev&&state.screen==='entry';cCancelChoice();if(valid)go('auth');},rReduced()?0:760);
};
// Losing app visibility cancels an unfinished transition, rather than navigating
// into authentication unexpectedly when the user returns much later.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&CORE.choice){cCancelChoice();if(state.screen==='entry')render(false);}});
function v2Steps(labels,index){return `<ol class="v2-flowline" aria-label="Koraci">${labels.map((l,i)=>`<li class="${i===index?'current':i<index?'done':''}" ${i===index?'aria-current="step"':''}><b>${i+1}</b><span>${E(l)}</span></li>`).join('')}</ol>`;}
const v2OldApplication=dpApplicationForm;
dpApplicationForm=function(){let h=v2OldApplication();h=h.replace('<section class="dp-offer-hero">','<section class="dp-offer-hero">');h=h.replace('<div class="sticky">','<div class="sticky"><div class="v2-offer-total" role="status" aria-live="polite"></div>');return h;};
function v2OfferSummary(){if(state.screen!=='apply')return;const foot=$('#phone .sticky');if(!foot)return;let n=foot.querySelector('.v2-offer-total');if(!n){n=document.createElement('div');n.className='v2-offer-total';n.setAttribute('aria-live','polite');foot.prepend(n);}
 const p=Number($('#apPrice')?.value),s=Number($('#apSlots')?.value),valid=Number.isInteger(p)&&p>0&&Number.isInteger(s)&&s>0;
 n.innerHTML=valid?`<span>Tvoja ponuda<br><strong>${E(money(p))} RSD · ${s} ${s===1?'osoba':'osobe'}</strong></span><span>USKOČI povezivanje<br><strong>0 RSD</strong></span>`:'<span class="v2-invalid">Unesi cenu i broj ljudi za svoju ponudu.</span>';
}
// Accepted terms stay available, but stop occupying the conversation viewport.
dpChatView=function(){const a=agreement();if(!role(a))return full('Poruke',notice('Ovaj nalog nije učesnik Dogovora.','warn'));
 const t=a.snapshot||acceptedTask(),terminal=['COMPLETED','CANCELLED'].includes(a.status),proposal=state.proposals?.find(p=>p.agreementId===a.id&&p.status==='OPEN');
 const msgs=state.messages.filter(m=>m.agreementId===a.id||(!m.agreementId&&a.id==='fixture-paket'));
 const context=`<div class="v2-chat-context"><button class="v2-context-strip" data-act="v2-agreed-context" aria-label="Prikaži prihvaćene uslove Dogovora"><span class="v2-context-icon">${I(t.icon||'check')}</span><span class="grow"><strong>${E(t.title)}</strong><small>${E(money(a.priceRsd??t.priceRsd))} RSD · ${E(String(a.slots||1))} ${a.slots===1?'osoba':'osobe'} · Prihvaćeni uslovi</small></span>${I('chevron')===I('info')?I('arrow'):I('chevron')}</button>${seg([['Pregled','go:agreement','overview'],['Poruke','go:chat','chat']],'chat')}</div>`;
 return header('Poruke',person(dpPeer(a)).name)+context+sc(`${proposal?`<button class="dp-status warn" data-act="go:proposal"><span class="dp-status-icon">${I('clock')}</span><span class="grow"><strong>Predlog izmene čeka odluku</strong><p>Otvori predlog za ovaj Dogovor.</p></span>${I('arrow')}</button>`:''}<div class="dp-chat-day">Razgovor o ovom Dogovoru</div>${msgs.map(m=>{const st=m.status==='sending'?'Šalje se…':m.status==='unknown'?'Ishod nije poznat':m.status==='failed'?'Nije poslato':'Poslato';return `<div class="bubble ${m.sender===state.person?'mine':''}" data-message-id="${E(m.id||'fixture')}"><div class="sender">${E(person(m.sender).name)}</div>${E(m.text)}<div class="meta">${E(m.time||'')}<span class="dp-chat-state ${['failed','unknown'].includes(m.status)?'warn':''}">· ${st}</span></div>${['unknown','failed'].includes(m.status)&&m.sender===state.person?quiet(m.status==='unknown'?'Proveri isti pokušaj':'Pokušaj istu poruku ponovo','retry-message:'+m.id):''}</div>`;}).join('')||lEmpty('Ovde počinje dogovor.','Pišite jedno drugom o ovoj saradnji.','','','chat',true)}${terminal?fpHelp('Saradnja je završena. Istorija ostaje dostupna; novo pisanje ovde nije omogućeno.','warn'):''}`)+(terminal?'':composer(true)+keyboard());
};
// The export lifecycle is a local UX simulation, never a fabricated archive.
fpExport=function(){const s=v2ExportState(),pending=s.status==='requested';return full('Izvoz podataka',`${fpHero('Tvoja kopija','Tvoji podaci, na jednom mestu.','Zatraži kopiju podataka vezanih za svoj nalog.')}${pending?`<section class="v2-export-current"><span class="v2-status-pill">${I('clock')} Zahtev zabeležen lokalno</span><h2>Možeš da odustaneš.</h2><p>U ovoj simulaciji zahtev još nije prešao u stvarnu obradu. Otkazivanje menja samo ovaj demo zahtev.</p></section>`:s.status==='cancelled'?`<section class="v2-export-current"><span class="v2-status-pill">${I('check')} Zahtev otkazan</span><h2>Podaci nisu obrisani.</h2><p>Otkazan je samo zahtev za kopiju. Novi zahtev možeš da podneseš ponovo.</p></section>`:''}${fpPanel(`<div class="fp-status-steps"><div class="fp-status-step current"><span class="dot"></span><div><strong>Zahtev</strong><small>${pending?'Sačuvan u lokalnoj sesiji.':'Kopija samo tvojih podataka.'}</small></div></div><div class="fp-status-step"><span class="dot"></span><div><strong>Priprema kopije</strong><small>Stvarni server treba da potvrdi obradu.</small></div></div><div class="fp-status-step"><span class="dot"></span><div><strong>Preuzimanje</strong><small>Dostupno tek kada prava arhiva bude spremna.</small></div></div></div>`,'soft')}${fpHelp('Lokalni prototip: nema generisanja arhive, slanja imejla ili pristupa stvarnim podacima.')}`,pending?btn('Otkaži zahtev','v2-export-cancel','secondary',true):btn('Zatraži izvoz','request-export','primary',true));};
const v2FilteredPrev=filteredTasks;
filteredTasks=function(){const rows=v2FilteredPrev(),m=v2MapState();return m.ids&&['discovery','map'].includes(state.screen)?rows.filter(t=>m.ids.includes(t.id)):rows;};
const v2MapPrev=dpMapView;
dpMapView=function(){let h=v2MapPrev();const m=v2MapState();return h.replace('<main class="mapscene">',`<main class="mapscene" aria-label="Interaktivna šema zadataka"><div class="v2-map-gesture" aria-hidden="true"></div><div class="v2-map-zoom"><button data-act="v2-map-in" aria-label="Uvećaj mapu">+</button><button data-act="v2-map-out" aria-label="Umanji mapu">−</button><button data-act="v2-map-reset" aria-label="Vrati celu oblast">${I('refresh')}</button></div><button class="v2-map-search" data-act="v2-map-search" ${m.dirty?'':'hidden'}>${I('search')} Pretraži ovu oblast</button>`).replace('Šematski prototip ·','Interaktivna šema ·').replace(' · nije navigacija',' · bez stvarne kartografije');};
function v2ApplyMapTransform(){const m=v2MapState(),el=$('.v2-map-world');if(!el)return;el.style.setProperty('--map-x',m.x+'px');el.style.setProperty('--map-y',m.y+'px');el.style.setProperty('--map-z',m.z);const s=$('.v2-map-search');if(s)s.hidden=!m.dirty;}
function v2MountMap(){const scene=$('#phone .mapscene');if(!scene||scene.querySelector('.v2-map-world'))return;
 const world=document.createElement('div');world.className='v2-map-world';scene.querySelectorAll(':scope > .mapdrawing,:scope > .pin').forEach(n=>world.append(n));scene.insertBefore(world,scene.querySelector('.mapcontrols'));v2ApplyMapTransform();
 const gesture=scene.querySelector('.v2-map-gesture');const m=v2MapState();
 gesture.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();gesture.setPointerCapture(e.pointerId);SPOJ_V2.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,mx:m.x,my:m.y,actor:state.person};});
 gesture.addEventListener('pointermove',e=>{const p=SPOJ_V2.pointer;if(!p||p.id!==e.pointerId||p.actor!==state.person)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.hypot(dx,dy)<3)return;m.x=Math.max(-scene.clientWidth*2,Math.min(scene.clientWidth*2,p.mx+dx));m.y=Math.max(-scene.clientHeight*2,Math.min(scene.clientHeight*2,p.my+dy));m.dirty=true;v2ApplyMapTransform();});
 const stop=()=>{SPOJ_V2.pointer=null;};gesture.addEventListener('pointerup',stop);gesture.addEventListener('pointercancel',stop);
 gesture.addEventListener('wheel',e=>{e.preventDefault();m.z=Math.max(.7,Math.min(2.5,m.z+(e.deltaY<0?.15:-.15)));m.dirty=true;v2ApplyMapTransform();},{passive:false});
 const preview=scene.querySelector('.dp-map-sheet');if(preview&&!preview.querySelector('.v2-map-new-inline'))preview.insertAdjacentHTML('beforeend','<button class="v2-map-new-inline" data-act="new-from-map">'+I('plus')+' Objavi svoj zadatak</button>');
}
function v2SearchMap(){const el=$('#phone .mapscene');if(!el)return;const m=v2MapState(),w=el.clientWidth,h=el.clientHeight;const bounds={left:0,right:w,top:Math.min(120,h*.22),bottom:Math.max(h-28,h*.65)};
 m.ids=v2FilteredPrev().filter(t=>{const pt=facet(t).point;if(!t.coords||!pt)return false;const x=(pt[0]/100*w-w/2)*m.z+w/2+m.x,y=(pt[1]/100*h-h/2)*m.z+h/2+m.y;return x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom;}).map(t=>t.id);
 m.dirty=false;state.pinClosed=true;render(false);toast(`${m.ids.length} rezultata u ovoj demo oblasti. Lista koristi isti izbor.`);
}
const v2ActPrev=act;
act=function(a,el){
 if(a==='v2-agreed-context'){const d=agreement();return sheet('Prihvaćeni uslovi',cCard(d.snapshot||acceptedTask(),{agreement:d,source:'agreed',large:true,conditions:true,stateLabel:'Dogovor'})+fpHelp('Prikazan je obim ove konkretne saradnje, ne naknadno izmenjeni Zadatak.'),btn('Nazad na poruke','close-sheet','secondary'));}
 if(a==='request-export'){if(!hasWrite())return toast('Zahtev nije poslat. Pokušaj kada veza bude dostupna.');const s=v2ExportState();if(s.status==='requested')return;s.status='requested';s.id='local-export-'+state.person+'-'+Date.now();state.exportRequested=true;return render();}
 if(a==='v2-export-cancel')return sheet('Otkaži zahtev za kopiju?',`<p>Podaci i nalog ostaju netaknuti. Otkazuješ samo ovaj lokalni zahtev za izvoz.</p>`,btn('Otkaži zahtev','v2-export-confirm','secondary',true)+btn('Zadrži zahtev','close-sheet'));
 if(a==='v2-export-confirm'){if(!hasWrite())return toast('Otkazivanje nije potvrđeno. Proveri vezu.');const s=v2ExportState();if(s.status!=='requested')return closeSheet();s.status='cancelled';state.exportRequested=false;closeSheet();return render();}
 if(['v2-map-in','v2-map-out'].includes(a)){const m=v2MapState();m.z=Math.max(.7,Math.min(2.5,m.z+(a==='v2-map-in'?.25:-.25)));m.dirty=true;return v2ApplyMapTransform();}
 if(a==='v2-map-search')return v2SearchMap();
 if(a==='v2-map-reset'){Object.assign(v2MapState(),{x:0,y:0,z:1,dirty:false,ids:null});return render();}
 if(a==='clear-filters'||a==='core-reset'){Object.assign(v2MapState(),{x:0,y:0,z:1,dirty:false,ids:null});}
 return v2ActPrev(a,el);
};
function v2MountDisclosure(){if(state.screen!=='task-fields')return;const panels=[...document.querySelectorAll('#content .fp-panel')];const panel=panels.find(p=>/Privatna adresa/.test(p.textContent)&&p.querySelector('input'));
 if(!panel||panel.closest('details'))return;const details=document.createElement('details');details.className='v2-disclosure';details.dataset.v2Disclosure='private';details.open=!!state.v2PrivateOpen;details.innerHTML='<summary>'+I('shield')+' Privatni detalji lokacije</summary><div class="v2-disclosure-body"></div>';panel.replaceWith(details);details.lastElementChild.append(panel);details.addEventListener('toggle',()=>{state.v2PrivateOpen=details.open;});
}
function v2Keyboard(){const p=$('#phone');if(!p||!window.visualViewport)return;const vv=visualViewport,active=document.activeElement;const kb=window.innerHeight-vv.height>150&&!!active?.matches('input,textarea');p.classList.toggle('v2-real-keyboard',kb);p.style.setProperty('--v2-visible-height',vv.height+'px');}
if(window.visualViewport)visualViewport.addEventListener('resize',v2Keyboard);
document.addEventListener('input',e=>{if(e.target.matches('#apPrice,#apSlots'))v2OfferSummary();});
const v2RenderPrev=render;
render=function(preserve=true){const previous=SPOJ_V2.lastScreen;v2RenderPrev(preserve);const p=$('#phone');if(!p)return;p.classList.add('v2');p.classList.toggle('large-text',!!state.large);p.dataset.view=state.screen;
 const ver=document.querySelector('.version');if(ver)ver.textContent='SPOJ · V2';
 if(previous!==state.screen&&state.screen!=='entry'&&!rReduced()){const n=$('#content')||$('.mapscene');n?.classList.add('v2-enter');}
 SPOJ_V2.lastScreen=state.screen;v2MountMap();v2OfferSummary();v2MountDisclosure();v2Keyboard();
 if(state.screen==='discovery'&&v2MapState().ids&&!$('#content .v2-area-note'))$('#content')?.insertAdjacentHTML('afterbegin',`<div class="v2-area-note"><span>Oblast izabrana na mapi · ${filteredTasks().length} rezultata</span><button data-act="v2-map-reset">Cela oblast</button></div>`);
 if(['review','task-fields','task-time'].includes(state.screen)&&!$('#content .v2-flowline'))$('#content')?.insertAdjacentHTML('afterbegin',v2Steps(['Opiši','Uredi','Potvrdi'],state.screen==='review'?2:1));
};
window.USKOCI_DEMO={...window.USKOCI_DEMO,render,act,cChoose,v2MapState,v2ExportState,version:'SPOJ V2 — local prototype'};
render(false);
// Verified source alignment, not a new business rule:
// aiNeedV2Production.ts / NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR at 4bcc5dbf.
function v2TaskEditLocked(id){return state.agreements.some(a=>a.taskId===id);}
const v2EditExistingPrev=editExisting;
editExisting=function(){const t=state.draftOpen?state.drafts.find(d=>d.id===state.currentDraftId):task();
 if(t&&t.owner===state.person&&!state.draftOpen&&v2TaskEditLocked(t.id))return sheet('Promena ide kroz Dogovor',`<p>Za ovaj Zadatak već postoji Dogovor. Zadatak više ne menjaš na ovom mestu.</p><p>Novi termin, cenu ili obim konkretne saradnje predloži u njenom Dogovoru. Druga strana potvrđuje promenu.</p>`,btn('Otvori Dogovore','go:agreements')+quiet('Vrati se na zadatak','close-sheet'));
 return v2EditExistingPrev();
};
const v2StoreEditorPrev=storeEditor;
storeEditor=function(){if(state.editorSource?.kind==='task'&&v2TaskEditLocked(state.editorSource.id)){state.formError='U međuvremenu je sklopljen Dogovor. Zadatak nije izmenjen. Predloži promenu kroz Dogovor.';state.busy=false;return render();}return v2StoreEditorPrev();};
