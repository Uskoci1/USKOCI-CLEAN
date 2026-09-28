import type { DiscoveryV1OwnerTransport, DiscoveryV1OwnerRequest } from './discoveryV1Owner';
import { supabaseKlijent } from './supabaseClient';

type RpcRequest = {
  abortSignal?: (signal: AbortSignal) => Promise<{ data: unknown; error: { message?: unknown } | null }>;
  then?: Promise<{ data: unknown; error: { message?: unknown } | null }>['then'];
};
type RpcClient = {
  rpc: (name: string, args: { p_request: DiscoveryV1OwnerRequest }) => RpcRequest | Promise<{ data: unknown; error: { message?: unknown } | null }>;
};

/**
 * P6 transport only. It is intentionally not exported through Izvor and is not referenced by a route.
 * The production switch stays off until the server rollout/performance/native gates are accepted.
 */
export function createDiscoveryV1SupabaseTransport(client: RpcClient = supabaseKlijent() as unknown as RpcClient): DiscoveryV1OwnerTransport {
  return async (request, signal) => {
    if (signal.aborted) throw new Error('DISCOVERY_V1_READ_ABORTED');
    let response: { data: unknown; error: { message?: unknown } | null };
    try {
      const pending = client.rpc('rpc_discovery_v1', { p_request: request }) as RpcRequest;
      response = await (typeof pending.abortSignal === 'function' ? pending.abortSignal(signal) : pending as Promise<typeof response>);
    } catch {
      if (signal.aborted) throw new Error('DISCOVERY_V1_READ_ABORTED');
      throw new Error('DISCOVERY_V1_READ_FAILED');
    }
    if (signal.aborted) throw new Error('DISCOVERY_V1_READ_ABORTED');
    if (response.error) throw new Error(response.error.message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'DISCOVERY_V1_READ_FAILED');
    return response.data;
  };
}
