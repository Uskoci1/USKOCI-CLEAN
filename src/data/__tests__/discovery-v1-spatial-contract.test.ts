import { decodeDiscoveryV1Map, decodeDiscoveryV1Places } from '../discoveryV1SpatialContract';

const AT='2026-09-28T10:00:00.000000Z', EX='2026-09-28T10:30:00.000000Z', F='a'.repeat(32);
const anchor=()=>({version:'DISCOVERY_V1',filterKey:F,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const map=()=>({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:F,anchor:anchor(),coverageBounds:[19.7,45.1,20.0,45.4],
  effectiveGrid:12,wholeBounds:[19.5,44.9,20.2,45.6],buckets:[
    {kind:'TASK',key:'task:1',point:{lat:45.25,lng:19.83},taskId:'11111111-1111-4111-8111-111111111111'},
    {kind:'PLACE',key:'place:1',point:{lat:45.26,lng:19.84},taskCount:3},
    {kind:'CLUSTER',key:'cluster:1',point:{lat:45.27,lng:19.85},taskCount:8,distinctPointCount:4,memberBounds:[19.82,45.24,19.9,45.31]},
  ],counts:{kind:'exact_live',observedAt:AT,mapped:20,withoutPoint:8}});
const places=()=>({version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:F,anchor:anchor(),items:[
  {key:'novi sad, liman',text:'Novi Sad, Liman',count:8},{key:'beograd, vračar',text:'Beograd, Vračar',count:4}],
  hasMore:true,nextCursor:{count:4,key:'beograd, vračar'},counts:{kind:'exact_live',observedAt:AT,everywhere:20,inArea:12}});

it('decodes bounded TASK/PLACE/CLUSTER map buckets without TaskCard/private payload',()=>{
  const value=decodeDiscoveryV1Map(map());
  expect(value.buckets).toHaveLength(3);expect(value.counts).toEqual(expect.objectContaining({mapped:20,withoutPoint:8}));
  expect(value.buckets[0]).toEqual(expect.objectContaining({kind:'TASK',taskId:'11111111-1111-4111-8111-111111111111'}));
});
it('rejects more than 256 buckets and bucket totals beyond mapped count',()=>{
  const tooMany=map();tooMany.buckets=Array.from({length:257},(_,i)=>({kind:'TASK',key:'t'+i,point:{lat:45.25,lng:19.83},taskId:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`}));
  expect(()=>decodeDiscoveryV1Map(tooMany)).toThrow('DISCOVERY_V1_MAP_BUCKETS');
  const over=map();over.counts.mapped=5;expect(()=>decodeDiscoveryV1Map(over)).toThrow('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
});
it('rejects private/extra map payload and points outside requested coverage',()=>{
  const extra=map();(extra.buckets[0] as any).title='private-ish card field';expect(()=>decodeDiscoveryV1Map(extra)).toThrow('DISCOVERY_V1_MAP_BUCKET_SHAPE');
  const outside=map();outside.buckets[0].point={lat:44.0,lng:19.83};expect(()=>decodeDiscoveryV1Map(outside)).toThrow('DISCOVERY_V1_MAP_BUCKET_OUTSIDE');
});
it('accepts wrapped longitude coverage without inventing another coordinate model',()=>{
  const wrapped=map();wrapped.coverageBounds=[170,-20,-170,20];wrapped.wholeBounds=null;
  wrapped.buckets=[{kind:'TASK',key:'wrapped',point:{lat:0,lng:179.99},taskId:'11111111-1111-4111-8111-111111111111'}];
  wrapped.counts={kind:'exact_live',observedAt:AT,mapped:1,withoutPoint:0};
  expect(decodeDiscoveryV1Map(wrapped).buckets).toHaveLength(1);
});
it('decodes locality facets using the same Serbian display key and exact live counts',()=>{
  const value=decodeDiscoveryV1Places(places(),30);
  expect(value.items.map(x=>x.key)).toEqual(['novi sad, liman','beograd, vračar']);
  expect(value.counts).toMatchObject({everywhere:20,inArea:12});
});
it('rejects place-key drift, duplicate facets and fake continuation state',()=>{
  const drift=places();drift.items[0].key='liman';expect(()=>decodeDiscoveryV1Places(drift)).toThrow('DISCOVERY_V1_PLACE_KEY_MISMATCH');
  const dup=places();dup.items[1]={...dup.items[0]};expect(()=>decodeDiscoveryV1Places(dup)).toThrow('DISCOVERY_V1_PLACE_DUPLICATE');
  const cursor=places();cursor.hasMore=false;expect(()=>decodeDiscoveryV1Places(cursor)).toThrow('DISCOVERY_V1_PLACE_CURSOR_PRESENCE');
});
it('rejects facet order/count contradictions rather than sorting or repairing server output',()=>{
  const order=places();order.items=[{key:'beograd, vračar',text:'Beograd, Vračar',count:4},{key:'novi sad, liman',text:'Novi Sad, Liman',count:8}];
  expect(()=>decodeDiscoveryV1Places(order)).toThrow('DISCOVERY_V1_PLACE_ORDER');
  const counts=places();counts.counts.inArea=21;expect(()=>decodeDiscoveryV1Places(counts)).toThrow('DISCOVERY_V1_PLACE_COUNTS');
});
