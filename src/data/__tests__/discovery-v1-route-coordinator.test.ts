import { createDiscoveryV1RouteCoordinator, discoveryV1RouteIntentKey, DISCOVERY_V1_RESTORE_PAGES } from '../discoveryV1RouteCoordinator';
import { initialMarketplaceView, type MarketplaceView } from '../marketplaceView';
import { taskRelationIndex } from '../taskRelation';
import { discoveryV1PresentationBridgeModel, type DiscoveryV1PresentationActions } from '../discoveryV1PresentationBridge';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';

const AT='2026-09-29T05:00:00.000000Z',EX='2026-09-29T05:30:00.000000Z',A='a'.repeat(32);
const ID='11111111-1111-4111-8111-111111111111',PROFILE='22222222-2222-4222-8222-222222222222';
const anchor=()=>({version:'DISCOVERY_V1',filterKey:A,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const item=():any=>({id:ID,revision:1,sortAt:AT,publishedAt:AT,title:'Selidba',category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:null,criticalConditions:null});
const page=(listed=12):any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:A,anchor:anchor(),items:[item()],hasMore:false,nextCursor:null,
 counts:{kind:'exact_live',observedAt:AT,mapped:12,listed,inArea:listed,withoutPoint:0,undated:0},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['OFFERS']}});
const map=(bounds:[number,number,number,number]):any=>({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:A,anchor:anchor(),coverageBounds:bounds,
 effectiveGrid:8,wholeBounds:[19,44,21,46],buckets:[{kind:'TASK',key:'task:'+ID,point:{lat:45.25,lng:19.83},taskId:ID}],
 counts:{kind:'exact_live',observedAt:AT,mapped:1,withoutPoint:0}});
const places=():any=>({version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:A,anchor:anchor(),
 items:[{key:'novi sad, liman',text:'Novi Sad, Liman',count:8}],hasMore:false,nextCursor:null,
 counts:{kind:'exact_live',observedAt:AT,everywhere:12,inArea:7}});
const exact=():any=>({version:'DISCOVERY_V1',mode:'EXACT_PUBLIC',asOf:AT,items:[item()],hasMore:false,nextCursor:null});
const view=(patch:Partial<MarketplaceView>={}):MarketplaceView=>({...initialMarketplaceView(),mode:'map',
 viewport:{center:[20,45],zoom:10,bounds:[19,44,21,46]},...patch});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve};};

function harness(){
 const calls:DiscoveryV1OwnerRequest[]=[];
 const transport=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{
  calls.push(request);
  if(request.mode==='MAP')return map(request.bounds);
  if(request.mode==='PLACES')return places();
  if(request.mode==='EXACT_PUBLIC')return exact();
  return page(request.limit===1?19:12);
 });
 const relations=jest.fn(async(ids:readonly string[])=>taskRelationIndex([],ids));
 const overlay={relations,profile:jest.fn(async()=>null),urgencies:jest.fn(async()=>new Map())};
 return {calls,transport,relations,overlay};
}

it('viewport sheet and scroll changes do not reopen the server traversal',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 const initial=view({sheet:'half',listOffset:80});await route.open(initial);
 expect(h.calls.map(x=>x.mode)).toEqual(['PAGE','MAP']);
 const changed={...initial,viewport:{center:[20.2,45.1] as [number,number],zoom:12,bounds:[19.5,44.5,20.5,45.5] as [number,number,number,number]},
  sheet:'full' as const,listOffset:640};
 expect(discoveryV1RouteIntentKey(changed)).toBe(discoveryV1RouteIntentKey(initial));
 const result=await route.updateView(changed);expect(result.kind).toBe('passive');expect(h.calls).toHaveLength(2);
 expect(route.snapshot().view).toMatchObject({sheet:'full',listOffset:640,viewport:changed.viewport});
});

it('a search intent change reopens PAGE and MAP while passive state stays route-owned',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view({sheet:'full',listOffset:500}));
 const next=view({query:'kombi',sheet:'full',listOffset:500});const result=await route.updateView(next);
 expect(result.kind).toBe('applied');expect(h.calls.map(x=>x.mode)).toEqual(['PAGE','MAP','PAGE','MAP']);
 expect(route.snapshot().view).toMatchObject({query:'kombi',sheet:'full',listOffset:500});
});

it('settled map scope shares the accepted anchor and preserves viewport sheet and offset',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 const passive=view({sheet:'full',listOffset:420,viewport:{center:[20,45],zoom:13,bounds:[19,44,21,46]}});
 await route.open(passive);
 const result=await route.settleMap([19.5,44.5,20.5,45.5]);
 expect(result.kind).toBe('applied');
 expect(h.calls.slice(-2).map(x=>x.mode).sort()).toEqual(['MAP','PAGE']);
 const pageRequest=h.calls.findLast(x=>x.mode==='PAGE') as any,mapRequest=h.calls.findLast(x=>x.mode==='MAP') as any;
 expect(pageRequest.anchor).toEqual(anchor());expect(mapRequest.anchor).toEqual(anchor());
 expect(route.snapshot().view).toMatchObject({area:[19.5,44.5,20.5,45.5],sheet:'full',listOffset:420,viewport:passive.viewport});
});

it('search preview is separate from displayed session and uses exact server count plus PLACES',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view());const before=route.snapshot().screen.items.map(x=>x.id);
 const result=await route.previewSearch({query:'nov',place:null,area:null,pinPlace:null,when:'any',dates:null,where:'any',places:1,price:'all'},[19,44,21,46],5);
 expect(result.kind).toBe('applied');expect(route.snapshot().search).toMatchObject({status:'ready',count:19,everywhere:12,inMapArea:7});
 expect(route.snapshot().screen.items.map(x=>x.id)).toEqual(before);
 expect(h.calls.slice(-2).map(x=>x.mode)).toEqual(['PAGE','PLACES']);
});

it('TASK selection uses exact public read and coordinator owns selected marker key',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);await route.open(view());
 const marker=route.snapshot().screen.mapMarkers[0];expect(marker.kind).toBe('TASK');
 const selected=await route.selectMarker(marker);expect(selected.kind).toBe('TASK');
 expect(h.calls.at(-1)?.mode).toBe('EXACT_PUBLIC');expect(route.snapshot().selectedMarkerKey).toBe(marker.key);
 expect(route.snapshot().screen.peek).toMatchObject({kind:'TASK'});
 route.clearPeek();expect(route.snapshot().selectedMarkerKey).toBeNull();expect(route.snapshot().screen.peek).toBeNull();
});

it('optional overlay is capped independently of loaded membership',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);await route.open(view());
 expect(h.relations).toHaveBeenCalledTimes(1);expect(h.relations.mock.calls[0][0]).toEqual([ID]);
 expect(route.snapshot().screen.items).toHaveLength(1);
});

it('retire is terminal for route screen overlay and search owners',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);await route.open(view());route.retire();
 expect(route.snapshot()).toMatchObject({active:false,view:null,selectedMarkerKey:null,screen:{active:false},overlay:{active:false},search:{active:false}});
 expect((await route.updateView(view())).kind).toBe('stale');
});

it('coordinator snapshot feeds the real presentation bridge including authoritative search seam',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);await route.open(view());
 await route.previewSearch({query:'',place:null,area:null,pinPlace:null,when:'any',dates:null,where:'any',places:1,price:'all'},[19,44,21,46],5);
 const state=route.snapshot(),actions:DiscoveryV1PresentationActions={
  onSelectMarker:jest.fn(),onArea:jest.fn(),onClearPeek:jest.fn(),onShowPlace:jest.fn(),onShowAll:jest.fn(),onNextPage:jest.fn(),
  onSearchDraft:jest.fn(),onNextSearchPlaces:jest.fn(),
 };
 const model=discoveryV1PresentationBridgeModel(state.screen,state.overlay,state.selectedMarkerKey,state.loadingMore,actions,state.search);
 expect(model.view.viewport).toEqual(state.view?.viewport);
 expect(model.p6Seam.search?.snapshot).toMatchObject({status:'ready',count:19,everywhere:12,inMapArea:7});
 expect(model.p6Seam.search?.onDraft).toBe(actions.onSearchDraft);
 expect(model.p6Seam.search?.onNextPlaces).toBe(actions.onNextSearchPlaces);
});


it('public PAGE is publishable before optional profile overlay finishes',async()=>{
 const h=harness(),profileGate=deferred<null>(),optionalChanged=jest.fn();
 const route=createDiscoveryV1RouteCoordinator(h.transport,{
  relations:async ids=>taskRelationIndex([],ids),urgencies:async()=>new Map(),profile:()=>profileGate.promise,
 },()=>true,optionalChanged);
 const opened=await route.open(view());
 expect(opened.kind).toBe('applied');
 expect(route.snapshot().screen.items).toHaveLength(1);
 expect(route.snapshot().overlay.loading).toBe(true);
 expect(optionalChanged).not.toHaveBeenCalled();
 profileGate.resolve(null);
 for(let n=0;n<20&&route.snapshot().overlay.loading;n++)await Promise.resolve();
 expect(route.snapshot().overlay.loading).toBe(false);
 await Promise.resolve();
 expect(optionalChanged).toHaveBeenCalledTimes(1);
});

it('TASK selection is persisted in route view and restored after coordinator remount',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view({sheet:'full',listOffset:360}));
 const marker=route.snapshot().screen.mapMarkers[0];
 const selected=await route.selectMarker(marker);
 expect(selected.kind).toBe('TASK');
 expect(route.snapshot().view).toMatchObject({selectedId:ID,selectedPlace:null,sheet:'peek',listOffset:360});
 expect(route.snapshot().selectedMarkerKey).toBe(marker.key);
 const saved=route.snapshot().view!;
 route.retire();

 const restored=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 const result=await restored.open(saved);
 expect(result.kind).toBe('applied');
 expect(h.calls.at(-1)?.mode).toBe('EXACT_PUBLIC');
 expect(restored.snapshot().selectedMarkerKey).toBe(marker.key);
 expect(restored.snapshot().screen.peek).toMatchObject({kind:'TASK'});
 expect(restored.snapshot().view).toMatchObject({selectedId:ID,sheet:'peek',listOffset:360});
 restored.clearPeek();
 expect(restored.snapshot().view).toMatchObject({selectedId:null,selectedPlace:null});
});

const B='b'.repeat(32);
const rowId=(n:number)=>`00000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`;
/** A traversal of `pages` pages of one row each; `failAt` makes that page (0-based) fail. */
function pagedHarness(pages:number,failAt=-1){
 const calls:DiscoveryV1OwnerRequest[]=[];
 const transport=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{
  calls.push(request);
  if(request.mode==='MAP')return map(request.bounds);
  if(request.mode!=='PAGE')return exact();
  const index=request.after?Number((request.after as any).id.slice(-12)):0;
  if(index===failAt)throw new Error('PAGE_FAILED');
  const more=index<pages-1;
  return {...page(pages),items:[{...item(),id:rowId(index)}],hasMore:more,
   nextCursor:more?{scopeKey:B,section:0,sortAt:AT,id:rowId(index)}:null};
 });
 const overlay={relations:jest.fn(async(ids:readonly string[])=>taskRelationIndex([],ids)),profile:jest.fn(async()=>null),urgencies:jest.fn(async()=>new Map())};
 return {calls,transport,overlay};
}
const pageCalls=(calls:DiscoveryV1OwnerRequest[])=>calls.filter(x=>x.mode==='PAGE') as any[];

it('a return reads the depth the list had before presenting, so a deep offset is not clamped to page one',async()=>{
 const h=pagedHarness(6),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 const result=await route.restore(view({sheet:'full',listOffset:2400,pages:4}));
 expect(result.kind).toBe('applied');
 expect(pageCalls(h.calls).map(x=>x.after?x.after.id:null)).toEqual([null,rowId(0),rowId(1),rowId(2)]);
 expect(route.snapshot().screen.items.map(x=>x.id)).toEqual([0,1,2,3].map(rowId));
 expect(route.snapshot().view).toMatchObject({pages:4,sheet:'full',listOffset:2400});
});

it('the restored depth is bounded and a first-page view reads one page only',async()=>{
 const deep=pagedHarness(30),route=createDiscoveryV1RouteCoordinator(deep.transport,deep.overlay);
 await route.restore(view({pages:50}));
 expect(pageCalls(deep.calls)).toHaveLength(DISCOVERY_V1_RESTORE_PAGES);
 expect(route.snapshot().view?.pages).toBe(DISCOVERY_V1_RESTORE_PAGES);
 for(const pages of [undefined,0,1,-3,Number.NaN]){
  const h=pagedHarness(5),first=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
  await first.restore(view({pages}));
  expect(pageCalls(h.calls)).toHaveLength(1);expect(first.snapshot().view?.pages).toBe(1);
 }
});

it('restoring keeps the pages already read when a later page fails or the traversal ends early',async()=>{
 const failing=pagedHarness(6,2),a=createDiscoveryV1RouteCoordinator(failing.transport,failing.overlay);
 expect((await a.restore(view({pages:5}))).kind).toBe('applied');
 expect(a.snapshot().screen.items).toHaveLength(2);expect(a.snapshot().view?.pages).toBe(2);
 const short=pagedHarness(2),b=createDiscoveryV1RouteCoordinator(short.transport,short.overlay);
 await b.restore(view({pages:5}));
 expect(pageCalls(short.calls)).toHaveLength(2);expect(b.snapshot().view?.pages).toBe(2);
});

it('a retired coordinator stops restoring instead of reading further pages',async()=>{
 const h=pagedHarness(6),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 const pending=route.restore(view({pages:5}));
 await Promise.resolve();route.retire();
 expect((await pending).kind).toBe('stale');
 expect(pageCalls(h.calls).length).toBeLessThan(5);
});

it('a refresh reads fresh and forgets the depth; a search change or a scope change starts over',async()=>{
 const h=pagedHarness(6),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.restore(view({pages:3}));expect(route.snapshot().view?.pages).toBe(3);
 await route.open(route.snapshot().view!);expect(route.snapshot().view?.pages).toBe(1);
 await route.restore(view({pages:3}));
 await route.updateView({...route.snapshot().view!,query:'kombi'});expect(route.snapshot().view?.pages).toBe(1);
 await route.restore(view({pages:3}));
 await route.settleMap([19.5,44.5,20.5,45.5]);expect(route.snapshot().view?.pages).toBe(1);
 await route.restore(view({pages:3}));
 await route.showAll();expect(route.snapshot().view?.pages).toBe(1);
});

it('paging counts reads, and a screen handing back an older view cannot rewind the depth',async()=>{
 const h=pagedHarness(6),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view());const older=route.snapshot().view!;
 await route.nextPage();await route.nextPage();expect(route.snapshot().view?.pages).toBe(3);
 const result=await route.updateView({...older,sheet:'full',listOffset:900});
 expect(result.kind).toBe('passive');
 expect(route.snapshot().view).toMatchObject({pages:3,sheet:'full',listOffset:900});
});

it('a first visit with no camera reads PAGE, seeds MAP over the world and then reads the markers over the whole bounds',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 const result=await route.open({...initialMarketplaceView(),mode:'map'});
 expect(result.kind).toBe('applied');expect(h.calls.map(x=>x.mode)).toEqual(['PAGE','MAP','MAP']);
 expect((h.calls[1] as any).bounds).toEqual([-180,-90,180,90]);expect((h.calls[2] as any).bounds).toEqual([19,44,21,46]);
 expect(route.snapshot().screen.mapMarkers).toHaveLength(1);expect(route.snapshot().screen.mapWholeBounds).toEqual([19,44,21,46]);
});

it('refreshMap reads only the MAP over the region now on screen and keeps the route view, the list and the peek',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view({sheet:'full',listOffset:420}));
 await route.selectMarker(route.snapshot().screen.mapMarkers[0]);
 const before=route.snapshot(),calls=h.calls.length;
 const result=await route.refreshMap([19.7,45.2,20,45.4]);
 expect(result.kind).toBe('applied');expect(h.calls.slice(calls).map(x=>x.mode)).toEqual(['MAP']);
 expect((h.calls[calls] as any).bounds).toEqual([19.7,45.2,20,45.4]);
 const after=route.snapshot();
 expect(after.view).toEqual(before.view);expect(after.screen.items).toEqual(before.screen.items);
 expect(after.screen.peek).toEqual(before.screen.peek);expect(after.selectedMarkerKey).toBe(before.selectedMarkerKey);
 expect(after.generation).toBe(before.generation);
 // Where the map was already read, nothing is read again.
 const again=await route.refreshMap([19.7,45.2,20,45.4]);expect(again.kind).toBe('noop');expect(h.calls).toHaveLength(calls+1);
});

it('refreshMap before any view and after retire reads nothing',async()=>{
 const h=harness(),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 expect((await route.refreshMap([19,44,21,46])).kind).toBe('noop');
 await route.open(view());route.retire();
 expect((await route.refreshMap([19.7,45.2,20,45.4])).kind).toBe('noop');expect(h.calls.map(x=>x.mode)).toEqual(['PAGE','MAP']);
});

// Journey #6: after a place was applied the list was empty for ~2 s. A commit made in the middle of a read published the owner's emptied state, which the screen
// reads as "nothing found" and answered by raising the list over the map. While a read replaces the picture, the last complete one stays.
function gated(){
 const h=harness(),gate:{page:ReturnType<typeof deferred<void>>|null,map:ReturnType<typeof deferred<void>>|null}={page:null,map:null};
 const transport=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{
  h.calls.push(request);
  if(request.mode==='MAP'){await gate.map?.promise;return map(request.bounds);}
  if(request.mode==='PLACES')return places();
  if(request.mode==='EXACT_PUBLIC')return exact();
  await gate.page?.promise;
  return page(request.limit===1?19:gate.page?7:12);
 });
 return {h,gate,transport};
}
it('a read that replaces the list keeps the last complete picture on the snapshot, with the new view, until the new one lands whole',async()=>{
 const {h,gate,transport}=gated(),route=createDiscoveryV1RouteCoordinator(transport,h.overlay);
 await route.open(view());
 const before=route.snapshot().screen;expect(before.items).toHaveLength(1);expect(before.mapMarkers).toHaveLength(1);expect(before.counts?.listed).toBe(12);
 gate.page=deferred<void>();
 const reading=route.updateView(view({query:'kombi'}));
 await Promise.resolve();await Promise.resolve();
 const during=route.snapshot();
 expect(during.view).toMatchObject({query:'kombi'});
 expect(during.screen.items).toHaveLength(1);expect(during.screen.mapMarkers).toHaveLength(1);expect(during.screen.counts?.listed).toBe(12);
 gate.page.resolve();const result=await reading;expect(result.kind).toBe('applied');
 const after=route.snapshot().screen;expect(after.counts?.listed).toBe(7);expect(after.items).toHaveLength(1);expect(after.mapMarkers).toHaveLength(1);
});
it('a quiet map refresh keeps the markers on the snapshot until the new ones land, and a failing read never leaves the old picture stuck',async()=>{
 const {h,gate,transport}=gated(),route=createDiscoveryV1RouteCoordinator(transport,h.overlay);
 await route.open(view());
 gate.map=deferred<void>();
 const refreshing=route.refreshMap([19.5,44.5,20.5,45.5]);
 await Promise.resolve();await Promise.resolve();
 expect(route.snapshot().screen.mapMarkers).toHaveLength(1);
 gate.map.resolve();await refreshing;
 expect(route.snapshot().screen.mapMarkers).toHaveLength(1);
 // A read that fails releases the hold: the snapshot is the live one again.
 const failing=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{if(request.mode==='PAGE'&&request.limit!==1&&(request as any).filter?.text==='boom')throw new Error('DISCOVERY_V1_TRANSPORT_FAILED');return h.transport(request);});
 const other=createDiscoveryV1RouteCoordinator(failing,h.overlay);
 await other.open(view());
 await expect(other.updateView(view({query:'boom'}))).rejects.toThrow('DISCOVERY_V1_TRANSPORT_FAILED');
 expect(other.snapshot().screen.items).toHaveLength(0);
});
// Independent review, finding 3: the hold wrapped reads that only ADD to the picture too. A next page that landed during a map refresh or a selection stayed hidden behind the
// old picture until that read ended (for ever, when it never ended).
it('a map refresh or a selection in flight holds nothing back: a page another read lands meanwhile is shown at once',async()=>{
 const paged=pagedHarness(4),gate={map:null as ReturnType<typeof deferred<void>>|null,exact:null as ReturnType<typeof deferred<void>>|null};
 const transport=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{
  if(request.mode==='MAP'&&gate.map)await gate.map.promise;
  if(request.mode==='EXACT_PUBLIC'&&gate.exact)await gate.exact.promise;
  return paged.transport(request);
 });
 const route=createDiscoveryV1RouteCoordinator(transport,paged.overlay);
 await route.open(view());expect(route.snapshot().screen.items).toHaveLength(1);
 const marker=route.snapshot().screen.mapMarkers[0];
 gate.map=deferred<void>();
 const refreshing=route.refreshMap([19.5,44.5,20.5,45.5]);
 await Promise.resolve();await Promise.resolve();
 await route.nextPage();expect(route.snapshot().screen.items).toHaveLength(2);
 gate.map.resolve();await refreshing;
 gate.exact=deferred<void>();
 const selecting=route.selectMarker(marker);
 await Promise.resolve();await Promise.resolve();
 await route.nextPage();expect(route.snapshot().screen.items).toHaveLength(3);
 gate.exact.resolve();expect((await selecting).kind).toBe('TASK');
 expect(route.snapshot().screen.peek).toMatchObject({kind:'TASK'});
});
// Independent review, finding 6: a scope change that began before a selection took the selection away when it landed, though the screen still showed its card.
it('an older scope change that lands after a newer selection does not take that selection away',async()=>{
 for(const change of ['settleMap','showPoint','showAll'] as const){
  const {h,gate,transport}=gated(),route=createDiscoveryV1RouteCoordinator(transport,h.overlay);
  await route.open(view());
  const marker=route.snapshot().screen.mapMarkers[0];
  gate.page=deferred<void>();
  const changing=change==='settleMap'?route.settleMap([19.5,44.5,20.5,45.5]):change==='showPoint'?route.showPoint({lat:45.25,lng:19.83}):route.showAll();
  await Promise.resolve();await Promise.resolve();
  expect(await route.selectMarker(marker)).toMatchObject({kind:'TASK',applied:true});
  gate.page.resolve();expect((await changing).kind).toBe('applied');
  expect(route.snapshot().selectedMarkerKey).toBe(marker.key);
  expect(route.snapshot().view).toMatchObject({selectedId:ID,selectedPlace:null,sheet:'peek'});
  expect(route.snapshot().screen.peek).toMatchObject({kind:'TASK'});
 }
});
it('a scope change with no newer selection still takes the selection with it',async()=>{
 const {h,gate,transport}=gated(),route=createDiscoveryV1RouteCoordinator(transport,h.overlay);
 await route.open(view());await route.selectMarker(route.snapshot().screen.mapMarkers[0]);
 expect(route.snapshot().view).toMatchObject({selectedId:ID});
 gate.page=deferred<void>();
 const changing=route.showAll();await Promise.resolve();await Promise.resolve();
 gate.page.resolve();await changing;
 expect(route.snapshot().selectedMarkerKey).toBeNull();expect(route.snapshot().view).toMatchObject({selectedId:null,selectedPlace:null});
});
// The same rule for the return: the selection the screen was left with is put back only if the person has chosen nothing since.
it('a saved selection is not put back over a pin the person touched while the read was in flight',async()=>{
 const ID2='33333333-3333-4333-8333-333333333333',gate={page:null as ReturnType<typeof deferred<void>>|null,exact:null as ReturnType<typeof deferred<void>>|null};
 const two=(bounds:[number,number,number,number]):any=>({...map(bounds),counts:{kind:'exact_live',observedAt:AT,mapped:2,withoutPoint:0},
  buckets:[{kind:'TASK',key:'task:'+ID,point:{lat:45.25,lng:19.83},taskId:ID},{kind:'TASK',key:'task:'+ID2,point:{lat:45.3,lng:19.9},taskId:ID2}]});
 const h=harness(),transport=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{
  if(request.mode==='MAP')return two(request.bounds);
  if(request.mode==='EXACT_PUBLIC'){if(request.needId===ID2)await gate.exact?.promise;return {...exact(),items:[{...item(),id:request.needId}]};}
  await gate.page?.promise;return page(12);
 });
 const route=createDiscoveryV1RouteCoordinator(transport,h.overlay);
 await route.open(view());
 const [first,second]=route.snapshot().screen.mapMarkers;expect(second).toBeDefined();
 await route.selectMarker(first);expect(route.snapshot().view).toMatchObject({selectedId:ID});
 gate.page=deferred<void>();gate.exact=deferred<void>();
 const reading=route.updateView({...route.snapshot().view!,query:'kombi'});
 await Promise.resolve();await Promise.resolve();
 const touching=route.selectMarker(second);
 await Promise.resolve();await Promise.resolve();
 gate.page.resolve();await reading;
 gate.exact.resolve();
 expect(await touching).toMatchObject({kind:'TASK',applied:true});
 expect(route.snapshot().selectedMarkerKey).toBe(second.key);expect(route.snapshot().view).toMatchObject({selectedId:ID2});
 expect(route.snapshot().screen.peek).toMatchObject({kind:'TASK'});
});
it('a read that drops the peek drops it at once, while a selection keeps the old peek until the new one lands',async()=>{
 const {h,gate,transport}=gated(),route=createDiscoveryV1RouteCoordinator(transport,h.overlay);
 await route.open(view());
 const marker=route.snapshot().screen.mapMarkers[0];await route.selectMarker(marker);
 expect(route.snapshot().screen.peek).toMatchObject({kind:'TASK'});
 gate.page=deferred<void>();
 const reading=route.showAll();
 await Promise.resolve();await Promise.resolve();
 expect(route.snapshot().screen.peek).toBeNull();expect(route.snapshot().screen.items).toHaveLength(1);
 gate.page.resolve();await reading;
});

// Independent client review, finding 1: the server's anchor lives 30 minutes (P6_ANCHOR_EXPIRED); a screen left open longer got the generic read failure on every later read.
/**
 * pagedHarness plus the server's expiry: after `expire()` a request that carries the old anchor is refused with the transport's stable code (and is recorded), and a PAGE request
 * WITHOUT an anchor (a fresh open) is answered and starts a new anchor. `stubborn` never clears the expiry, to prove the renewal is one attempt and never a loop.
 */
function expiringPaged(pages:number,stubborn=false){
 const h=pagedHarness(pages);let expired=false;
 const transport=jest.fn(async(request:DiscoveryV1OwnerRequest)=>{
  const anchored=(request as any).anchor!=null;
  if(expired&&anchored){h.calls.push(request);throw new Error('DISCOVERY_V1_ANCHOR_EXPIRED');}
  if(expired&&!stubborn&&request.mode==='PAGE'&&!anchored)expired=false;
  return h.transport(request);
 });
 return {...h,transport,expire:()=>{expired=true;}};
}
const shape=(calls:any[])=>calls.filter(x=>x.mode==='PAGE').map(x=>[x.anchor?'anchor':'fresh',x.after?x.after.id:null]);

it('an anchor that expired while the screen stayed open is renewed once at the depth already read, and the page that was asked for is delivered',async()=>{
 const h=expiringPaged(6),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.restore(view({sheet:'full',listOffset:900,pages:3}));
 expect(route.snapshot().screen.items).toHaveLength(3);
 h.expire();const before=h.calls.length;
 const result=await route.nextPage();
 expect(result.kind).toBe('applied');
 // the refused read (never retried with the old anchor), ONE fresh open, the depth read again on the new anchor, then the page that was asked for
 expect(shape(h.calls.slice(before))).toEqual([['anchor',rowId(2)],['fresh',null],['anchor',rowId(0)],['anchor',rowId(1)],['anchor',rowId(2)]]);
 expect(route.snapshot().screen.items.map(x=>x.id)).toEqual([0,1,2,3].map(rowId));
 expect(route.snapshot().view).toMatchObject({pages:4,sheet:'full',listOffset:900});
 expect(route.snapshot().loadingMore).toBe(false);
});

it('the renewal is one attempt: a server that keeps refusing surfaces its error and is not asked again in a loop',async()=>{
 const h=expiringPaged(6,true),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view());h.expire();const before=h.calls.length;
 await expect(route.nextPage()).rejects.toThrow('DISCOVERY_V1_ANCHOR_EXPIRED');
 const later=shape(h.calls.slice(before));
 expect(later.filter(x=>x[0]==='fresh')).toHaveLength(1);expect(later.length).toBeLessThanOrEqual(3);
 expect(route.snapshot().loadingMore).toBe(false);
});

it('an error that is not an expired anchor is not renewed: it reaches the screen as before',async()=>{
 const h=pagedHarness(6,1),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view());const before=h.calls.length;
 await expect(route.nextPage()).rejects.toThrow('PAGE_FAILED');
 expect(shape(h.calls.slice(before)).filter(x=>x[0]==='fresh')).toHaveLength(0);
});

it('a map settle after the anchor expired opens the area with a fresh anchor instead of failing, and keeps the view state',async()=>{
 const h=expiringPaged(3),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view({sheet:'full',listOffset:420}));h.expire();const before=h.calls.length;
 const result=await route.settleMap([19.5,44.5,20.5,45.5]);
 expect(result.kind).toBe('applied');
 const fresh=(h.calls.slice(before).filter(x=>x.mode==='PAGE'&&!(x as any).anchor) as any[]);
 expect(fresh).toHaveLength(1);expect(fresh[0].scope).toEqual({kind:'AREA',bounds:[19.5,44.5,20.5,45.5]});
 expect(route.snapshot().view).toMatchObject({area:[19.5,44.5,20.5,45.5],pages:1,sheet:'full',listOffset:420});
});

it('showing everything or a place after the anchor expired opens that scope with a fresh anchor',async()=>{
 const h=expiringPaged(3),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view());await route.settleMap([19.5,44.5,20.5,45.5]);
 h.expire();let before=h.calls.length;
 expect((await route.showAll()).kind).toBe('applied');
 const all=(h.calls.slice(before).filter(x=>x.mode==='PAGE'&&!(x as any).anchor) as any[]);
 expect(all).toHaveLength(1);expect(all[0].scope).toEqual({kind:'ALL'});expect(route.snapshot().view?.area).toBeNull();
 h.expire();before=h.calls.length;
 const point={lat:45.25,lng:19.83};
 expect((await route.showPoint(point)).kind).toBe('applied');
 const at=(h.calls.slice(before).filter(x=>x.mode==='PAGE'&&!(x as any).anchor) as any[]);
 expect(at).toHaveLength(1);expect(at[0].scope.kind).toBe('POINT_LIST');expect(route.snapshot().view?.pinPlace).not.toBeNull();
});

it('a map refresh after the anchor expired renews the traversal instead of failing',async()=>{
 const h=expiringPaged(3),route=createDiscoveryV1RouteCoordinator(h.transport,h.overlay);
 await route.open(view({sheet:'half',listOffset:200}));h.expire();const before=h.calls.length;
 const result=await route.refreshMap([10,40,12,42]);
 expect(result.kind).toBe('applied');
 expect(h.calls.slice(before).filter(x=>x.mode==='PAGE'&&!(x as any).anchor)).toHaveLength(1);
 expect(route.snapshot().screen.items).toHaveLength(1);expect(route.snapshot().view).toMatchObject({sheet:'half',listOffset:200});
});
