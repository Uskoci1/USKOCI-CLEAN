'use strict';
// Bounded transformation of the owner's exact P5 scope. No server/provider operations.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const BASE='2e073bc11240fbe127f9be25c8ac8d415c607237';
const dir='docs/implementation/product-v1-closure-20260926/finalization-20260927';
const reportPath=`${dir}/ROUND_39_P5_WORK_AREA_AND_WORKER_REVIEW.md`,checksPath=`${dir}/ROUND_39_P5_CLIENT_CHECKS.json`;
const route='src/app/(app)/zadaci.tsx',map='src/ui/v2/DiscoveryMap.tsx',mapTypes='src/ui/v2/DiscoveryMap.types.ts';
const presentation='src/ui/v2/DiscoveryPresentation.tsx',worker='src/app/(app)/profil/razgovor.tsx',workerUI='src/ui/workerProfile/WorkerAiPresentation.tsx';
const mapTest='src/data/__tests__/discovery-map.test.tsx',routeTest='src/data/__tests__/published-task-discovery-route.test.tsx';
const workerTest='src/data/__tests__/worker-ai-conversation-recovery.test.tsx',workerUITest='src/ui/workerProfile/__tests__/worker-ai-review.test.tsx';
const code=[route,map,mapTypes,presentation,worker,workerUI],tests=[mapTest,routeTest,workerTest,workerUITest];
const additions=['src/data/discoveryWorkArea.ts','src/hooks/useDiscoveryWorkArea.ts','src/data/__tests__/discovery-work-area.test.ts','src/data/__tests__/discovery-work-area-hook.test.tsx'];
const read=p=>fs.readFileSync(p,'utf8'),write=(p,v)=>fs.writeFileSync(p,v),git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
function unchanged(paths){for(const p of paths)if(read(p)!==cp.execFileSync('git',['show',`${BASE}:${p}`],{encoding:'utf8'}))throw Error('Source drift: '+p);}
function replace(p,old,next){const s=read(p);if(s.split(old).length!==2)throw Error('Expected one anchor in '+p+': '+old.slice(0,90));write(p,s.replace(old,next));}
function append(p,s){write(p,read(p).trimEnd()+'\n\n'+s+'\n');}
function prepareTests(){
 git('merge-base','--is-ancestor',BASE,'HEAD');unchanged([...code,...tests]);
 if(fs.existsSync(reportPath)||fs.existsSync(checksPath))throw Error('Round39 already exists');
 append(mapTest,`// P5 exercises the real camera boundary, never fake GPS or area filtering.
const workAreaTarget = { key: 'saved-work-area', bounds: [19.5, 45, 20.2, 45.6] as [number, number, number, number] };
function workAreaPage(extra: Record<string, unknown> = {}) {
  return <DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={selectedId}
    onSelect={select} onViewport={setViewport} onArea={search} onList={list} onUserIntent={userIntent}
    {...{ initialWorkArea: workAreaTarget, ...extra }} />;
}
test('P5 work-area: the saved footprint fits once without becoming a filter, a pin or GPS', async () => {
  const handled = jest.fn();
  await act(async () => { tree = create(workAreaPage({ onInitialWorkAreaHandled: handled })); }); await ready();
  expect(mockFit).toHaveBeenLastCalledWith(workAreaTarget.bounds, expect.objectContaining({ duration: 0 }));
  expect(handled).toHaveBeenCalledWith(workAreaTarget.key);
  expect(search).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  expect(sourceData().features).toHaveLength(rows.length);
  const calls = mockFit.mock.calls.length;
  await act(async () => tree.update(workAreaPage({ onInitialWorkAreaHandled: handled })));
  expect(mockFit).toHaveBeenCalledTimes(calls); expect(handled).toHaveBeenCalledTimes(1);
});
test('P5 work-area: late layout delays the fit instead of consuming an unperformed request', async () => {
  await act(async () => { tree = create(workAreaPage()); });
  await act(async () => native().props.onDidFinishLoadingMap());
  expect(mockFit).not.toHaveBeenCalled(); await ready();
  expect(mockFit).toHaveBeenLastCalledWith(workAreaTarget.bounds, expect.anything());
});
test('P5 work-area: a remembered viewport wins over the optional seed', async () => {
  viewport = { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9] };
  await act(async () => { tree = create(workAreaPage()); }); await ready();
  expect(mockFit).not.toHaveBeenCalled();
  expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState.bounds).toEqual(viewport.bounds);
});
test('P5 work-area: manual pan before readiness wins over a delayed seed', async () => {
  await act(async () => { tree = create(workAreaPage()); });
  await act(async () => native().props.onRegionWillChange({ nativeEvent: { userInteraction: true } })); await ready();
  expect(mockFit).not.toHaveBeenCalled();
});
test('P5 work-area: a selected task keeps priority and no invented point enters GeoJSON', async () => {
  selectedId = rows[0].id;
  await act(async () => { tree = create(workAreaPage({ publicationCameraToken: 'publication' })); }); await ready();
  expect(mockFit.mock.calls.some(([bounds]) => JSON.stringify(bounds) === JSON.stringify(workAreaTarget.bounds))).toBe(false);
  expect(sourceData().features.every((feature: any) => feature.properties.needId !== workAreaTarget.key)).toBe(true);
});`);
 append(routeTest,`const mockWorkArea = { target: { key: 'work-area', bounds: [19, 44, 20, 45] }, retire: jest.fn(), handled: jest.fn() };
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => mockWorkArea }));
beforeEach(() => { mockWorkArea.retire.mockClear(); mockWorkArea.handled.mockClear(); });
test('P5 work-area: the route passes the optional camera without changing any applied criterion', async () => {
  mockParams = {}; await render(); const original = discovery().view;
  expect(discovery().initialWorkArea).toBe(mockWorkArea.target);
  await act(async () => discovery().onInitialWorkAreaHandled('work-area'));
  expect(mockWorkArea.handled).toHaveBeenCalledWith('work-area'); expect(discovery().view).toBe(original);
});
test('P5 work-area: explicit intent retires the seed and stale visit callbacks do not', async () => {
  mockParams = {}; await render(); const old = discovery().onUserIntent;
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => old()); expect(mockWorkArea.retire).not.toHaveBeenCalled();
  await act(async () => discovery().onUserIntent()); expect(mockWorkArea.retire).toHaveBeenCalledTimes(1);
});
test('P5 work-area: a trusted publication is never handed a competing default camera', async () => {
  await render(); expect(discovery().initialWorkArea).toBeNull();
});`);
 append(workerTest,`it('P5 worker review: one reachable footer action prepares the existing review, never saves or activates implicitly', async () => {
  mockApi.prepare.mockResolvedValue({ ok: false, kod: 'UNAVAILABLE', poruka: 'Proveri stanje.' });
  await render(); const footer = shell().props.footerAction;
  expect(footer.props.label).toBe('Pregledaj profil'); expect(footer.props.disabled).toBe(false);
  expect(shell().props.card(false).props.reviewInFooter).toBe(true);
  expect(mockApi.prepare).not.toHaveBeenCalled(); expect(mockApi.save).not.toHaveBeenCalled();
  await act(async () => footer.props.onPress());
  expect(mockApi.prepare).toHaveBeenCalledWith(C, 0, true); expect(mockApi.save).not.toHaveBeenCalled();
});
it('P5 worker review: no empty-profile call to action and no review during an unresolved turn', async () => {
  mockApi.read.mockResolvedValue(ok({ ...snapshot(), candidate: { ...candidate(), skills: [] } }));
  await render(); expect(shell().props.footerAction).toBeUndefined(); await act(async () => tree.unmount());
  mockApi.read.mockResolvedValue(ok(snapshot(turn()))); await render();
  const footer = shell().props.footerAction; expect(footer.props.disabled).toBe(true);
  await act(async () => footer.props.onPress()); expect(mockApi.prepare).not.toHaveBeenCalled();
});`);
 append(workerUITest,`jest.mock('../../location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ReviewedWorkAreaMap' }));
it('P5 worker review: map belongs to the frozen review and is read-only, not a new live location', async () => {
  const saved = review({}, { location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20,
    approximatePosition: { latitude: 45.25, longitude: 19.83 } } });
  await act(async () => { tree = create(<WorkerAiReviewDetails review={saved} />); });
  const map = tree.root.findByType('ReviewedWorkAreaMap' as React.ElementType);
  expect(map.props).toMatchObject({ coarse: true, disabled: true, height: 220, position: saved.profile.location.approximatePosition });
  expect(map.props.scopeKey).toContain(saved.reviewId); expect(map.props.scopeKey).toContain(saved.accountId);
  expect(texts()).not.toContain('tačka radnog područja je sačuvana');
});
it('P5 worker review: missing coordinates never render a fabricated map', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review()} />); });
  expect(tree.root.findAllByType('ReviewedWorkAreaMap' as React.ElementType)).toHaveLength(0);
});`);
}
function applySource(){
 unchanged(code);
 write(route,`import { useDiscoveryWorkArea } from '../../hooks/useDiscoveryWorkArea';\n`+read(route));
 replace(route,'  const publicationToken = handoff?.token ?? null;',`  const publicationToken = handoff?.token ?? null;
  const workArea = useDiscoveryWorkArea({ accountId: user?.id ?? null, accountRevision, source,
    focus: scope, focusRef: focus, view, publication: !!handoff });`);
 replace(route,'{ retirePublicationLanding(); navigating.current = true; action(); }','{ workArea.retire(); retirePublicationLanding(); navigating.current = true; action(); }');
 replace(route,'      scopeKey={`${user?.id ?? \'\'}:${accountRevision}`} view={view}',`      initialWorkArea={handoff ? null : workArea.target} onInitialWorkAreaHandled={workArea.handled}
      scopeKey={\u0060\u0024{user?.id ?? ''}:\u0024{accountRevision}\u0060} view={view}`);
 replace(route,'      onUserIntent={retirePublicationLanding}','      onUserIntent={() => { if (current()) { workArea.retire(); retirePublicationLanding(); } }}');
 write(presentation,`import type { WorkAreaCamera } from '../../data/discoveryWorkArea';\n`+read(presentation));
 replace(presentation,'  scopeKey: string; view: MarketplaceView;',`  /** One-shot locality fallback, never a filter, task point or GPS marker. */
  initialWorkArea?: WorkAreaCamera | null; onInitialWorkAreaHandled?: (key: string) => void;
  scopeKey: string; view: MarketplaceView;`);
 replace(presentation,'          viewport={view.viewport} scopeKey={props.scopeKey}',`          initialWorkArea={props.initialWorkArea} onInitialWorkAreaHandled={props.onInitialWorkAreaHandled}
          viewport={view.viewport} scopeKey={props.scopeKey}`);
 write(mapTypes,`import type { WorkAreaCamera } from '../../data/discoveryWorkArea';\n`+read(mapTypes));
 replace(mapTypes,'  /** Account-owned overlay for rich pins only.',`  /** Handled means attempted/retired, not device-render acceptance. */
  initialWorkArea?: WorkAreaCamera | null; onInitialWorkAreaHandled?: (key: string) => void;
  /** Account-owned overlay for rich pins only.`);
 replace(map,'publicPoint, publicViewport, type MarketplaceItem','publicPoint, publicViewport, publicBounds, type MarketplaceItem');
 replace(map,"  const failure = useRef<'deadline' | 'native-error' | null>(null);",`  const failure = useRef<'deadline' | 'native-error' | null>(null);
  const workAreaMayApply = useRef(!props.viewport);`);
 replace(map,'  const manualMapIntent = () => {\n    if (!owns()) return;','  const manualMapIntent = () => {\n    if (!owns()) return;\n    workAreaMayApply.current = false;');
 replace(map,"    if (!initialFitPending.current || status !== 'ready' || !owns()) return;","    if (!initialFitPending.current || status !== 'ready' || !owns()) return;\n    if (props.initialWorkArea && workAreaMayApply.current) return;");
 replace(map,'dataKey, props.fitTo?.key, props.centerNearby?.key]); // eslint-disable-line react-hooks/exhaustive-deps','dataKey, props.fitTo?.key, props.centerNearby?.key, props.initialWorkArea?.key]); // eslint-disable-line react-hooks/exhaustive-deps');
 replace(map,"  // A place chosen in the search: the camera brings its pins into view once, as its own move (never an area).",`  // The route owns this optional first-camera lifetime; fields and public GeoJSON never change.
  // Remembered viewport, publication, selected pin, search, Nearby and manual gestures win.
  useEffect(() => {
    if (!owns() || !workAreaMayApply.current) return;
    if (props.selectedId || props.selectedPlace || props.publicationCameraToken || props.fitTo || props.centerNearby) {
      workAreaMayApply.current = false; return;
    }
    const request = props.initialWorkArea;
    if (!request || status !== 'ready' || !frame || props.cameraLayoutReady === false || !camera.current) return;
    const bounds = publicBounds(request.bounds);
    workAreaMayApply.current = false;
    if (bounds && bounds[0] <= bounds[2]) {
      cancelArea(); intent.current = 0;
      try {
        camera.current.fitBounds(bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.fitBottom ?? 56), duration: 0 });
        initialFitPending.current = false;
      } catch { /* Optional failure leaves the existing initial-fit/retry path intact. */ }
    }
    props.onInitialWorkAreaHandled?.(request.key);
  }, [props.initialWorkArea, status, frame, props.cameraLayoutReady, props.toolsBottom, props.fitBottom,
    props.selectedId, props.selectedPlace, props.publicationCameraToken, props.fitTo, props.centerNearby]); // eslint-disable-line react-hooks/exhaustive-deps
  // A place chosen in the search: the camera brings its pins into view once, as its own move (never an area).`);
 replace(workerUI,"import { V2Action } from '../v2/V2Action';","import { V2Action } from '../v2/V2Action';\nimport { ResolvedPinMap } from '../location/ResolvedPinMap';\nimport { displayedPinPosition } from '../location/ResolvedPinMap.types';");
 replace(workerUI,'export function WorkerAiCard({profile,compact,review,disabled}:{profile:WorkerAiProfile;compact:boolean;review:()=>void;disabled:boolean}){','export function WorkerAiCard({profile,compact,review,disabled,reviewInFooter=false}:{profile:WorkerAiProfile;compact:boolean;review:()=>void;disabled:boolean;reviewInFooter?:boolean}){');
 replace(workerUI,'      <Press testID="worker-draft-review"','      {!reviewInFooter?<Press testID="worker-draft-review"');
 replace(workerUI,'        <ReviewCue disabled={disabled}/>\n      </Press>','        <ReviewCue disabled={disabled}/>\n      </Press>:null}');
 replace(workerUI,'  const p=review.profile;','  const p=review.profile;\n  const point=displayedPinPosition(p.location.approximatePosition,true);');
 replace(workerUI,`      <T variant="note" tone="muted">{p.location.approximatePosition?'Približna tačka radnog područja je sačuvana.':'Približna tačka nije uneta. Možeš je podesiti kroz postojeće područje rada.'}</T>`,`      {point?<ResolvedPinMap coarse disabled height={220} position={point}
        scopeKey={\u0060worker-review:\u0024{review.accountId}:\u0024{review.profileId}:\u0024{review.reviewId}:\u0024{review.revision}\u0060}
        onChoose={()=>{ /* Frozen review, never a location editor. */ }}/>:null}
      <T variant="note" tone="muted">{point?'Prikazan je približan centar područja. Radijus važi kako je naveden iznad.':'Približna tačka nije uneta. Možeš je podesiti kroz postojeće područje rada.'}</T>`);
 replace(worker,'compact={compact} disabled={!enabled||!writable} review={()=>{void review();}}/>','compact={compact} disabled={!enabled||!writable} reviewInFooter review={()=>{void review();}}/>');
 replace(worker,'    messages={data.messages.map',`    footerAction={hasProfileContent&&writable&&!data.saved?<V2Action label="Pregledaj profil" style={brandAction}
      disabled={!enabled} reason={!enabled?unavailableNow:undefined} onPress={()=>{void review();}}/>:undefined}
    messages={data.messages.map`);
 console.log('P5 source applied; TaskCard/Peek, backend, dependencies and payments untouched.');
}
function record(){
 const source=git('rev-parse','HEAD'),full=JSON.parse(read('outputs/p5/full.json')),focused=JSON.parse(read('outputs/p5/focused.json')),before=JSON.parse(read('outputs/p5/before.json'));
 if(!full.success||full.numFailedTests||full.numFailedTestSuites||!focused.success||before.numFailedTests<4||before.numRuntimeErrorTestSuites)throw Error('Verification incomplete');
 const run=process.env.GITHUB_RUN_ID;
 const receipt={base:BASE,testedSource:source,run,sourceOnly:true,native:'NOT_RUN',provider:'NOT_RUN',backend:'UNCHANGED',
 before:{failed:before.numFailedTests,passed:before.numPassedTests},focused:{suites:focused.numPassedTestSuites,tests:focused.numPassedTests},
 full:{suites:full.numPassedTestSuites,tests:full.numPassedTests},typecheck:'PASS',
 hashes:Object.fromEntries([...code,...tests,...additions].map(p=>[p,crypto.createHash('sha256').update(read(p)).digest('hex')]))};
 write(checksPath,JSON.stringify(receipt,null,2)+'\n');
 write(reportPath,`# Round39 — work-area camera and worker AI review\n\nTested source: \`${source}\`. GitHub Actions run ${run}.\n\n## User intention and changes\n\nDiscovery optionally reads the existing owned work area once on a pristine entry. A city name without an explicit coarse point is not geocoded. Saved point/radius supplies only a first camera footprint, never an applied filter, task pin or matching decision. Publication/search/selection/Nearby, remembered viewport, manual gestures, account changes and departure take precedence. The optional read has a four-second wait bound and never blocks the task list. A timeout does not claim cancellation of server execution. No GPS permission or location write is introduced; map tile requests may disclose the viewed coarse area to the existing map provider.\n\nWorker AI uses one visible Pregledaj profil action above the composer, through the existing shell and guarded prepare/save/activation path. The compact draft still expands independently. The frozen review renders its own read-only coarse map, 220dp, with no invented point and no claim that candidate data is already saved. Review remains distinct from save/activation.\n\n## Evidence\n\nBefore production changes: ${before.numFailedTests} regression failures, no test-suite runtime errors. After: TypeScript PASS; ${focused.numPassedTestSuites} focused suites/${focused.numPassedTests} tests PASS; full Jest ${full.numPassedTestSuites} suites/${full.numPassedTests} tests PASS. The source commit above predates those checks. Exact hashes are in ROUND_39_P5_CLIENT_CHECKS.json.\n\nThe narrow execution script verifies exact predecessor bytes and allowed paths. The final push refuses a concurrently moved canonical branch and is fast-forward only. It invokes no business, provider or server commands.\n\n## Boundaries\n\nNo TaskCard/Peek, DEV/Edge/certificate/dependency/payment change. No APK, phone, emulator, new screenshot, native latency or provider proof. The previous FULL-return source fix is retained, not declared device-accepted. Personal locality is separate from work area. The two privacy branches remain deferred. Web fallback is not claimed as native camera evidence.\n\nP5 is not complete: task ready-card refinement, AI extraction/geocoding, real worker activation and field-to-matching proof remain. P6 bounded collection/load, voice B1/B2, account/privacy/legal/store/operations requirements remain open.\n\n## Next exact-build native scenarios\n\n1. Fresh entry with saved work point/radius: camera moves, criteria/task IDs do not silently change.\n2. No point, read error or timeout: existing list/map remains usable without GPS.\n3. Search/pan/pin/publication before a late response wins. Detail/Back preserves later viewport/list offset.\n4. Worker AI review remains reachable above keyboard; its map belongs to the frozen review. Back sends nothing; save/activation remains explicit.\n5. Small width, large text, reduced motion and actual map rendering on the same recorded APK.\n\nHosted control publication remains pending; the prior invalid_argument is not declared repaired.\n`);
 const data=JSON.parse(read('docs/control/redovi.json'));
 for(const id of ['B00','B02','B04']){
  const row=data.redovi.find(r=>r.id===id);if(!row)throw Error('Missing row '+id);const f=row.finalization;
  f.round39={tested_source:source,run,focused:receipt.focused,full:receipt.full,device:'PENDING'};
  f.evidence=[f.evidence,reportPath].filter(Boolean).join('; ');
  f.test=`Round39 ${source.slice(0,8)} / run${run}: TypeScript PASS; ${focused.numPassedTestSuites}/${focused.numPassedTests} focused PASS; full Jest ${full.numPassedTestSuites}/${full.numPassedTests} PASS. No new device/provider proof.`;
  if(id==='B00'){
   f.ux='Pregledaj profil je jedna radnja iznad unosa; kartica otvara sažetak. Pregled ima mapu svoje približne tačke, bez tvrdnje da je nacrt već sačuvan.';
   f.ui='Postojeći AiConversationShell footerAction i ResolvedPinMap coarse/readonly, 220dp. Bez paralelnog prototipa ili promene TaskCard/Peek.';
   f.status='P5 WORKER REVIEW CLIENT CONNECTED / SOURCE TESTED / NATIVE AND PROVIDER PENDING';
   row.problem='Pregled i read-only mapa su povezani. Ceo stvarni intervju, provider kvalitet, čuvanje i aktivacija na aktuelnom APK-u ostaju za dokaz.';
  }else if(id==='B02'){
   f.ux='Sačuvana približna tačka i radijus rada su opcioni početni centar mape, ne lična adresa, GPS ili skriveni filter.';
   f.status='WORK AREA CAMERA SOURCE CONNECTED / NATIVE PENDING / PERSONAL LOCALITY SEPARATE';
   row.problem='Početna kamera povezana sa postojećim owned radnim područjem. Lično mesto je zaseban ugovor; current APK nije potvrđen.';
  }else{
   f.status='FULL-RETURN AND WORK-AREA SOURCE/CI PASS / EXACT NATIVE PENDING / P6 OPEN';
   row.problem+=' Round39 dodaje samo opcioni work-area camera fit; P6 i tačan native FULL povratak ostaju otvoreni.';
  }
  f.state_sync+=' Round39: postojeći viewport/objava/izbor i nova radnja imaju prednost; stari nalog/poseta/timeout ne primenjuju zakasnelu kameru.';
  f.device_proof='Round39 nije instaliran ili proveravan na uređaju; istorijski dokazi ostaju vezani za svoje verzije.';
  row.sledece='Objedinjeni native checkpoint prema '+reportPath+'; zatim preostali P5 AI/matching i P6. Provider/server promene ostaju zasebno odobrene.';
 }
 write('docs/control/redovi.json',JSON.stringify(data,null,2)+'\n');
 write('AGENTS.md',`FINALIZATION ROUND39 (2026-09-28): tested source ${source}; run${run}; TypeScript and focused/full Jest PASS, counts/hashes in ${checksPath}. Saved work area is an optional initial camera only; explicit/remembered views win. Worker AI review is above composer; frozen review has its own coarse map. No TaskCard/Peek/server/provider/dependency/certificate/payment change. Native/AI/matching/P6/voice acceptance OPEN. Read ${reportPath}; same62-row control updated/generated, hosted publication pending.\n\n`+read('AGENTS.md'));
 const plan='docs/implementation/product-v1-closure-20260926/PLAN.md';
 replace(plan,'## Start here: current evidence and boundaries',`Latest P5 client checkpoint: [Round39](finalization-20260927/ROUND_39_P5_WORK_AREA_AND_WORKER_REVIEW.md), tested source \`${source}\`. Older runtime/installation references below are dated baselines, not this package's device acceptance.\n\n## Start here: current evidence and boundaries`);
 console.log(JSON.stringify(receipt));
}
function verifyPaths(){
 const allowed=new Set([...code,...tests,...additions,reportPath,checksPath,'AGENTS.md','docs/implementation/product-v1-closure-20260926/PLAN.md',
 'docs/control/redovi.json','docs/control/stanje.json','docs/control/out/tabla.html','docs/control/FINALIZATION_MATRIX.md',
 'scripts/proofs/p5-client-package.cjs','.github/workflows/p5-client-package.yml']);
 for(const p of git('diff','--name-only',BASE).split('\n').filter(Boolean))if(!allowed.has(p))throw Error('Outside package: '+p);
 for(const p of git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean))if(!allowed.has(p)&&!p.startsWith('outputs/p5/'))throw Error('Unexpected file: '+p);
 console.log('Package path boundary PASS');
}
const phase=process.argv[2];
if(phase==='tests')prepareTests();else if(phase==='apply')applySource();else if(phase==='record')record();else if(phase==='verify')verifyPaths();
else if(phase==='paths')console.log([...code,...tests,...additions].join('\n'));else throw Error('Expected tests/apply/record/verify/paths');
