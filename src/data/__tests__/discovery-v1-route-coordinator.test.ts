import { createDiscoveryV1RouteCoordinator, discoveryV1RouteIntentKey } from '../discoveryV1RouteCoordinator';
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
