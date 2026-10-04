const FORBIDDEN=new Set(['notificationBody','pushToken','expoPushToken','providerTicketId','chatBody','messageBody','body','factValue','evidenceExcerpt']);
function obj(v,n){if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(n+'_OBJECT');return v}
function arr(v,n,max){if(!Array.isArray(v)||v.length>max)throw new Error(n+'_ARRAY');return v}
function stamp(v,n){if(typeof v!=='string'||Number.isNaN(Date.parse(v)))throw new Error(n+'_TIME');return v}
function safe(v,path='root'){if(Array.isArray(v)){v.forEach((x,i)=>safe(x,path+'['+i+']'));return}if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(FORBIDDEN.has(k))throw new Error('FORBIDDEN_'+path+'.'+k);safe(x,path+'.'+k)}}
function base(raw,schema,max){const s=JSON.stringify(raw);if(s.length>max)throw new Error('PAYLOAD_TOO_LARGE');safe(raw);const r=obj(raw,'ROOT');if(r.schemaVersion!==schema)throw new Error('SCHEMA_'+schema);stamp(r.capturedAt,'CAPTURED');if(r.freshness!=='LIVE')throw new Error('NOT_LIVE');return r}
function privacy(p,n){p=obj(p,n);for(const v of Object.values(p))if(v===true)throw new Error(n+'_TRUE');return p}
export function parseControlNotification(raw){
 const r=base(raw,'CONTROL_NOTIFICATION_V1',98304);obj(r.event,'EVENT');if(r.preferences!==null)obj(r.preferences,'PREFERENCES');
 arr(r.deliveries,'DELIVERIES',8);arr(r.pushAttempts,'ATTEMPTS',32);obj(r.transportReadiness,'READINESS');
 if(!['UNKNOWN','ACKNOWLEDGED','NOT_AVAILABLE'].includes(r.deviceDeliveryProof))throw new Error('DEVICE_PROOF_STATE');
 privacy(r.privacy,'NOTIFICATION_PRIVACY');return Object.freeze(r)
}
export function parseControlAi(raw){
 const r=base(raw,'CONTROL_AI_V1',98304);obj(r.conversation,'CONVERSATION');const m=obj(r.messages,'MESSAGES');arr(m.recent,'RECENT_MESSAGES',20);
 const f=obj(r.facts,'FACTS');arr(f.activeKeys,'FACT_KEYS',100);obj(r.actionProposalsByStatus,'PROPOSALS');obj(r.providerMetrics,'PROVIDER_METRICS');
 privacy(r.privacy,'AI_PRIVACY');return Object.freeze(r)
}