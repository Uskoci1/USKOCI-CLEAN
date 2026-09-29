import { createDiscoveryV1SearchOwner, discoveryV1SearchPreviewKey } from '../discoveryV1SearchOwner';
import { initialMarketplaceView, type MarketplaceView } from '../marketplaceView';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';

const AT='2026-09-29T05:00:00.000000Z',EX='2026-09-29T05:30:00.000000Z',A='a'.repeat(32),B='b'.repeat(32);
const ID='11111111-1111-4111-8111-111111111111',PROFILE='22222222-2222-4222-8222-222222222222';
const anchor=()=>({version:'DISCOVERY_V1',filterKey:A,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const item=():any=>({id:ID,revision:1,sortAt:AT,publishedAt:AT,title:'Selidba',category:'Selidbe',status:'PUBLISHED',urgent:false,
 scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',taskTimezone:'Europe/Belgrade',
 verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},
 requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],requiredLicenses:[],minimumExperienceYears:null,
 priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,responseDeadline:null,acceptsApplications:true,
 publicTopology:null,criticalConditions:null});
const page=(listed=42):any=>({version:'DISCOVERY_V1',mode:'PAGE',asOf:AT,filterKey:A,anchor:anchor(),items:[item()],hasMore:true,
 nextCursor:{scopeKey:B,section:0,sortAt:AT,id:ID},counts:{kind:'exact_live',observedAt:AT,mapped:80,listed,inArea:30,withoutPoint:5,undated:7},
 availability:{hasKnownWorkMode:true,hasKnownSchedule:true,priceModes:['MY_PRICE','OFFERS']}});
const places=(rows=[{key:'novi sad, liman',text:'Novi Sad, Liman',count:9}],more=true):any=>({
 version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:A,anchor:anchor(),items:rows,hasMore:more,
 nextCursor:more?{count:rows[rows.length-1].count,text:rows[rows.length-1].text,key:rows[rows.length-1].key}:null,
 counts:{kind:'exact_live',observedAt:AT,everywhere:80,inArea:23}});
type Pending={request:DiscoveryV1OwnerRequest;signal:AbortSignal;resolve:(v:unknown)=>void;reject:(e?:unknown)=>void};
const harness=()=>{const pending:Pending[]=[];return{pending,transport:(request:DiscoveryV1OwnerRequest,signal:AbortSignal)=>new Promise<unknown>((resolve,reject)=>pending.push({request,signal,resolve,reject}))};};
const view=(patch:Partial<MarketplaceView>={}):MarketplaceView=>({...initialMarketplaceView(),mode:'map',viewport:{center:[19.8,45.2],zoom:11,bounds:[19,44,21,46]},...patch});

it('uses PAGE exact counts and PLACES facets instead of loaded-row length',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v=view({query:'nov',when:'tomorrow',price:'OFFERS'});
 const read=owner.preview(v,[19,44,21,46],3);
 expect(h.pending.map(x=>x.request.mode)).toEqual(['PAGE','PLACES']);
 expect(h.pending[0].request).toMatchObject({mode:'PAGE',limit:1,after:null});
 expect(h.pending[1].request).toMatchObject({mode:'PLACES',prefix:'nov',facetArea:[19,44,21,46],limit:3,after:null});
 h.pending[0].resolve(page(42));h.pending[1].resolve(places());
 const result=await read;expect(result.kind).toBe('applied');
 expect(owner.snapshot()).toMatchObject({status:'ready',count:42,undated:7,everywhere:80,inMapArea:23,placeHasMore:true,facetError:false});
 expect(owner.snapshot().places).toEqual([{key:'novi sad, liman',text:'Novi Sad, Liman',count:9}]);
 expect(owner.snapshot().key).toBe(discoveryV1SearchPreviewKey(v,[19,44,21,46]));
});

it('a newer draft fences an older PAGE and PLACES pair even if abort is ignored',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 const old=owner.preview(view({query:'staro'}),null,3),fresh=owner.preview(view({query:'novo'}),null,3);
 expect(h.pending[0].signal.aborted).toBe(true);expect(h.pending[1].signal.aborted).toBe(true);
 h.pending[2].resolve(page(6));h.pending[3].resolve(places([{key:'novi sad',text:'Novi Sad',count:6}],false));
 expect((await fresh).kind).toBe('applied');
 h.pending[0].resolve({bad:'old'});h.pending[1].resolve({bad:'old'});
 expect((await old).kind).toBe('stale');expect(owner.snapshot().count).toBe(6);
});

it('PLACES continuation retains prefix facet area and cursor, then deduplicates keys',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport);
 const first=owner.preview(view({query:'nov'}),[19,44,21,46],2);
 h.pending[0].resolve(page());h.pending[1].resolve(places([{key:'novi sad, liman',text:'Novi Sad, Liman',count:9}],true));await first;
 const next=owner.nextPlaces();expect(h.pending[2].request).toMatchObject({mode:'PLACES',prefix:'nov',facetArea:[19,44,21,46],
  after:{count:9,text:'Novi Sad, Liman',key:'novi sad, liman'}});
 h.pending[2].resolve(places([{key:'novi sad, liman',text:'Novi Sad, Liman',count:9},{key:'novi sad, centar',text:'Novi Sad, Centar',count:4}],false));
 expect((await next).kind).toBe('applied');
 expect(owner.snapshot().places.map(x=>x.key)).toEqual(['novi sad, liman','novi sad, centar']);
 expect(owner.snapshot().placeHasMore).toBe(false);
});

it('remote preview never asks for locality facets',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),v=view({where:'remote',query:'online'});
 const read=owner.preview(v,[19,44,21,46],10);
 expect(h.pending).toHaveLength(1);expect(h.pending[0].request.mode).toBe('PAGE');
 h.pending[0].resolve(page(11));await read;
 expect(owner.snapshot()).toMatchObject({status:'ready',count:11,places:[],placeHasMore:false,facetError:false,everywhere:null,inMapArea:null});
});

it('facet failure does not fabricate zero and does not disable an authoritative PAGE count',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),read=owner.preview(view(),null,10);
 h.pending[0].resolve(page(12));h.pending[1].reject(Error('facet down'));await read;
 expect(owner.snapshot()).toMatchObject({status:'ready',count:12,facetError:true,places:[],everywhere:null});
});

it('retire makes late responses stale and clears search truth',async()=>{
 const h=harness(),owner=createDiscoveryV1SearchOwner(h.transport),read=owner.preview(view(),null,10);
 owner.retire();h.pending[0].resolve(page());h.pending[1].resolve(places());
 expect((await read).kind).toBe('stale');expect(owner.snapshot()).toMatchObject({active:false,status:'idle',count:null,key:null});
});
