import { decodeDiscoveryV1Map, decodeDiscoveryV1Places } from '../discoveryV1SpatialContract';

const AT='2026-09-28T10:00:00.000000Z', EX='2026-09-28T10:30:00.000000Z', F='a'.repeat(32);
const anchor=()=>({version:'DISCOVERY_V1',filterKey:F,timeAt:AT,publishedThrough:AT,expiresAt:EX});
const map=():any=>({version:'DISCOVERY_V1',mode:'MAP',asOf:AT,filterKey:F,anchor:anchor(),coverageBounds:[19.7,45.1,20.0,45.4],
  effectiveGrid:12,wholeBounds:[19.5,44.9,20.2,45.6],buckets:[
    {kind:'TASK',key:'task:1',point:{lat:45.25,lng:19.83},taskId:'11111111-1111-4111-8111-111111111111'},
    {kind:'PLACE',key:'place:1',point:{lat:45.26,lng:19.84},taskCount:3},
    {kind:'CLUSTER',key:'cluster:1',point:{lat:45.27,lng:19.85},taskCount:8,distinctPointCount:4,memberBounds:[19.82,45.24,19.9,45.31]},
  ],counts:{kind:'exact_live',observedAt:AT,mapped:20,withoutPoint:8}});
const places=():any=>({version:'DISCOVERY_V1',mode:'PLACES',asOf:AT,filterKey:F,anchor:anchor(),items:[
  {key:'novi sad, liman',text:'Novi Sad, Liman',count:8},{key:'beograd, vračar',text:'Beograd, Vračar',count:4}],
  hasMore:true,nextCursor:{count:4,text:'Beograd, Vračar',key:'beograd, vračar'},counts:{kind:'exact_live',observedAt:AT,everywhere:20,inArea:12}});

it('decodes bounded TASK/PLACE/CLUSTER map buckets without TaskCard/private payload',()=>{
  const value=decodeDiscoveryV1Map(map());
  expect(value.buckets).toHaveLength(3);expect(value.counts).toEqual(expect.objectContaining({mapped:20,withoutPoint:8}));
  expect(value.buckets[0]).toEqual(expect.objectContaining({kind:'TASK',taskId:'11111111-1111-4111-8111-111111111111'}));
});
it('rejects more than 256 buckets and bucket totals beyond mapped count',()=>{
  const tooMany=map();tooMany.buckets=Array.from({length:257},(_,i)=>({kind:'TASK',key:'t'+i,point:{lat:45.25,lng:19.83},taskId:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`}));
  expect(()=>decodeDiscoveryV1Map(tooMany)).toThrow('DISCOVERY_V1_MAP_BUCKETS');
  const over=map();over.counts={...over.counts,mapped:10,withoutPoint:0};expect(()=>decodeDiscoveryV1Map(over)).toThrow('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
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
  const driftCursor=places();driftCursor.nextCursor.text='Drugo mesto';expect(()=>decodeDiscoveryV1Places(driftCursor)).toThrow('DISCOVERY_V1_PLACE_CURSOR_KEY_MISMATCH');
});
it('rejects facet order/count contradictions rather than sorting or repairing server output',()=>{
  const order=places();order.items=[{key:'beograd, vračar',text:'Beograd, Vračar',count:4},{key:'novi sad, liman',text:'Novi Sad, Liman',count:8}];
  expect(()=>decodeDiscoveryV1Places(order)).toThrow('DISCOVERY_V1_PLACE_ORDER');
  const counts=places();counts.counts.inArea=21;expect(()=>decodeDiscoveryV1Places(counts)).toThrow('DISCOVERY_V1_PLACE_COUNTS');
});

// P6 guard: invalid server output must be refused, never repaired or sorted.
it.each([
 ['wrong count',(v:any)=>{v.nextCursor.count=3;}],
 ['earlier row',(v:any)=>{v.nextCursor={...v.items[0]};}],
 ['display drift with identical key',(v:any)=>{v.nextCursor.text='BEOGRAD, VRAČAR';}],
 ['empty continuation',(v:any)=>{v.items=[];}],
])('P6 guard: cursor must be the exact emitted tail: %s',(_name,corrupt)=>{
 const v=places();corrupt(v);expect(()=>decodeDiscoveryV1Places(v)).toThrow('DISCOVERY_V1_PLACE_CURSOR_TAIL');
});
it.each([
 ['one facet exceeds total',(v:any)=>{v.items[0].count=21;}],
 ['sum exceeds total',(v:any)=>{v.counts.everywhere=11;v.counts.inArea=null;}],
])('P6 guard: impossible locality counts: %s',(_name,corrupt)=>{
 const v=places();corrupt(v);expect(()=>decodeDiscoveryV1Places(v)).toThrow('DISCOVERY_V1_PLACE_COUNTS');
});
it('P6 guard: point-free tasks cannot contribute to spatial buckets',()=>{
 const v=map();v.counts.withoutPoint=9;expect(()=>decodeDiscoveryV1Map(v)).toThrow('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
});
it('P6 guard: aggregated bucket counts must stay safe integers',()=>{
 const v=map();v.counts.mapped=Number.MAX_SAFE_INTEGER;v.counts.withoutPoint=0;v.buckets[1].taskCount=Number.MAX_SAFE_INTEGER;
 expect(()=>decodeDiscoveryV1Map(v)).toThrow('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
});
it('P6 guard: a task UUID cannot recur under another bucket key',()=>{
 const v=map();v.counts.withoutPoint=0;v.buckets.push({...v.buckets[0],key:'another-key'});
 expect(()=>decodeDiscoveryV1Map(v)).toThrow('DISCOVERY_V1_MAP_TASK_DUPLICATE');
});
it('P6 guard: short continuing and terminal empty pages remain valid',()=>{
 expect(decodeDiscoveryV1Places(places(),30).hasMore).toBe(true);
 const v=places();v.hasMore=false;v.nextCursor=null;expect(decodeDiscoveryV1Places(v).items).toHaveLength(2);
 v.items=[];expect(decodeDiscoveryV1Places(v).items).toEqual([]);
});
it('P6 guard: point-free-only and empty viewport responses remain valid',()=>{
 const v=map();v.buckets=[];v.wholeBounds=null;v.counts.withoutPoint=v.counts.mapped;
 expect(decodeDiscoveryV1Map(v).buckets).toEqual([]);v.counts.withoutPoint=0;expect(decodeDiscoveryV1Map(v).buckets).toEqual([]);
});
