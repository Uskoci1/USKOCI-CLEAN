import assert from 'node:assert/strict';
import {deriveBusinessMetrics} from './runtime/business-metrics.mjs';
const o={accounts:{active24h:null,active24hState:'UNKNOWN',registered24h:3,registeredTotal:100},workers:{activeProfiles:20,availableNow:7},
 needs:{byStatus:{PUBLISHED:5,SELECTION:2,ACTIVE:4,COMPLETED:9},activeCount:11,openForApplicationsCount:7,created24h:6,published24h:4},
 responses:{byStatus:{SUBMITTED:8},created24h:13,submitted24h:11},
 agreements:{byStatus:{CONFIRMED:6,COMPLETED:12},activeCount:6,created24h:4,completed24h:3,completionMismatchCount:0},
 reviews:{created24h:2},push:{overdueBacklog:1,attempts24hByOutcome:{OK:90,RETRYABLE:5,FATAL:5,QUEUED:3}},
 ai:{conversations24h:{'NEED_INTAKE:OPEN':4,'PROFILE:COMPLETED':2}}};
const m=deriveBusinessMetrics(o);
assert.deepEqual(m.activeUsers24h,{value:null,state:'UNKNOWN'});
assert.equal(m.openForApplications,7);
assert.equal(m.activeTasks,11);
assert.equal(m.createdTasks24h,6);
assert.equal(m.publishedTasks24h,4);
assert.equal(m.submittedApplications24h,11);
assert.equal(m.activeAgreements,6);
assert.equal(m.completed24h,3);
assert.equal(m.completionMismatchCount,0);
assert.equal(m.pushSuccessPct,90);
assert.equal(m.aiConversations24h,6);
assert.throws(()=>deriveBusinessMetrics({...o,needs:{...o.needs,activeCount:-1}}));
console.log('CONTROL BUSINESS METRICS PASS');