'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const report=dir+'/ROUND_58_P6_GUARDED_NATIVE_PROOF_BUILD.md',receipt=dir+'/ROUND_58_P6_GUARDED_NATIVE_PROOF_BUILD_CHECKS.json';

function verify(){
 const allowed=new Set([report,receipt,'docs/control/redovi.json','docs/control/stanje.json','docs/control/FINALIZATION_MATRIX.md','docs/control/out/tabla.html']);
 for(const p of git('diff','--name-only',process.env.GITHUB_SHA).split('\n').filter(Boolean))assert(allowed.has(p),'Outside evidence package: '+p);
 const standard=read('src/data/discoveryV1NativeProofGate.ts');
 assert(standard.includes("routeParam === P6_DISCOVERY_PROOF_PARAM && buildFlag === '1' && androidPackage === 'rs.uskoci.dev'"));
 const route=read('src/app/(app)/zadaci.tsx');
 assert(route.includes('publicationRoute')&&route.includes('discoveryV1NativeProofAllowed(proofParam)'));
}

function record(){
 const focused=JSON.parse(read('/tmp/p6-round58/focused.json')),full=JSON.parse(read('/tmp/p6-round58/full.json'));
 for(const r of [focused,full]){assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);}
 const apk='/tmp/p6-round58/USKOCI-P6-PROOF-ARM64.apk';assert(fs.existsSync(apk));
 const source=git('rev-parse','HEAD'),run=process.env.GITHUB_RUN_ID;assert.match(run,/^\d+$/);
 const facts={unit:'P6_GUARDED_NATIVE_PROOF_BUILD',source,run,result:'PASS',
  focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},
  apkSha256:hash(apk),apkBytes:fs.statSync(apk).size,androidPackage:'rs.uskoci.dev',architectures:['arm64-v8a'],compileProofFlag:true,
  ordinaryBuildFailClosed:true,publicationForcedLegacy:true,deviceExecuted:false,serverApplied:false,productionWired:false,p6Finished:false};
 write(receipt,JSON.stringify(facts,null,2)+'\n');
 write(report,'# Round58 — guarded native P6 proof build\n\n'
 +'## Purpose / safety boundary\n\nThis package prepares an exact Android candidate that can exercise the real Zadaci route with the P6 route coordinator after a server target is available. It does not turn P6 on for ordinary users. The switch requires three things simultaneously: route parameter p6Proof=1, compile-time EXPO_PUBLIC_P6_DISCOVERY_PROOF=1, and Android package rs.uskoci.dev. A deep link/query parameter alone cannot change readers. Publication handoff parameters always keep the separately proved legacy publication landing.\n\n'
 +'## Source integration\n\nThe proof route uses the existing Zadaci address and existing DiscoveryPresentation/Map/TaskCard/Peek surface. It instantiates the Round55 route coordinator, Round53 bounded overlays, strict P6 transport and server-owned search/facet seam. Viewport/sheet/list offset remain route memory; filter changes reopen the traversal; MAP area/POINT/EXACT/PAGE remain coordinator-owned. Detail navigation still uses the existing /potrebe/[id]/pregled or /prilike/[id] screens according to the bounded relation overlay. No new native dependency is introduced.\n\n'
 +'## Checks / build\n\nTested source '+source+'; Actions run '+run+'. TypeScript PASS. Focused P6 native-gate/coordinator/presentation tests: '+focused.numPassedTestSuites+' suites / '+focused.numPassedTests+' tests PASS. Full Jest: '+full.numPassedTestSuites+' suites / '+full.numPassedTests+' tests PASS. ARM64 physical-device-compatible release APK built with exact DEV package and proof compile flag: SHA256 '+facts.apkSha256+', '+facts.apkBytes+' bytes. The APK is a workflow artifact only; it is not published as dev-latest or a store artifact.\n\n'
 +'## Limits / next P6 action\n\nThis is a build proof, not device acceptance. The candidate was not installed or interacted with, no P6 server package was applied to canonical DEV, and normal builds remain legacy. It therefore does not prove FULL → detail → Back, preserved offset/viewport/selected pin, memory/ANR, camera/touch latency, or production reader cutover.\n\n'
 +'P6 remains OPEN. The next native action is to run this guarded reader against an admissible PKG045b+P6 server target on Android, then use the same exact source/build identity for the required repeated FULL/map/list/detail/Back and memory/ANR checkpoints. Do not advance to another major phase.\n');
 const t=JSON.parse(read('docs/control/redovi.json'));
 t.finalization.p6_owner_stop={date:'2026-09-29',instruction:'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',evidence:report,completed:false};
 for(const id of ['B04','B05']){const row=t.redovi.find(x=>x.id===id);assert(row);const f=row.finalization;
  f.round58={source,run,guardedNativeBuild:true,apkSha256:facts.apkSha256,deviceExecuted:false,serverApplied:false,productionWired:false,p6Finished:false};
  f.evidence=[f.evidence,report,receipt].filter(Boolean).join('; ');
  f.test=(f.test||'')+' Round58 '+source.slice(0,8)+' / run'+run+': guarded proof route TypeScript/focused/full Jest PASS; ARM64 APK '+facts.apkSha256.slice(0,12)+' built, not device-tested.';
  f.status='P6 GUARDED NATIVE BUILD PASS / DEVICE+SERVER CUTOVER+FULL RETURN+MEMORY OPEN';
  row.sledece='P6 only: execute guarded P6 route against admissible PKG045b+P6 server target, then exact Android FULL/back/scroll/viewport/pin and memory/ANR acceptance; keep ordinary build fail-closed.';
 }
 write('docs/control/redovi.json',JSON.stringify(t,null,2)+'\n');
}
if(process.argv[2]==='record')record();else if(process.argv[2]==='verify')verify();else throw Error('Expected record/verify');
