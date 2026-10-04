import assert from 'node:assert/strict';
import {createSupabaseControlDependencies,CONTROL_ALLOWED_RPCS,CONTROL_SUPABASE_MAX_RAW_BYTES} from './server/supabase-adapter.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const env={CONTROL_SUPABASE_URL:'https://example.supabase.co',CONTROL_SUPABASE_PUBLIC_KEY:'public-key-'.padEnd(30,'p'),CONTROL_SUPABASE_SERVER_KEY:'server-key-'.padEnd(30,'s'),CONTROL_OWNER_USER_ID:owner};
let calls=[];
const fake=async(url,init)=>{
 calls.push({url,init});
 if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:owner}),{status:200,headers:{'content-type':'application/json'}});
 return new Response(JSON.stringify({schemaVersion:'CONTROL_OVERVIEW_V1',freshness:'LIVE'}),{status:200,headers:{'content-type':'application/json'}});
};
const d=createSupabaseControlDependencies(env,{fetchImpl:fake});
let a=await d.authorize(new Request('https://control.invalid/x',{headers:{authorization:'Bearer user-token'}}));
assert.deepEqual(a,{authenticated:true,role:'OWNER',userId:owner});
assert.equal(calls[0].init.headers.apikey,env.CONTROL_SUPABASE_PUBLIC_KEY);
assert.notEqual(calls[0].init.headers.apikey,env.CONTROL_SUPABASE_SERVER_KEY);
const data=await d.rpc('rpc_control_overview_v1',{});
assert.equal(data.schemaVersion,'CONTROL_OVERVIEW_V1');
assert.equal(calls[1].init.headers.apikey,env.CONTROL_SUPABASE_SERVER_KEY);
assert.equal(calls[1].init.headers.authorization,'Bearer '+env.CONTROL_SUPABASE_SERVER_KEY);
assert.ok(CONTROL_ALLOWED_RPCS.includes('rpc_control_user_v1'));
await assert.rejects(()=>d.rpc('rpc_delete_everything',{}),/NOT_ALLOWED/);
assert.ok(CONTROL_SUPABASE_MAX_RAW_BYTES<=192*1024);

const nonOwner=createSupabaseControlDependencies({...env,CONTROL_OWNER_USER_ID:other},{fetchImpl:fake});
a=await nonOwner.authorize(new Request('https://control.invalid/x',{headers:{authorization:'Bearer user-token'}}));
assert.equal(a.role,'USER');
assert.deepEqual(await d.authorize(new Request('https://control.invalid/x')),{authenticated:false});

const tooBig=createSupabaseControlDependencies(env,{fetchImpl:async url=>{
 if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:owner}),{status:200});
 return new Response('x'.repeat(CONTROL_SUPABASE_MAX_RAW_BYTES+1),{status:200});
}});
await assert.rejects(()=>tooBig.rpc('rpc_control_overview_v1',{}),/TOO_LARGE/);
assert.throws(()=>createSupabaseControlDependencies({...env,CONTROL_SUPABASE_URL:'http://insecure.invalid'}),/HTTPS_REQUIRED/);
assert.throws(()=>createSupabaseControlDependencies({...env,CONTROL_OWNER_USER_ID:'bad'}),/OWNER_USER_ID_INVALID/);
console.log('CONTROL SUPABASE ADAPTER PASS');
