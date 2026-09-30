import Constants from 'expo-constants';

/** The exact DEV package of the disposable-stack proof builds and the DEV checkpoints. A store build never logs. */
const TRACE_PACKAGE = 'rs.uskoci.dev';
const CODE = /^[A-Z][A-Z0-9_]{5,80}$/;
const MAX_LINES = 60;
let lines = 0;

/** The stable code an owner, contract or transport error carries (`DISCOVERY_V1_...`); anything else is only "UNCODED". */
export function discoveryV1ErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return CODE.test(message) ? message : 'UNCODED';
}

export type DiscoveryV1TraceEvent = 'restored' | 'restore-failed' | 'read-failed' | 'markers';

/**
 * Bounded diagnosis of why the P6 screen ends in its error state, for the DEV package only: a fixed event name and one fixed error code
 * or two counts. No task, person, request, bounds or free text, and at most MAX_LINES lines per app run.
 */
export function traceDiscoveryV1(event: DiscoveryV1TraceEvent, detail: string | null = null) {
  if (Constants.expoConfig?.android?.package !== TRACE_PACKAGE || lines >= MAX_LINES) return;
  if (detail !== null && !CODE.test(detail) && !/^\d{1,4}\/\d{1,4}$/.test(detail)) return;
  lines++;
  console.info(`[USKOCI_P6_TRACE] ${JSON.stringify([event, detail])}`);
}
