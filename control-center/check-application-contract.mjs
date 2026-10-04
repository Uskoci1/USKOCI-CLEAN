import assert from 'node:assert/strict';
import {parseControlApplication} from './runtime/application-contract.mjs';
const id='11111111-1111-4111-8111-111111111111',now='2026-10-04T18:00:00Z';
const base={schemaVersion:'CONTROL_APPLICATION_V1',capturedAt:now,freshness:'LIVE',
 application:{responseId:id,needId:id,kind:'APPLICATION',status:'SUBMITTED',submittedAgainstNeedRevision:1,currentVersion:1,staleAgainstCurrentNeed:false},
 task:{title:'Test',status:'PUBLISHED',currentRevision:1,city:'NS',requiredSlots:1},
 worker:{accountId:id,profileId:id,displayName:'Radnik',city:'NS'},currentTerms:{priceRsd:1000,coveredSlots:1,scopeNotePresent:true,scopeNoteExposed:false,needRevision:1},
 selection:null,agreement:null,recentEvents:[],privacy:{containsEmail:false,containsPhone:false,containsExactAddress:false,containsChatBody:false,containsScopeNoteBody:false}};
assert.equal(parseControlApplication(base).application.status,'SUBMITTED');
assert.throws(()=>parseControlApplication({...base,scopeNote:'secret'}));
assert.throws(()=>parseControlApplication({...base,recentEvents:Array(26).fill({})}));
console.log('CONTROL APPLICATION RUNTIME CONTRACT PASS');