function rIntroFrame(t){
 const n=rIntroNodes();if(!n.svg||!n.mark)return;R.intro.time=t;
 const finish=t>=R.intro.duration;const skip=n.root.querySelector('.r-skip');if(skip)skip.hidden=finish;
 n.root.classList.toggle('intro-running',!finish);n.root.dataset.introTime=Math.round(t);
 const box=n.svg.getBoundingClientRect(),phone=n.root.getBoundingClientRect(),k=box.width/320;
 const targetCx=phone.left+phone.width/2,targetCy=phone.top+phone.height*.445;
 const localCx=39+(targetCx-box.left)/k,localCy=174+(targetCy-box.top)/k;
 const bigPx=Math.min(phone.width*.61,238),s0=bigPx/(280*k),p=rEase(rProgress(t,1920,2690));
 const tx=rLerp(localCx-140*s0,42.806,p),ty=rLerp(localCy-145.45*s0,175.496,p),s=rLerp(s0,.34,p);
 n.mark.setAttribute('transform',`translate(${tx} ${ty}) scale(${s})`);
 const parts=[...n.svg.querySelectorAll('[data-r-part]')];
 for(const g of parts){const i=Number(g.dataset.rPart),meta=R_PARTS[i];let op=1,dx=0,dy=0,sx=1,sy=1;
  if(i===2||i===3){const q=rEase(rProgress(t,80,650));op=q;dx=(i===2?-52:52)*(1-q);sx=sy=rLerp(.92,1,q);}
  if(i===5||i===6){const q=rEase(rProgress(t,40,760));op=q;dx=(i===5?-62:62)*(1-q);sx=sy=rLerp(.95,1,q);}
  if(i===4){const q=rEase(rProgress(t,630,900));op=q;dy=5*(1-q);}
  if(i===1){const q=rEase(rProgress(t,760,1120));op=q;dy=-22*(1-q);sx=sy=rLerp(.55,1,q);}
  if(i===0){const q=rEase(rProgress(t,930,1240));op=q;sx=rLerp(.35,1,q);}
  if(i===2){const close=rEase(rProgress(t,1450,1550)),open=rEase(rProgress(t,1620,1750));sy*=1-.9*close*(1-open);}
  const cx=meta[2]/2,cy=meta[3]/2;g.setAttribute('opacity',op.toFixed(4));g.setAttribute('transform',`translate(${dx} ${dy}) translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`);
 }
 const word=rEase(rProgress(t,2700,3200));const rect=n.svg.querySelector('[data-r-word-reveal]');rect.setAttribute('width',String(225*word));
 n.svg.querySelector('[data-r-words]').setAttribute('opacity',t<2700?'0':'1');
 const sp=rEase(rProgress(t,3210,3500));n.slogan.style.opacity=sp;n.slogan.style.transform=`translateY(${6*(1-sp)}px)`;
 // The white platform stays in the same location. Only the surrounding fields enter.
 const bg=rEase(rProgress(t,3590,4200));n.root.querySelector('.r-green').style.transform=`translateX(${-101*(1-bg)}%)`;
 n.root.querySelector('.r-orange').style.transform=`translateX(${101*(1-bg)}%)`;
 n.panel.style.boxShadow=`0 16px 36px rgb(20 61 53 / ${.045*bg})`;
 const cp=rEase(rProgress(t,3980,4340));for(const el of [n.choices,n.foot]){el.style.opacity=cp;el.style.transform=`translateY(${7*(1-cp)}px)`;el.inert=!finish;}
 if(n.status)n.status.style.color=bg<.9?'#143d35':'#ffffff';
 if(finish){R.intro.playing=false;R.intro.done=true;n.svg.setAttribute('aria-label','USKOČI');}
}