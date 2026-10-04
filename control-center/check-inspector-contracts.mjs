import assert from 'node:assert/strict';
import {parseControlSearch,parseControlUser,parseControlTask,parseControlAgreement} from './runtime/inspector-contracts.mjs';
const now='2026-10-04T17:00:00Z',id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
const search={schemaVersion:'CONTROL_SEARCH_V1',capturedAt:now,freshness:'LIVE',items:[{kind:'USER',id,label:'M P',secondary:'NS',state:'ONBOARDED',matchKind:'EMAIL_EXACT'}],hasMore:false,privacy:{returnsEmail:false,returnsPhone:false,returnsExactAddress:false,returnsMessageBody:false}};
assert.equal(parseControlSearch(search).items.length,1);
assert.throws(()=>parseControlSearch({...search,items:Array(21).fill(search.items[0])}));
assert.throws(()=>parseControlSearch({...search,email:'x@y.invalid'}));

const user={schemaVersion:'CONTROL_USER_V1',capturedAt:now,freshness:'LIVE',account:{id,fullName:'M P',city:'NS',activeMode:'requester',onboardingComplete:true,createdAt:now},profiles:[],counts:{needsByStatus:{},applicationsByStatus:{},agreementsByRoleStatus:{}},reputation:{receivedCount:0,averageRating:null,givenCount:0},recentReceivedEvents:[],lastActivity:null,lastActivityState:'UNKNOWN',lastActivityReason:'NO_CANONICAL_CROSS_APP_ACTIVITY_SIGNAL',privacy:{containsEmail:false,containsPhone:false,containsExactAddress:false,containsPushToken:false,containsChatBody:false}};
assert.equal(parseControlUser(user).lastActivity,null);
assert.throws(()=>parseControlUser({...user,phone:'+381'}));

const task={schemaVersion:'CONTROL_TASK_V1',capturedAt:now,freshness:'LIVE',task:{id,status:'PUBLISHED',title:'Test',requiredSlots:2,coveredSlots:1,hasExactLocation:true},applicationsByStatus:{SUBMITTED:1},selections:{byStatus:{SELECTED:1},selectedSlots:1},agreements:[],coverage:{requiredSlots:2,coveredSlots:1,state:'PARTIAL'},searchAuthority:{state:'UNKNOWN',reason:'READBACK'},recentNeedEvents:[],privacy:{containsExactAddress:false,containsExactCoordinates:false,containsChatBody:false}};
assert.equal(parseControlTask(task).coverage.state,'PARTIAL');
assert.throws(()=>parseControlTask({...task,exactAddress:'secret'}));

const agreement={schemaVersion:'CONTROL_AGREEMENT_V1',capturedAt:now,freshness:'LIVE',agreement:{id,needId:id2,status:'CONFIRMED',currentVersion:1,createdAt:now},task:{title:'Test',city:'NS',area:'Centar',hasExactLocation:true},requester:{accountId:id,profileId:id,displayName:'A',city:'NS'},worker:{accountId:id2,profileId:id2,displayName:'B',city:'NS'},acceptedTerms:{priceRsd:1000,coveredSlots:1,proposedStartAt:null,proposedEndAt:null,needRevision:1,responseVersion:1},execution:{state:'CONFIRMED'},messages:{count:0,lastMessageAt:null},reviews:{count:0,requesterSubmitted:false,workerSubmitted:false},privacy:{containsMessageBody:false,containsExactAddress:false,containsExactCoordinates:false}};
assert.equal(parseControlAgreement(agreement).messages.count,0);
assert.throws(()=>parseControlAgreement({...agreement,messageBody:'secret'}));
console.log('CONTROL INSPECTOR RUNTIME CONTRACTS PASS');
