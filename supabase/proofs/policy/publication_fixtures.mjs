// Synthetic disposable fixture data. No production policy or transport.
const pin = (slot, extra = {}) => ({slot, latitudeE6:45251234, longitudeE6:19831234,
  origin:{kind:'MANUAL_PIN'}, ...extra});
export function locationFixture(geography, points) {
  const value = {taskCountryCode:'RS', geography, exactAddress:null, accessNotes:null};
  return {...value, resolvedLocation:points === null ? null : {version:1,
    binding:{taskCountryCode:'RS', geography, exactAddress:null}, points}};
}
const stationary = {mode:'STATIONARY', start:{city:'Novi Sad'}};
const route = {mode:'POINT_TO_POINT', start:{city:'Novi Sad'}, end:{city:'Novi Sad'}};
const multi = {mode:'MULTI_STOP', start:{city:'Novi Sad'},
  waypoints:Array.from({length:20},(_,i)=>({label:`Disposable stop ${i}`})), end:{city:'Novi Sad'}};
const area = {mode:'AREA_BASED', serviceArea:{city:'Novi Sad'}, start:{city:'Novi Sad'}};
// Expected coverage is literal fixture data, not a second implementation of the
// production slot derivation. All these inputs must remain legal DRAFTs.
export const locationCases = [
  {id:'stationary-unresolved', value:locationFixture(stationary,null), missing:['start']},
  {id:'stationary-zero-valid', value:locationFixture(stationary,[pin('start',{latitudeE6:0,longitudeE6:0})]), missing:[]},
  {id:'route-missing-end', value:locationFixture(route,[pin('start')]), missing:['end']},
  {id:'route-missing-start', value:locationFixture(route,[pin('end')]), missing:['start']},
  {id:'route-complete-reordered', value:locationFixture(route,[pin('end'),pin('start')]), missing:[]},
  {id:'multi-missing-middle', value:locationFixture(multi,[pin('start'),...Array.from({length:20},(_,i)=>i===9?null:pin(`waypoints/${i}`)).filter(Boolean),pin('end')]), missing:['waypoints/9']},
  {id:'multi-complete-22', value:locationFixture(multi,[pin('start'),...Array.from({length:20},(_,i)=>pin(`waypoints/${i}`)),pin('end')]), missing:[]},
  {id:'area-missing-service-area', value:locationFixture(area,[pin('start')]), missing:['serviceArea']},
  {id:'area-missing-existing-start', value:locationFixture(area,[pin('serviceArea')]), missing:['start']},
  {id:'area-complete', value:locationFixture(area,[pin('serviceArea'),pin('start')]), missing:[]},
  {id:'remote-exempt', value:locationFixture({mode:'REMOTE'},null), missing:[]},
];

// The first sentence is an existing RS-MIN owner-document example. This does
// not assert a real evaluator result or activate the rule in production.
export const syntheticNonlocationFacts = [
  ['need.title','Disposable publication transport task'],
  ['need.description','Treba mi neko sutra da prenese ormar iz sobe u kombi.'],
  ['need.category','PROOF'], ['need.price_mode','OFFERS'],
  ['need.schedule_kind','FLEXIBLE'], ['need.people_needed',1],
];
