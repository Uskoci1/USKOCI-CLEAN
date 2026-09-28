import { createDiscoveryV1Owner, type DiscoveryV1OwnerRequest } from '../discoveryV1Owner';
import type { DiscoveryV1Filter } from '../discoveryV1Contract';

const AT='2026-09-28T10:00:00.000000Z', EX='2026-09-28T10:30:00.000000Z', PROFILE='22222222-2222-4222-8222-222222222222';
const A='a'.repeat(32), B='b'.repeat(32), ID1='11111111-1111-4111-8111-111111111111';
const ID2='33333333-3333-4333-8333-333333333333';
const filter=(text=''):DiscoveryV1Filter=>({text,price:'all',where:'any',places:1,when:'any',dates:null,place:null});
const anchor=(key=A)=>({version:'DISCOVERY_V1',filterKey:key,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const item=(id=ID1,title='Prenos ormara'):any=>({id,revision:3,sortAt:AT,publishedAt:AT,title,category:'selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:2,coveredSlots:0,requiredSkills:['Selidbe'],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'MY_PRICE',requesterPriceRsd:4000,priceBasis:'TOTAL',requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:{mode:'STATIONARY',start:{city:'Novi Sad',area:'Liman'}},criticalConditions:['Treći sprat']});
const page=(ids=[ID1],key=A,more=true):any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:key,anchor:anchor(key),
 items:ids.map(id=>item(id)),hasMore:more,nextCursor:more?{scopeKey:B,section:0,sortAt:AT,id:ids[ids.length-1]}:null,
 counts:{kind:'exact_live',observedAt:AT,mapped:10,listed:10,inArea:10,withoutPoint:0,undated:0},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['MY_PRICE','OFFERS']}});
const map=(bounds=[19.7,45.1,20,45.4],key=A):any=>({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:key,anchor:anchor(key),
 coverageBounds:bounds,effectiveGrid:12,wholeBounds:[19.5,44.9,20.2,45.6],buckets:[
  {kind:'TASK',key:'task:1',point:{lat:45.25,lng:19.83},taskId:ID1}],
 counts:{kind:'exact_live',observedAt:AT,mapped:1,withoutPoint:0}});
const places=(text='Novi Sad, Liman',key='novi sad, liman',filterKey=A,more=true):any=>({version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey,
 anchor:anchor(filterKey),items:[{key,text,count:8}],hasMore:more,nextCursor:more?{count:8,text,key}:null,
 counts:{kind:'exact_live',observedAt:AT,everywhere:20,inArea:null}});
const exact=(id=ID1):any=>({version:'DISCOVERY_V1',mode:'EXACT_PUBLIC',asOf:AT,items:[item(id)],hasMore:false,nextCursor:null});

type Pending={request:DiscoveryV1OwnerRequest;signal:AbortSignal;resolve:(value:unknown)=>void;reject:(reason?:unknown)=>void};
const harness=()=>{
 const pending:Pending[]=[];
 const transport=(request:DiscoveryV1OwnerRequest,signal:AbortSignal)=>new Promise<unknown>((resolve,reject)=>pending.push({request,signal,resolve,reject}));
 return {pending,transport};
};

it('fences an old filter response even when transport ignores abort',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);
 owner.begin(filter('staro'));const old=owner.firstPage();
 owner.begin(filter('novo'));expect(h.pending[0].signal.aborted).toBe(true);
 const current=owner.firstPage();h.pending[1].resolve(page([ID2]));expect((await current).kind).toBe('applied');
 h.pending[0].resolve({not:'even decoded'});expect((await old).kind).toBe('stale');
 expect(owner.snapshot().page?.items.map(x=>x.id)).toEqual([ID2]);
});
it('requires PAGE to own the shared PAGE/MAP anchor',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 expect((await owner.loadMap([19.7,45.1,20,45.4])).kind).toBe('noop');expect(h.pending).toHaveLength(0);
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const mapping=owner.loadMap([19.7,45.1,20,45.4]);expect((h.pending[1].request as any).anchor).toEqual(anchor());
 h.pending[1].resolve(map());expect((await mapping).kind).toBe('applied');
});
it('latest map wins and an older map cannot overwrite it',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const one=owner.loadMap([19.7,45.1,20,45.4]);const two=owner.loadMap([19.6,45,20.1,45.5]);
 expect(h.pending[1].signal.aborted).toBe(true);h.pending[2].resolve(map([19.6,45,20.1,45.5]));await two;
 h.pending[1].resolve({bad:'old'});expect((await one).kind).toBe('stale');
 expect(owner.snapshot().map?.coverageBounds).toEqual([19.6,45,20.1,45.5]);
});
it('scope change retires an in-flight continuation but keeps the browsing anchor',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const oldNext=owner.nextPage();owner.setScope({kind:'AREA',bounds:[19.7,45.1,20,45.4]});
 expect(h.pending[1].signal.aborted).toBe(true);
 const replacement=owner.firstPage();expect((h.pending[2].request as any).anchor).toEqual(anchor());
 h.pending[2].resolve(page([ID2]));await replacement;h.pending[1].resolve({bad:'old'});
 expect((await oldNext).kind).toBe('stale');expect(owner.snapshot().page?.items[0].id).toBe(ID2);
});
it('one cursor has one paging owner and duplicate rows across pages are deduplicated',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const next1=owner.nextPage(),next2=owner.nextPage();expect(next2).toBe(next1);expect(h.pending).toHaveLength(2);
 h.pending[1].resolve(page([ID1,ID2],A,false));
 const result=await next1;expect(result.kind).toBe('applied');
 expect(owner.snapshot().page?.items.map(x=>x.id)).toEqual([ID1,ID2]);
 expect((await owner.nextPage()).kind).toBe('noop');
});
it('rejects continuation anchor drift instead of silently restarting',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const next=owner.nextPage(),rejection=expect(next).rejects.toThrow('DISCOVERY_V1_OWNER_PAGE_ANCHOR_DRIFT');
 h.pending[1].resolve(page([ID2],'c'.repeat(32),false));
 await rejection;
 expect(owner.snapshot().page?.items.map(x=>x.id)).toEqual([ID1]);
});
it('new locality query fences old suggestions and paging keeps the exact first query context',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const old=owner.firstPlaces('nov');const fresh=owner.firstPlaces('beo',[19,44,21,46],3);
 expect(h.pending[0].signal.aborted).toBe(true);h.pending[1].resolve(places('Beograd, Vračar','beograd, vračar'));await fresh;
 h.pending[0].resolve({bad:'old'});expect((await old).kind).toBe('stale');
 const more=owner.nextPlaces();const request=h.pending[2].request as any;
 expect(request.prefix).toBe('beo');expect(request.facetArea).toEqual([19,44,21,46]);expect(request.after).toEqual({count:8,text:'Beograd, Vračar',key:'beograd, vračar'});
 h.pending[2].resolve({...places('Novi Sad, Liman','novi sad, liman',A,false),anchor:anchor(A)});
 expect((await more).kind).toBe('applied');expect(owner.snapshot().places?.items).toHaveLength(2);
});
it('one place cursor coalesces duplicate next requests',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPlaces('n');h.pending[0].resolve(places());await first;
 const a=owner.nextPlaces(),b=owner.nextPlaces();expect(a).toBe(b);expect(h.pending).toHaveLength(2);
 h.pending[1].resolve(places('Novi Sad, Centar','novi sad, centar',A,false));await a;
});
it('external account/focus guard can retire a response without trusting abort',async()=>{
 const h=harness();let current=true;const owner=createDiscoveryV1Owner(h.transport,()=>current);owner.begin(filter());
 const read=owner.firstPage();current=false;h.pending[0].resolve(page());expect((await read).kind).toBe('stale');expect(owner.snapshot().page).toBeNull();
});
it('retire is terminal, aborts reads and clears public snapshots',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const read=owner.firstPage();owner.retire();expect(h.pending[0].signal.aborted).toBe(true);h.pending[0].resolve(page());
 expect((await read).kind).toBe('stale');expect(owner.snapshot()).toEqual(expect.objectContaining({active:false,page:null,map:null,places:null,exact:null}));
 expect(()=>owner.begin(filter())).toThrow('DISCOVERY_V1_OWNER_RETIRED');
});
it('exact public read is latest-only and bound to the requested id',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const old=owner.readExact(ID1),fresh=owner.readExact(ID2);expect(h.pending[0].signal.aborted).toBe(true);
 h.pending[1].resolve(exact(ID2));expect((await fresh).kind).toBe('applied');h.pending[0].resolve({bad:'old'});
 expect((await old).kind).toBe('stale');expect(owner.snapshot().exact?.items[0].id).toBe(ID2);
});
it('copies caller filter and scope so later local mutation cannot rewrite an in-flight request',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport),f=filter('original');
 const scope:any={kind:'AREA',bounds:[19,44,21,46]};owner.begin(f,scope);const read=owner.firstPage();
 f.text='mutated';scope.bounds[0]=0;
 expect((h.pending[0].request as any).filter.text).toBe('original');expect((h.pending[0].request as any).scope.bounds).toEqual([19,44,21,46]);
 h.pending[0].resolve(page());await read;
});

it('POINT_MEMBERS has a separate paging owner and never replaces the main list',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const members=owner.firstMembers({lat:45.25,lng:19.83},2);
 expect((h.pending[1].request as any).scope).toEqual({kind:'POINT_MEMBERS',point:{lat:45.25,lng:19.83}});
 h.pending[1].resolve(page([ID2],A,false));expect((await members).kind).toBe('applied');
 expect(owner.snapshot().page?.items.map(x=>x.id)).toEqual([ID1]);expect(owner.snapshot().members?.items.map(x=>x.id)).toEqual([ID2]);
});
it('newer chosen place fences older POINT_MEMBERS response even when abort is ignored',async()=>{
 const h=harness(),owner=createDiscoveryV1Owner(h.transport);owner.begin(filter());
 const first=owner.firstPage();h.pending[0].resolve(page());await first;
 const old=owner.firstMembers({lat:45.25,lng:19.83},2);const fresh=owner.firstMembers({lat:44.82,lng:20.46},2);
 expect(h.pending[1].signal.aborted).toBe(true);h.pending[2].resolve(page([ID2],A,false));await fresh;
 h.pending[1].resolve({bad:'old'});expect((await old).kind).toBe('stale');expect(owner.snapshot().members?.items.map(x=>x.id)).toEqual([ID2]);
});
