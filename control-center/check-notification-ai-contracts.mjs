import assert from 'node:assert/strict';
import {parseControlNotification,parseControlAi} from './runtime/notification-ai-contracts.mjs';
const now='2026-10-04T17:00:00Z',id='11111111-1111-4111-8111-111111111111';
const n={schemaVersion:'CONTROL_NOTIFICATION_V1',capturedAt:now,freshness:'LIVE',event:{eventId:id,eventType:'MESSAGE_RECEIVED'},preferences:null,deliveries:[],pushAttempts:[],transportReadiness:{state:'UNKNOWN'},deviceDeliveryProof:'UNKNOWN',privacy:{containsNotificationBody:false,containsPushToken:false,containsProviderTicketId:false,containsChatBody:false}};
assert.equal(parseControlNotification(n).deviceDeliveryProof,'UNKNOWN');assert.throws(()=>parseControlNotification({...n,pushToken:'x'}));
const a={schemaVersion:'CONTROL_AI_V1',capturedAt:now,freshness:'LIVE',conversation:{conversationId:id,purpose:'NEED_INTAKE',status:'OPEN'},messages:{count:0,recent:[]},facts:{activeCount:0,byStatus:{},bySource:{},activeKeys:[],valuesExposed:false,evidenceExposed:false},actionProposalsByStatus:{},providerMetrics:{state:'UNKNOWN'},privacy:{containsMessageBody:false,containsFactValue:false,containsEvidenceExcerpt:false}};
assert.equal(parseControlAi(a).providerMetrics.state,'UNKNOWN');assert.throws(()=>parseControlAi({...a,messageBody:'secret'}));
console.log('CONTROL NOTIFICATION/AI RUNTIME CONTRACTS PASS');