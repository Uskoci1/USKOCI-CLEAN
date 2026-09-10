/** Service-only existing-ledger worker. No client recipients, payload or URL.
 * Ticket = Expo queued; receipt OK = FCM/APNs accepted; neither = device delivered.
 * No logs: Expo error messages can contain transport addresses.
 */
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
export {};
type Row = Record<string, unknown>;
const row = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
const only = (x: Row, keys: string[]) => Object.keys(x).every(k => keys.includes(k)) && keys.every(k => k in x);
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const ticket = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(x);
const live = (x: unknown): x is string => typeof x === 'string' && Number.isFinite(Date.parse(x)) && Date.parse(x) > Date.now();
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
class Invalid extends Error {}
let running = false;
async function request(url: string, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
 let aborted: (() => void) | undefined;
 const signal = init.signal;
 if (signal.aborted) throw new Invalid();
 try {
  return await Promise.race([fetch(url, init).then(response => {
   if (signal.aborted) { void response.body?.cancel().catch(() => undefined); throw new Invalid(); }
   return response;
  }), new Promise<never>((_, reject) => { aborted = () => reject(new Invalid()); signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted(); })]);
 } finally { if (aborted) signal.removeEventListener('abort', aborted); }
}
async function read(stream: ReadableStream<Uint8Array> | null, max: number, signal: AbortSignal): Promise<unknown> {
 if (!stream) throw new Invalid();
 const reader = stream.getReader(); let total = 0; const chunks: Uint8Array[] = [];
 const cancel = () => { void reader.cancel().catch(() => undefined); };
 signal.addEventListener('abort', cancel, { once: true });
 try {
  while (true) { if (signal.aborted) throw new Invalid(); const part = await reader.read(); if (signal.aborted) throw new Invalid(); if (part.done) break; total += part.value.length; if (total > max) throw new Invalid(); chunks.push(part.value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
 } finally { signal.removeEventListener('abort', cancel); cancel(); }
}
type Result = 'TICKET' | 'PROVIDER_ACCEPTED' | 'DEVICE_NOT_REGISTERED' | 'RETRYABLE' | 'RECEIPT_RATE_EXCEEDED' | 'FATAL' | 'UNKNOWN' | 'RECEIPT_PENDING';
function expoResult(value: unknown, receipt: boolean): { result: Result; ticketId: string | null } {
 if (!row(value)) throw new Invalid();
 if (value.status === 'ok') {
  if (receipt && only(value, ['status'])) return { result: 'PROVIDER_ACCEPTED', ticketId: null };
  if (!receipt && only(value, ['status', 'id']) && ticket(value.id)) return { result: 'TICKET', ticketId: value.id };
  throw new Invalid();
 }
 if (value.status !== 'error' || Object.keys(value).some(k => !['status', 'message', 'details'].includes(k))
  || (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > 4096))
  || !row(value.details) || typeof value.details.error !== 'string') throw new Invalid();
 // Never retain provider messages, credentials, token or arbitrary detail fields.
 const error = value.details.error;
 return { result: error === 'DeviceNotRegistered' ? 'DEVICE_NOT_REGISTERED' : error === 'MessageRateExceeded' ? (receipt ? 'RECEIPT_RATE_EXCEEDED' : 'RETRYABLE')
  : ['MessageTooBig', 'MismatchSenderId', 'InvalidCredentials', 'InvalidPushToken'].includes(error) ? 'FATAL' : 'UNKNOWN', ticketId: null };
}
Deno.serve(async req => {
 if (req.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
 const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if (!service || req.headers.get('authorization') !== `Bearer ${service}`) return json({ code: 'FORBIDDEN' }, 403);
 // Trusted deployment kill switch: omitted/false performs no claim or provider IO.
 if (Deno.env.get('EXPO_PUSH_TRANSPORT_ENABLED') !== 'true') return json({ kind: 'DISABLED' });
 if (running) return json({ kind: 'BUSY' }, 429);
 running = true;
 const controller = new AbortController();
 const cancel = () => controller.abort(); req.signal.addEventListener('abort', cancel, { once: true });
 if (req.signal.aborted) cancel();
 const timer = setTimeout(cancel, 25000);
 const signal = controller.signal;
 try {
  const input = await read(req.body, 256, signal);
  if (!row(input) || !only(input, ['action']) || input.action !== 'tick') return json({ code: 'INVALID_REQUEST' }, 400);
  const rawURL = Deno.env.get('SUPABASE_URL'); if (!rawURL) throw new Invalid();
  const base = new URL(rawURL);
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash) throw new Invalid();
  async function rpc(name: 'rpc_claim_push_transport' | 'rpc_begin_push_send' | 'rpc_complete_push_transport', args: Row) {
   if (signal.aborted) throw new Invalid();
   const result = await request(`${base.origin}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal,
    headers: { apikey: service!, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
   if (!result.ok) { void result.body?.cancel().catch(() => undefined); throw new Invalid(); }
   return read(result.body, 16384, signal);
  }
  async function once(kind: 'SEND' | 'RECEIPT') {
   const claim = await rpc('rpc_claim_push_transport', { p_kind: kind });
   if (row(claim) && only(claim, ['kind']) && claim.kind === 'NONE') return 'NONE';
   if (!row(claim) || !only(claim, ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'ticketId']) || claim.kind !== kind
    || !uuid(claim.attemptId) || !uuid(claim.leaseId) || !live(claim.leaseExpiresAt)
    || (kind === 'SEND' ? claim.ticketId !== null : !ticket(claim.ticketId))) throw new Invalid();
   let body: Row | Row[];
   if (kind === 'SEND') {
    const begin = await rpc('rpc_begin_push_send', { p_attempt_id: claim.attemptId, p_lease_id: claim.leaseId });
    if (row(begin) && only(begin, ['kind']) && begin.kind === 'SUPPRESSED') return 'SUPPRESSED';
    if (!row(begin) || !only(begin, ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'expoPushToken', 'priority']) || begin.kind !== 'SEND'
     || begin.attemptId !== claim.attemptId || begin.leaseId !== claim.leaseId || begin.leaseExpiresAt !== claim.leaseExpiresAt || !live(begin.leaseExpiresAt)
     || typeof begin.expoPushToken !== 'string' || begin.expoPushToken.length > 256 || !/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(begin.expoPushToken)
     || !['NORMAL', 'HIGH'].includes(String(begin.priority))) throw new Invalid();
    body = [{ to: begin.expoPushToken, title: 'USKOČI', body: 'Imate novo obaveštenje. Otvorite aplikaciju.',
     data: { kind: 'INBOX' }, sound: 'default', priority: begin.priority === 'HIGH' ? 'high' : 'normal', ttl: 0 }];
   } else body = { ids: [claim.ticketId] };
   let parsed: { result: Result; ticketId: string | null } = { result: kind === 'SEND' ? 'UNKNOWN' : 'RECEIPT_PENDING', ticketId: null };
   try {
    if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const access = Deno.env.get('EXPO_ACCESS_TOKEN'); if (access) headers.Authorization = `Bearer ${access}`;
    // Literal provider URLs; no redirects or caller-controlled target component.
    const response = await request(kind === 'SEND' ? 'https://exp.host/--/api/v2/push/send' : 'https://exp.host/--/api/v2/push/getReceipts',
     { method: 'POST', headers, body: JSON.stringify(body), signal, redirect: 'error' });
    if (!response.ok) {
     void response.body?.cancel().catch(() => undefined);
     // Only explicit throttle rejection is known safe to resend. 5xx/network/
     // deadline may follow provider acceptance; SQL preserves them as UNKNOWN.
     parsed.result = kind === 'RECEIPT' ? 'RECEIPT_PENDING' : response.status === 429 ? 'RETRYABLE'
      : response.status >= 400 && response.status < 500 ? 'FATAL' : 'UNKNOWN';
    } else {
     const envelope = await read(response.body, 32768, signal);
     if (!row(envelope) || !only(envelope, ['data'])) throw new Invalid();
     if (kind === 'SEND') {
      if (!Array.isArray(envelope.data) || envelope.data.length !== 1) throw new Invalid();
      parsed = expoResult(envelope.data[0], false);
     } else {
      if (!row(envelope.data) || Object.keys(envelope.data).some(k => k !== claim.ticketId)) throw new Invalid();
      parsed = String(claim.ticketId) in envelope.data ? expoResult(envelope.data[String(claim.ticketId)], true) : { result: 'RECEIPT_PENDING', ticketId: null };
     }
    }
   } catch { /* No blind resend and no raw provider exception reaches output. */ }
   if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
   const done = await rpc('rpc_complete_push_transport', { p_attempt_id: claim.attemptId, p_lease_id: claim.leaseId, p_result: parsed.result, p_ticket_id: parsed.ticketId });
   const states: Record<Result, string[]> = { TICKET: ['TICKET_PENDING'], PROVIDER_ACCEPTED: ['PROVIDER_ACCEPTED'], DEVICE_NOT_REGISTERED: ['FINAL'],
    RETRYABLE: kind === 'SEND' ? ['RETRYABLE', 'FINAL'] : ['TICKET_PENDING'], RECEIPT_RATE_EXCEEDED: ['RETRYABLE', 'FINAL'], FATAL: ['FINAL'], UNKNOWN: ['UNKNOWN'], RECEIPT_PENDING: ['TICKET_PENDING'] };
   if (!row(done) || !only(done, ['attemptId', 'state']) || done.attemptId !== claim.attemptId || !states[parsed.result].includes(String(done.state))) throw new Invalid();
   return String(done.state);
  }
  const receipt = await once('RECEIPT'); const send = await once('SEND');
  return json({ kind: 'TICK_COMPLETED', receipt, send });
 } catch { return json({ code: 'PUSH_UNAVAILABLE' }, signal.aborted ? 504 : 503); }
 finally { clearTimeout(timer); req.signal.removeEventListener('abort', cancel); controller.abort(); running = false; }
});
