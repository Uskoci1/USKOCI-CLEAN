import Constants from 'expo-constants';

/** The exact DEV package of the disposable-stack proof builds and the DEV checkpoints. A store build never logs. */
const TRACE_PACKAGE = 'rs.uskoci.dev';
const CODE = /^[A-Z][A-Z0-9_]{5,80}$/;
const MAX_LINES = 60;
/** The pin timings are one short line per touch and have a budget of their own, so that the diagnosis lines above cannot use it up. */
const MAX_PIN_LINES = 400;
let lines = 0, pinLines = 0;

/** The stable code an owner, contract or transport error carries (`DISCOVERY_V1_...`); anything else is only "UNCODED". */
export function discoveryV1ErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return CODE.test(message) ? message : 'UNCODED';
}

export type DiscoveryV1TraceEvent = 'restored' | 'restore-failed' | 'read-failed' | 'markers' | 'settled' | 'pin';

/**
 * Bounded diagnosis of why the P6 screen ends in its error state, for the DEV package only: a fixed event name and one fixed error code
 * or two counts (`settled`: how a settled camera move was classified; `pin`: milliseconds to the touched bucket's halo and to its card data). No task, person,
 * request, bounds or free text, and at most MAX_LINES lines per app run (and MAX_PIN_LINES of the short `pin` timings).
 */
export function traceDiscoveryV1(event: DiscoveryV1TraceEvent, detail: string | null = null) {
  if (Constants.expoConfig?.android?.package !== TRACE_PACKAGE || (event === 'pin' ? pinLines >= MAX_PIN_LINES : lines >= MAX_LINES)) return;
  if (detail !== null && !CODE.test(detail) && !/^\d{1,4}\/\d{1,4}$/.test(detail)) return;
  if (event === 'pin') pinLines++; else lines++;
  console.info(`[USKOCI_P6_TRACE] ${JSON.stringify([event, detail])}`);
}
