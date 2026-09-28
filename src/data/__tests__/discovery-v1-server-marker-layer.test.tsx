import { discoveryV1ServerMarkerSpecs } from '../discoveryV1ServerMarkerPresentation';

const markers:any[]=[
 {kind:'TASK',key:'task:a',point:{lat:45.25,lng:19.83},taskId:'11111111-1111-4111-8111-111111111111',taskCount:1},
 {kind:'PLACE',key:'place:a',point:{lat:45.26,lng:19.84},taskCount:3},
 {kind:'CLUSTER',key:'cluster:a',point:{lat:45.3,lng:19.9},taskCount:9,distinctPointCount:5,memberBounds:[19.8,45.2,20,45.4]},
];

it('projects server TASK PLACE CLUSTER buckets without task-card payload',()=>{
 const specs=discoveryV1ServerMarkerSpecs(markers as any,'place:a');
 expect(specs).toHaveLength(3);expect(specs[0].content).toMatchObject({tone:'count'});
 expect(specs[1].selected).toBe(true);expect(specs[2].marker).toBe(markers[2]);
 const serialized=JSON.stringify(specs);
 expect(serialized).not.toContain('naslov');expect(serialized).not.toContain('requester');
});
it('keeps aggregate marker meanings and never creates a task id for PLACE or CLUSTER',()=>{
 const specs=discoveryV1ServerMarkerSpecs(markers as any,null);
 expect(specs[0].marker).toMatchObject({kind:'TASK',taskId:expect.any(String),taskCount:1});
 expect(specs[1].marker).toEqual(expect.objectContaining({kind:'PLACE',taskCount:3}));
 expect((specs[1].marker as any).taskId).toBeUndefined();
 expect((specs[2].marker as any).taskId).toBeUndefined();
});
it('refuses unbounded or duplicate marker input rather than truncating',()=>{
 expect(()=>discoveryV1ServerMarkerSpecs(Array.from({length:257},(_,i)=>({...markers[0],key:'t'+i})) as any,null))
  .toThrow('DISCOVERY_V1_SERVER_MARKER_BOUND');
 expect(()=>discoveryV1ServerMarkerSpecs([markers[0],markers[0]] as any,null))
  .toThrow('DISCOVERY_V1_SERVER_MARKER_DUPLICATE');
});
