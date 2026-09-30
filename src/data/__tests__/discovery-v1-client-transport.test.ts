jest.mock('../supabaseClient',()=>({supabaseKlijent:jest.fn()}));
import { createDiscoveryV1SupabaseTransport, DISCOVERY_V1_READ_DEADLINE_MS } from '../discoveryV1ClientTransport';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';

const request:DiscoveryV1OwnerRequest={mode:'EXACT_PUBLIC',needId:'11111111-1111-4111-8111-111111111111'};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve};}
it('sends exactly one rpc_discovery_v1 request with the immutable owner request',async()=>{
 const abortSignal=jest.fn(async()=>({data:{ok:true},error:null}));const rpc=jest.fn(()=>({abortSignal}));
 const signal=new AbortController().signal;const transport=createDiscoveryV1SupabaseTransport({rpc} as any);
 await expect(transport(request,signal)).resolves.toEqual({ok:true});
 expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('rpc_discovery_v1',{p_request:request});
 expect(abortSignal).toHaveBeenCalledTimes(1);
});
it('hands the request a signal of its own that follows the abort of the caller',async()=>{
 let own:AbortSignal|undefined;const pending=deferred<any>();
 const abortSignal=jest.fn((s:AbortSignal)=>{own=s;return pending.promise;}),rpc=jest.fn(()=>({abortSignal})),controller=new AbortController();
 const result=createDiscoveryV1SupabaseTransport({rpc} as any)(request,controller.signal);
 const rejected=expect(result).rejects.toThrow('DISCOVERY_V1_READ_ABORTED');
 expect(own).toBeDefined();expect(own!.aborted).toBe(false);
 controller.abort();await rejected;expect(own!.aborted).toBe(true);
});
// Independent review, finding 3: React Native has no request timeout on Android, so a read nobody answers made the owner wait for ever (and the coordinator hold the last picture for ever).
it('a read nobody answers ends by its deadline: it stops its own request, never the one of the caller, and is never retried',async()=>{
 jest.useFakeTimers();
 try{
  let own:AbortSignal|undefined;
  const abortSignal=jest.fn((s:AbortSignal)=>{own=s;return new Promise<never>(()=>{});}),rpc=jest.fn(()=>({abortSignal})),caller=new AbortController();
  const result=createDiscoveryV1SupabaseTransport({rpc} as any)(request,caller.signal);
  const rejected=expect(result).rejects.toThrow('DISCOVERY_V1_READ_TIMEOUT');
  await jest.advanceTimersByTimeAsync(DISCOVERY_V1_READ_DEADLINE_MS-1);expect(own!.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);await rejected;
  expect(own!.aborted).toBe(true);expect(caller.signal.aborted).toBe(false);expect(rpc).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(DISCOVERY_V1_READ_DEADLINE_MS*3);expect(rpc).toHaveBeenCalledTimes(1);
 }finally{jest.useRealTimers();}
});
it('an answered read leaves no deadline behind, and a client that ignores abort and never answers still ends when the read is aborted',async()=>{
 jest.useFakeTimers();
 try{
  const rpc=jest.fn(async()=>({data:{ok:true},error:null}));
  await expect(createDiscoveryV1SupabaseTransport({rpc} as any)(request,new AbortController().signal)).resolves.toEqual({ok:true});
  expect(jest.getTimerCount()).toBe(0);
  const silent=jest.fn(()=>new Promise<never>(()=>{})),controller=new AbortController();
  const result=createDiscoveryV1SupabaseTransport({rpc:silent} as any)(request,controller.signal);
  const rejected=expect(result).rejects.toThrow('DISCOVERY_V1_READ_ABORTED');controller.abort();await rejected;
  expect(jest.getTimerCount()).toBe(0);
 }finally{jest.useRealTimers();}
});
it('does not dispatch an already aborted read',async()=>{
 const rpc=jest.fn(),controller=new AbortController();controller.abort();
 await expect(createDiscoveryV1SupabaseTransport({rpc} as any)(request,controller.signal)).rejects.toThrow('DISCOVERY_V1_READ_ABORTED');
 expect(rpc).not.toHaveBeenCalled();
});
it('refuses a late response when transport ignores abort and never retries',async()=>{
 const pending=deferred<any>(),rpc=jest.fn(()=>pending.promise),controller=new AbortController();
 const result=createDiscoveryV1SupabaseTransport({rpc} as any)(request,controller.signal);
 const rejected=expect(result).rejects.toThrow('DISCOVERY_V1_READ_ABORTED');controller.abort();pending.resolve({data:{old:true},error:null});
 await rejected;expect(rpc).toHaveBeenCalledTimes(1);
});
it('maps provider diagnostics to stable read codes',async()=>{
 const rpc=jest.fn().mockResolvedValueOnce({data:null,error:{message:'private provider text'}})
  .mockResolvedValueOnce({data:null,error:{message:'AUTH_REQUIRED'}});
 const transport=createDiscoveryV1SupabaseTransport({rpc} as any),signal=new AbortController().signal;
 await expect(transport(request,signal)).rejects.toThrow('DISCOVERY_V1_READ_FAILED');
 await expect(transport(request,signal)).rejects.toThrow('AUTH_REQUIRED');
 expect(rpc).toHaveBeenCalledTimes(2);
});

// Independent client review, finding 1: the server's anchor expires after 30 minutes; the route can only renew it if the transport names it (and still nothing of the provider's text).
it('names an expired anchor with its own stable code so the route can renew it',async()=>{
 const rpc=jest.fn().mockResolvedValueOnce({data:null,error:{message:'P6_ANCHOR_EXPIRED'}}).mockResolvedValueOnce({data:null,error:{message:'P6_INVALID_ANCHOR'}});
 const transport=createDiscoveryV1SupabaseTransport({rpc} as any),signal=new AbortController().signal;
 await expect(transport(request,signal)).rejects.toThrow('DISCOVERY_V1_ANCHOR_EXPIRED');
 await expect(transport(request,signal)).rejects.toThrow('DISCOVERY_V1_READ_FAILED');
});
