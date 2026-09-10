/** Authenticated, read-only Nominatim JSONv2 adapter. Deploy with verify_jwt=true.
 * Server configuration: GEOCODER_ENDPOINT (approved HTTPS /search URL),
 * GEOCODER_PROVIDER_HINT, GEOCODER_USER_AGENT, optional GEOCODER_BEARER_TOKEN.
 * No provider is selected by default. These are proposals, never pin attestation.
 * API: https://nominatim.org/release-docs/latest/api/Search/
 * place_id is an opaque, nonpersistent provider hint, not a durable place identity.
 */
export {};
// Keep the Edge entry in the native repository's strict TypeScript check without
// adding ambient Deno globals to the Expo compilation.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deadlineMs = 7_000;
const responseBytes = 131_072;
type RecordValue = Record<string, unknown>;
type Candidate = {
  label: string; countryCode: string; position: { latitude: number; longitude: number };
  providerHint: string; candidateId: string;
};
class Rejected extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}
function only(value: RecordValue, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
// Same Unicode-character/control/ASCII-space rules as the native location owner.
function locationText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const text = value.replace(/^ +| +$/g, '');
  return text.length && Array.from(text).length <= max ? text : null;
}
function providerConfig(): { endpoint: URL; hint: string; userAgent: string; token?: string } | null {
  const raw = Deno.env.get('GEOCODER_ENDPOINT'), hint = Deno.env.get('GEOCODER_PROVIDER_HINT');
  const userAgent = Deno.env.get('GEOCODER_USER_AGENT'), token = Deno.env.get('GEOCODER_BEARER_TOKEN');
  if (!raw || raw.length > 2048 || raw !== raw.trim() || !hint || hint.length > 64
    || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(hint)
    || !userAgent || userAgent.length > 256 || userAgent !== userAgent.trim() || !/^[\x20-\x7e]+$/.test(userAgent)
    || (token !== undefined && (!token.length || token.length > 4096 || !/^[\x21-\x7e]+$/.test(token)))) return null;
  try {
    const endpoint = new URL(raw), host = endpoint.hostname.toLowerCase().replace(/\.$/, '');
    // Only an owner-configured external DNS endpoint. No IP literals, local names,
    // public OSM endpoint, embedded credentials or preloaded query parameters.
    // DNS/network admission belongs to provider setup; this is not DNS attestation.
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || !/\/search\/?$/.test(endpoint.pathname) || !host.includes('.')
      || !/^[a-z0-9.-]+$/.test(host) || /^[0-9.]+$/.test(host)
      || ['localhost', 'local', 'internal', 'lan', 'home', 'nominatim.openstreetmap.org'].some(suffix => host === suffix || host.endsWith(`.${suffix}`))) return null;
    return { endpoint, hint, userAgent, ...(token ? { token } : {}) };
  } catch { return null; }
}
async function boundedJson(message: Request | Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  const length = message.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error('BODY_LIMIT');
  if (!message.body || signal.aborted) throw new Error('BODY_UNAVAILABLE');
  const reader = message.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) throw new Error('BODY_CANCELLED');
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error('BODY_LIMIT');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function availableCountry(raw: unknown, requested: string): boolean | null {
  if (!Array.isArray(raw) || raw.length > 250) return null;
  const seen = new Set<string>();
  let available = false;
  for (const item of raw) {
    const market = record(item);
    if (!market || !only(market, ['countryCode', 'productStatus', 'defaultCurrencyCode', 'defaultLanguageTag', 'defaultTimezone'])
      || typeof market.countryCode !== 'string' || !/^[A-Z]{2}$/.test(market.countryCode) || seen.has(market.countryCode)
      || typeof market.productStatus !== 'string' || !['BUILDING', 'LIVE', 'WAITLIST', 'COMING'].includes(market.productStatus)
      || typeof market.defaultCurrencyCode !== 'string' || !/^[A-Z]{3}$/.test(market.defaultCurrencyCode)
      || typeof market.defaultLanguageTag !== 'string' || market.defaultLanguageTag.length > 35 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(market.defaultLanguageTag)
      || typeof market.defaultTimezone !== 'string' || market.defaultTimezone.length > 100
      || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(market.defaultTimezone)) return null;
    try { new Intl.DateTimeFormat('en', { timeZone: market.defaultTimezone }); } catch { return null; }
    seen.add(market.countryCode);
    if (market.countryCode === requested && ['BUILDING', 'LIVE'].includes(market.productStatus)) available = true;
  }
  return available;
}
function coordinate(raw: unknown, bound: number): number | null {
  if (typeof raw !== 'string' || raw.length > 40 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= bound ? value : null;
}
function candidateId(raw: unknown): string | null {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? String(raw) : null;
  return typeof raw === 'string' && /^[1-9]\d{0,159}$/.test(raw) ? raw : null;
}
function normalizeCandidates(raw: unknown, country: string, hint: string): Candidate[] | null {
  if (!Array.isArray(raw) || raw.length > 10) return null;
  const result: Candidate[] = [], ids = new Set<string>();
  for (const item of raw) {
    const row = record(item), address = record(row?.address);
    if (!row || !address || address.country_code !== country.toLowerCase()) return null;
    const label = locationText(row.display_name, 1000), latitude = coordinate(row.lat, 90), longitude = coordinate(row.lon, 180);
    const id = candidateId(row.place_id);
    if (!label || latitude === null || longitude === null || !id || ids.has(id)) return null;
    ids.add(id);
    // Provider extras (including bounding boxes, licence URLs and names) never
    // become arbitrary wire fields. A malformed row rejects the entire response.
    result.push({ label, countryCode: country, position: { latitude, longitude }, providerHint: hint, candidateId: id });
  }
  return result;
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { code: 'METHOD_NOT_ALLOWED' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization) || authorization.length > 8192) return response(401, { code: 'AUTH_REQUIRED' });
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return response(400, { code: 'INVALID_QUERY' });
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.signal.addEventListener('abort', abort, { once: true });
  if (req.signal.aborted) abort();
  const timer = setTimeout(abort, deadlineMs);
  let rejectAborted: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = () => reject(new Rejected(req.signal.aborted ? 499 : 504, req.signal.aborted ? 'CANCELLED' : 'UNAVAILABLE'));
    controller.signal.addEventListener('abort', rejectAborted, { once: true });
    if (controller.signal.aborted) rejectAborted();
  });
  try {
    const work = async (): Promise<Response> => {
      let body: RecordValue | null;
      try { body = record(await boundedJson(req, 8192, controller.signal)); } catch { throw new Rejected(400, 'INVALID_QUERY'); }
      const text = locationText(body?.text, 1000), country = body?.countryCode;
      if (!body || !only(body, ['text', 'countryCode']) || !text || typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) throw new Rejected(400, 'INVALID_QUERY');
      const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!supabaseUrl || !anonKey) throw new Rejected(503, 'SERVER_CONFIG_ERROR');
      const authenticatedHeaders = { apikey: anonKey, Authorization: authorization, Accept: 'application/json' };
      const fetchBound = async (url: string | URL, init: RequestInit): Promise<Response> => {
        if (controller.signal.aborted) throw new Error('CANCELLED');
        const result = await fetch(url, { ...init, signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (controller.signal.aborted || result.redirected) throw new Error('CANCELLED_OR_REDIRECT');
        return result;
      };
      // A syntactically plausible JWT/anon/service key is not an authenticated
      // user. Ask Auth for the current user, then let the same JWT invoke the RPC.
      const auth = await fetchBound(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, { method: 'GET', headers: authenticatedHeaders });
      if ([401, 403].includes(auth.status)) throw new Rejected(401, 'AUTH_REQUIRED');
      if (!auth.ok) throw new Rejected(502, 'UNAVAILABLE');
      const user = record(await boundedJson(auth, responseBytes, controller.signal));
      if (!user || typeof user.id !== 'string' || !uuidPattern.test(user.id) || user.role !== 'authenticated') throw new Rejected(401, 'AUTH_REQUIRED');
      const markets = await fetchBound(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/rpc_list_location_markets`, {
        method: 'POST', headers: { ...authenticatedHeaders, 'Content-Type': 'application/json' }, body: '{}',
      });
      if ([401, 403].includes(markets.status)) throw new Rejected(401, 'AUTH_REQUIRED');
      if (!markets.ok) throw new Rejected(502, 'UNAVAILABLE');
      const available = availableCountry(await boundedJson(markets, responseBytes, controller.signal), country);
      if (available === null) throw new Rejected(502, 'UNAVAILABLE');
      if (!available) throw new Rejected(403, 'COUNTRY_NOT_AVAILABLE');
      const config = providerConfig();
      if (!config) throw new Rejected(503, 'PROVIDER_ACTIVATION_BLOCKED');
      config.endpoint.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', countrycodes: country.toLowerCase(), limit: '10', q: text }).toString();
      const upstream = await fetchBound(config.endpoint, { method: 'GET', headers: {
        Accept: 'application/json', 'User-Agent': config.userAgent, ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      } });
      if (!upstream.ok) throw new Rejected(502, 'UNAVAILABLE');
      const candidates = normalizeCandidates(await boundedJson(upstream, responseBytes, controller.signal), country, config.hint);
      if (candidates === null) throw new Rejected(502, 'UNAVAILABLE');
      return response(200, { candidates });
    };
    return await Promise.race([work(), aborted]);
  } catch (error) {
    // Never log or expose submitted addresses, provider bodies/URLs, credentials
    // or Auth responses. No database writer exists in this handler.
    return error instanceof Rejected ? response(error.status, { code: error.code }) : response(502, { code: 'UNAVAILABLE' });
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener('abort', abort);
    if (rejectAborted) controller.signal.removeEventListener('abort', rejectAborted);
    controller.abort();
  }
});
