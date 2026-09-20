const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),math=require(path.join(root,'evidence/math-build/BrandSceneMath.js'));
const cases=JSON.parse(fs.readFileSync(path.join(root,'motion/html-reference-frames.json'),'utf8'));
const numbers=s=>s.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
let rows=[];
for(const c of cases){const n=math.brandFrame(c.time,c.phone,c.logo);const m=numbers(c.mark);let ok=Math.abs(m[0]-n.mark.x)<1e-7&&Math.abs(m[1]-n.mark.y)<1e-7&&Math.abs(m[2]-n.mark.scale)<1e-7&&Math.abs(c.clip-n.wordClipWidth)<1e-7;
 c.parts.forEach((p,i)=>{const v=numbers(p.transform),x=n.parts[i];ok=ok&&Math.abs(p.opacity-x.opacity)<.000051&&[x.dx,x.dy,x.cx,x.cy,x.sx,x.sy,-x.cx,-x.cy].every((a,j)=>Math.abs(a-v[j])<1e-7)});
 rows.push({width:c.phone.width,timeMs:c.time,passed:ok});
}
const r=math.brandFrame(0,cases[0].phone,cases[0].logo,true);rows.push({name:'reducedMotion reaches final and enables choices',passed:r.done&&r.choices.enabled&&r.wordClipWidth===225});
let threw=false;try{math.brandFrame(NaN,cases[0].phone,cases[0].logo)}catch(e){threw=true}rows.push({name:'invalid measurements/time rejected',passed:threw});
fs.writeFileSync(path.join(root,'evidence/motion_math.json'),JSON.stringify(rows,null,2));console.log(rows.length,'checks;',rows.filter(r=>!r.passed));if(rows.some(r=>!r.passed))process.exitCode=1;
