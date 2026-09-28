import React from 'react';
import { act, create } from 'react-test-renderer';
import { DiscoveryV1ServerMarkerLayer } from '../../ui/v2/discovery/DiscoveryV1ServerMarkerLayer';

jest.mock('../../ui/v2/DiscoveryMap',()=> {
  const ReactForMock = require('react');
  return { PillAnnotation: (props:any) => ReactForMock.createElement('p6-pill', props) };
});

const markers:any[]=[
 {kind:'TASK',key:'task:a',point:{lat:45.25,lng:19.83},taskId:'11111111-1111-4111-8111-111111111111',taskCount:1},
 {kind:'PLACE',key:'place:a',point:{lat:45.26,lng:19.84},taskCount:3},
 {kind:'CLUSTER',key:'cluster:a',point:{lat:45.3,lng:19.9},taskCount:9,distinctPointCount:5,memberBounds:[19.8,45.2,20,45.4]},
];

it('renders server TASK PLACE CLUSTER buckets without task-card payload',()=>{
 const selected=jest.fn();
 const tree=create(<DiscoveryV1ServerMarkerLayer markers={markers as any} selectedKey="place:a" nativeReady owns={()=>true} onSelect={selected}/>);
 const pills=tree.root.findAllByType('p6-pill' as any);
 expect(pills).toHaveLength(3);expect(pills[0].props.content).toMatchObject({tone:'count'});expect(pills[1].props.selected).toBe(true);
 const serialized=JSON.stringify(pills.map(p=>p.props));
 expect(serialized).not.toContain('naslov');expect(serialized).not.toContain('requester');
 act(()=>pills[2].props.onPress());expect(selected).toHaveBeenCalledWith(markers[2]);
});

it('ownership guard prevents a retired layer press from selecting',()=>{
 const selected=jest.fn();
 const tree=create(<DiscoveryV1ServerMarkerLayer markers={[markers[0]] as any} selectedKey={null} nativeReady owns={()=>false} onSelect={selected}/>);
 act(()=>tree.root.findByType('p6-pill' as any).props.onPress());
 expect(selected).not.toHaveBeenCalled();
});

it('refuses unbounded or duplicate marker input rather than truncating',()=>{
 expect(()=>create(<DiscoveryV1ServerMarkerLayer markers={Array.from({length:257},(_,i)=>({...markers[0],key:'t'+i})) as any}
  selectedKey={null} nativeReady owns={()=>true} onSelect={()=>{}}/>)).toThrow('DISCOVERY_V1_SERVER_MARKER_BOUND');
 expect(()=>create(<DiscoveryV1ServerMarkerLayer markers={[markers[0],markers[0]] as any}
  selectedKey={null} nativeReady owns={()=>true} onSelect={()=>{}}/>)).toThrow('DISCOVERY_V1_SERVER_MARKER_DUPLICATE');
});
