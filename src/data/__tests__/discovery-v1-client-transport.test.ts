jest.mock('../supabaseClient',()=>({supabaseKlijent:jest.fn()}));
import { createDiscoveryV1SupabaseTransport } from '../discoveryV1ClientTransport';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';

const request:DiscoveryV1OwnerRequest={mode:'EXACT_PUBLIC',needId:'11111111-1111-4111-8111-111111111111'};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve};}
it('sends exactly one rpc_discovery_v1 request with the immutable owner request',async()=>{
 const abortSignal=jest.fn(async()=>({data:{ok:true},error:null}));const rpc=jest.fn(()=>({abortSignal}));
 const signal=new AbortController().signal;const transport=createDiscoveryV1SupabaseTransport({rpc} as any);
 await expect(transport(request,signal)).resolves.toEqual({ok:true});
 expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('rpc_discovery_v1',{p_request:request});
 expect(abortSignal).toHaveBeenCalledWith(signal);
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
