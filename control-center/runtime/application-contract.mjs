const FORBIDDEN=new Set(['email','phone','exactAddress','exactLat','exactLng','chatBody','messageBody','scopeNote']);
function safe(v,p='root'){if(Array.isArray(v)){v.forEach((x,i)=>safe(x,p+'['+i+']'));return}if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(FORBIDDEN.has(k))throw new Error('APPLICATION_FORBIDDEN_'+p+'.'+k);safe(x,p+'.'+k)}}
export function parseControlApplication(raw){
 const text=JSON.stringify(raw);if(text.length>96*1024)throw new Error('APPLICATION_TOO_LARGE');safe(raw);
 if(!raw||typeof raw!=='object'||raw.schemaVersion!=='CONTROL_APPLICATION_V1'||raw.freshness!=='LIVE')throw new Error('APPLICATION_SCHEMA');
 if(!raw.application||typeof raw.application!=='object')throw new Error('APPLICATION_CORE');
 if(!raw.task||typeof raw.task!=='object'||!raw.worker||typeof raw.worker!=='object')throw new Error('APPLICATION_CONTEXT');
 if(!Array.isArray(raw.recentEvents)||raw.recentEvents.length>25)throw new Error('APPLICATION_EVENTS');
 if(raw.currentTerms?.scopeNoteExposed!==false)throw new Error('APPLICATION_SCOPE_NOTE_EXPOSURE');
 if(Object.values(raw.privacy||{}).some(Boolean))throw new Error('APPLICATION_PRIVACY');
 return Object.freeze(raw);
}
