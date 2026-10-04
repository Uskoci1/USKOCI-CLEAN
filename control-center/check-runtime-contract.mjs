import assert from 'node:assert/strict';
import {parseControlOverview,CONTROL_OVERVIEW_MAX_BYTES} from './runtime/overview-contract.mjs';
const fixture={
 schemaVersion:'CONTROL_OVERVIEW_V1',capturedAt:'2026-10-04T17:00:00Z',freshness:'LIVE',
 accounts:{registeredTotal:12,registered24h:2,active24h:null,active24hState:'UNKNOWN',active24hReason:'NO_CANONICAL_CROSS_APP_ACTIVITY_SIGNAL'},
 workers:{activeProfiles:5,availableNow:3},needs:{PUBLISHED:4,COMPLETED:8},
 responses:{byStatus:{SUBMITTED:2},created24h:2},agreements:{byStatus:{CONFIRMED:1,COMPLETED:4},created24h:1,completed24h:2},
 reviews:{total:8,created24h:2},push:{deliveries24hByState:{DELIVERED:10},attempts24hByOutcome:{OK:10},overdueBacklog:0},
 ai:{conversations24h:{'NEED_INTAKE:OPEN':2}},privacy:{containsEmail:false,containsPhone:false,containsExactAddress:false,containsPushToken:false,containsChatBody:false}
};
const parsed=parseControlOverview(fixture);
assert.equal(parsed.accounts.active24h,null);
assert.equal(parsed.push.overdueBacklog,0);
assert.ok(CONTROL_OVERVIEW_MAX_BYTES<=32768);
for(const bad of [
 {...fixture,schemaVersion:'V2'},
 {...fixture,freshness:'STALE_SNAPSHOT'},
 {...fixture,email:'private@example.invalid'},
 {...fixture,privacy:{...fixture.privacy,containsPhone:true}},
 {...fixture,accounts:{...fixture.accounts,registeredTotal:-1}},
 {...fixture,needs:{published:1}}
])assert.throws(()=>parseControlOverview(bad));
assert.throws(()=>parseControlOverview({...fixture,padding:'x'.repeat(CONTROL_OVERVIEW_MAX_BYTES)}));
console.log('CONTROL OVERVIEW RUNTIME CONTRACT PASS');
