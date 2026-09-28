import { createDiscoveryV1ScreenSession } from '../discoveryV1ScreenSession';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';
import { initialMarketplaceView } from '../marketplaceView';

const AT='2026-09-28T10:00:00.000000Z',EX='2026-09-28T10:30:00.000000Z',A='a'.repeat(32),B='b'.repeat(32);
const ID1='11111111-1111-4111-8111-111111111111',ID2='33333333-3333-4333-8333-333333333333',PROFILE='22222222-2222-4222-8222-222222222222';
const anchor=()=>({version:'DISCOVERY_V1',filterKey:A,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const item=(id=ID1):any=>({id,revision:1,sortAt:AT,publishedAt:AT,title:'Task '+id.slice(0,4),category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:null,criticalConditions:null});
const page=(ids=[ID1],more=false):any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:A,anchor:anchor(),items:ids.map(item),hasMore:more,
 nextCursor:more?{scopeKey:B,section:0,sortAt:AT,id:ids[ids.length-1]}:null,
 counts:{kind:'exact_live',observedAt:AT,mapped:2,listed:2,inArea:2,withoutPoint:0,undated:0},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['OFFERS']}});
const map=(bounds=[19,44,21,46] as [number,number,number,number]):any=>({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:A,anchor:anchor(),
 coverageBounds:bounds,effectiveGrid:8,wholeBounds:[19,44,21,46],buckets:[
  {kind:'TASK',key:'task:'+ID1,point:{lat:45.25,lng:19.83},taskId:ID1},
  {kind:'PLACE',key:'place:45.26:19.84',point:{lat:45.26,lng:19.84},taskCount:2},
  {kind:'CLUSTER',key:'cluster:1',point:{lat:45.3,lng:19.9},taskCount:5,distinctPointCount:3,memberBounds:[19.8,45.2,20,45.4]}],
 counts:{kind:'exact_live',observedAt:AT,mapped:8,withoutPoint:0}});
const exact=(id=ID1):any=>({version:'DISCOVERY_V1',mode:'EXACT_PUBLIC',asOf:AT,items:[item(id)],hasMore:false,nextCursor:null});
const places=(more=false):any=>({version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:A,anchor:anchor(),
 items:[{key:'novi sad, liman',text:'Novi Sad, Liman',count:2}],hasMore:more,nextCursor:more?{count:2,text:'Novi Sad, Liman',key:'novi sad, liman'}:null,
 counts:{kind:'exact_live',observedAt:AT,everywhere:8,inArea:null}});
type P={request:DiscoveryV1OwnerRequest;signal:AbortSignal;resolve:(v:any)=>void};
const h=()=>{const pending:P[]=[];return {pending,transport:(request:DiscoveryV1OwnerRequest,signal:AbortSignal)=>new Promise<any>(resolve=>pending.push({request,signal,resolve}))};};
const wait=async(x:{pending:P[]},index:number)=>{for(let n=0;n<30&&!x.pending[index];n++)await Promise.resolve();if(!x.pending[index])throw new Error('P6_TEST_PENDING_'+index);};
const view=()=>({...initialMarketplaceView(),mode:'map' as const,viewport:{center:[20,45] as [number,number],zoom:10,bounds:[19,44,21,46] as [number,number,number,number]}});

it('opens PAGE first then MAP with the exact accepted anchor',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());
 expect(x.pending[0].request.mode).toBe('PAGE');x.pending[0].resolve(page());
 await wait(x,1);expect(x.pending[1].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[19,44,21,46]}));
 x.pending[1].resolve(map());const result=await opening;expect(result.kind).toBe('applied');
 expect(result.snapshot.items).toHaveLength(1);expect(result.snapshot.mapMarkers).toHaveLength(3);
});
it('a settled map move changes PAGE scope and MAP coverage but keeps the browsing anchor',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const moved=s.settleMap([19.5,44.5,20.5,45.5]);expect(x.pending[2].request).toEqual(expect.objectContaining({mode:'PAGE',anchor:anchor(),scope:{kind:'AREA',bounds:[19.5,44.5,20.5,45.5]}}));
 expect(x.pending[3].request).toEqual(expect.objectContaining({mode:'MAP',anchor:anchor(),bounds:[19.5,44.5,20.5,45.5]}));
 x.pending[2].resolve(page([ID2]));x.pending[3].resolve(map([19.5,44.5,20.5,45.5]));const r=await moved;
 expect(r.snapshot.view?.area).toEqual([19.5,44.5,20.5,45.5]);expect(r.snapshot.items[0].id).toBe(ID2);
});
it('new filter session fences an old page that resolves later',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport);const old=s.open(view());
 const newer=s.open({...view(),query:'novo'});expect(x.pending[0].signal.aborted).toBe(true);
 x.pending[1].resolve(page([ID2]));await wait(x,2);x.pending[2].resolve(map());await newer;
 x.pending[0].resolve({bad:'old'});expect((await old).kind).toBe('stale');expect(s.snapshot().items[0].id).toBe(ID2);
});
it('TASK map marker resolves exact public data before exposing peek',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const marker=s.snapshot().mapMarkers[0],selected=s.selectMarker(marker);expect(x.pending[2].request).toEqual({mode:'EXACT_PUBLIC',needId:ID1});
 x.pending[2].resolve(exact());expect((await selected)).toEqual({kind:'TASK',applied:true});expect(s.snapshot().peek).toMatchObject({kind:'TASK',item:{id:ID1}});
});
it('PLACE map marker uses separate POINT_MEMBERS and never replaces main list',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const marker=s.snapshot().mapMarkers[1],selected=s.selectMarker(marker);expect((x.pending[2].request as any).scope).toEqual({kind:'POINT_MEMBERS',point:{lat:45.26,lng:19.84}});
 x.pending[2].resolve(page([ID2]));await selected;expect(s.snapshot().items[0].id).toBe(ID1);expect(s.snapshot().peek).toMatchObject({kind:'PLACE',items:[{id:ID2}]});
});
it('a newer cross-kind selection fences an older PLACE response',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const old=s.selectMarker(s.snapshot().mapMarkers[1]),fresh=s.selectMarker(s.snapshot().mapMarkers[0]);
 expect(x.pending[2].signal.aborted).toBe(true);
 x.pending[3].resolve(exact());await fresh;x.pending[2].resolve(page([ID2]));expect((await old).kind).toBe('stale');
 expect(s.snapshot().peek).toMatchObject({kind:'TASK'});expect(s.snapshot().memberHasMore).toBe(false);
});
it('CLUSTER is navigation geometry only and performs no task read',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const before=x.pending.length;expect(await s.selectMarker(s.snapshot().mapMarkers[2])).toEqual({kind:'CLUSTER',bounds:[19.8,45.2,20,45.4]});
 expect(x.pending).toHaveLength(before);
});
it('showPoint narrows list by POINT_LIST without overwriting server map buckets',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page());await wait(x,1);x.pending[1].resolve(map());await opening;
 const narrow=s.showPoint({lat:45.26,lng:19.84});expect((x.pending[2].request as any).scope).toEqual({kind:'POINT_LIST',point:{lat:45.26,lng:19.84}});
 x.pending[2].resolve(page([ID2]));await narrow;expect(s.snapshot().items[0].id).toBe(ID2);expect(s.snapshot().mapMarkers).toHaveLength(3);
});
it('PAGE and PLACES continuations remain independent',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());x.pending[0].resolve(page([ID1],true));await wait(x,1);x.pending[1].resolve(map());await opening;
 const place=s.queryPlaces('nov',null,3);x.pending[2].resolve(places(true));await place;
 const nextPage=s.nextPage(),nextPlaces=s.nextPlaces();expect(x.pending[3].request.mode).toBe('PAGE');expect(x.pending[4].request.mode).toBe('PLACES');
 x.pending[3].resolve(page([ID2],false));x.pending[4].resolve({...places(false),items:[{key:'beograd',text:'Beograd',count:1}]});
 await Promise.all([nextPage,nextPlaces]);expect(s.snapshot().items.map(i=>i.id)).toEqual([ID1,ID2]);expect(s.snapshot().places).toHaveLength(2);
});
it('retire clears screen state and old responses cannot return it',async()=>{
 const x=h(),s=createDiscoveryV1ScreenSession(x.transport),opening=s.open(view());s.retire();x.pending[0].resolve(page());
 expect((await opening).kind).toBe('stale');expect(s.snapshot()).toMatchObject({active:false,view:null,items:[],mapMarkers:[],peek:null});
});
