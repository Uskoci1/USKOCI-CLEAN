// @ts-nocheck
// USKOCI server-side AI intake boundary.
// Provider secrets live only in Supabase Edge Function environment. Never expose
// GEMINI_API_KEY / OPENAI_API_KEY / SUPABASE_SERVICE_ROLE_KEY to Expo, source or logs.

import {
  LEGACY_FACT_SCHEMA_V1,
  NEED_FACT_SCHEMA_V2,
  NEED_FACT_V2_DEFINITIONS,
  AI_PROPOSABLE_NEED_FACT_V2_KEYS,
  isAiProposableNeedFactV2Key,
  isNeedFactV2Key,
} from '../../../src/contracts/needFactsV2.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LEGACY_FACT_KEYS = [
  'naslov', 'opis', 'kategorija', 'datum', 'vreme',
  'polaziste', 'odrediste', 'osoba', 'vozilo', 'uslovi',
] as const;
const legacyFactKeySet = new Set<string>(LEGACY_FACT_KEYS);
// Manual form witnesses remain in the full registry, but are neither AI input
// nor AI proposals. Keep legacy context during the existing schema transition.
const AI_CONTEXT_FACT_KEYS = [...LEGACY_FACT_KEYS, ...AI_PROPOSABLE_NEED_FACT_V2_KEYS];
const aiContextFactKeySet = new Set<string>(AI_CONTEXT_FACT_KEYS);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_MODES = new Set(['MY_PRICE', 'OFFERS']);
const SCHEDULE_KINDS = new Set([
  'FIXED_WINDOW',
  'FLEXIBLE',
  'REMOTE_ANYTIME',
  'TODAY_FLEXIBLE',
  'TOMORROW_FLEXIBLE',
  'WEEK_FLEXIBLE',
]);
const GEOGRAPHY_MODES = new Set(['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE']);

type FactSchemaVersion = typeof LEGACY_FACT_SCHEMA_V1 | typeof NEED_FACT_SCHEMA_V2;
type ParsedTurn = {
  safety: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';
  assistantMessage: string;
  proposals: Array<Record<string, unknown>>;
};

type ServerTimeContext = {
  nowUtc: string;
  timeZone: 'Europe/Belgrade';
  localDate: string;
  localTime: string;
  utcOffset: string;
};

function serverTimeContext(now: Date): ServerTimeContext {
  const timeZone = 'Europe/Belgrade' as const;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return {
    nowUtc: now.toISOString(), timeZone,
    localDate: `${part('year')}-${part('month')}-${part('day')}`,
    localTime: `${part('hour')}:${part('minute')}:${part('second')}`,
    utcOffset: part('timeZoneName').replace(/^GMT/, '') || '+00:00',
  };
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const sameUuid = (value: unknown, expected: string) => isUuid(value) && value.toLowerCase() === expected.toLowerCase();

/** Bounds both fetch and body consumption. Abort does not prove remote rollback. */
async function boundedJson(input: string | Request, init: RequestInit = {}, limit = 524288, timeout = 8000, parent?: AbortSignal, omitErrorBody = false) {
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  let rejectStopped: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  const stop = () => { expired = true; controller.abort(); rejectStopped(new Error('AI_TRANSPORT_STOPPED')); };
  if (parent?.aborted) stop();
  else parent?.addEventListener('abort', stop, { once: true });
  timer = setTimeout(stop, timeout);
  const work = async () => {
    if (expired) throw new Error('AI_TRANSPORT_STOPPED');
    const result = typeof input === 'string'
      ? await fetch(input, { ...init, signal: controller.signal, redirect: 'error' }) : input;
    if (expired || result instanceof Response && result.redirected) throw new Error('AI_TRANSPORT_STOPPED');
    if (omitErrorBody && result instanceof Response && !result.ok) {
      void result.body?.cancel().catch(() => {});
      return { ok: false, status: result.status, data: null };
    }
    const size = result.headers.get('content-length');
    if (size !== null && (!/^\d+$/.test(size) || Number(size) > limit)) throw new Error('AI_PAYLOAD_TOO_LARGE');
    const reader = result.body?.getReader();
    if (!reader) throw new Error('AI_PAYLOAD_EMPTY');
    const chunks: Uint8Array[] = []; let count = 0;
    try {
      while (true) {
        const part = await Promise.race([reader.read(), stopped]);
        if (expired) throw new Error('AI_TRANSPORT_STOPPED');
        if (part.done) break;
        count += part.value.byteLength;
        if (count > limit) throw new Error('AI_PAYLOAD_TOO_LARGE');
        chunks.push(part.value);
      }
    } finally { if (expired || count > limit) void reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(count); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return { ok: result instanceof Response ? result.ok : true, status: result instanceof Response ? result.status : 200, data };
  };
  try { return await Promise.race([work(), stopped]); }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', stop); }
}

const userWindows = new Map<string, { times: number[]; busy: boolean }>();
function admitUser(accountId: string) {
  const now = Date.now();
  for (const [id, value] of userWindows) if (!value.busy && !value.times.some(time => time > now - 60000)) userWindows.delete(id);
  let value = userWindows.get(accountId);
  if (!value) {
    if (userWindows.size >= 2000) return null;
    value = { times: [], busy: false }; userWindows.set(accountId, value);
  }
  value.times = value.times.filter(time => time > now - 60000);
  if (value.busy || value.times.length >= 6) return null;
  value.times.push(now); value.busy = true;
  return () => { value!.busy = false; };
}

function validTurn(value: unknown, conversationId: string, requestId: string) {
  if (!exact(value, ['conversationId', 'clientRequestId', 'state', 'turnId', 'retryAllowed', 'receipt']) ||
    !sameUuid(value.conversationId, conversationId) || !sameUuid(value.clientRequestId, requestId) ||
    !['ABSENT', 'PROCESSING', 'SUCCEEDED', 'FAILED'].includes(value.state) || typeof value.retryAllowed !== 'boolean') return false;
  if (value.state === 'ABSENT') return value.turnId === null && value.receipt === null;
  if (!isUuid(value.turnId)) return false;
  if (value.state !== 'SUCCEEDED') return value.receipt === null && (value.state !== 'PROCESSING' || value.retryAllowed === false);
  const r = value.receipt;
  return !value.retryAllowed && exact(r, ['userMessageId', 'assistantMessageId', 'proposedCount', 'safety', 'schemaVersion', 'authoritative']) &&
    isUuid(r.userMessageId) && isUuid(r.assistantMessageId) && r.userMessageId !== r.assistantMessageId &&
    Number.isSafeInteger(r.proposedCount) && r.proposedCount >= 0 && r.proposedCount <= 12 &&
    ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(r.safety) && r.schemaVersion === NEED_FACT_SCHEMA_V2 && r.authoritative === true &&
    (r.safety !== 'BLOCK' || r.proposedCount === 0);
}
const turnResponse = (turn: any) => response(turn.state === 'SUCCEEDED' ? 200 : turn.state === 'PROCESSING' ? 202 : 409, turn);

function validClaimContext(context: unknown) {
  if (!exact(context, ['schemaVersion', 'history', 'activeFacts']) || context.schemaVersion !== NEED_FACT_SCHEMA_V2 ||
    !Array.isArray(context.history) || context.history.length > 40 || !Array.isArray(context.activeFacts) || context.activeFacts.length > 64) return false;
  return context.history.every((row: unknown) => exact(row, ['role', 'body', 'sequence_no']) &&
    ['USER', 'ASSISTANT', 'SYSTEM'].includes(row.role) && typeof row.body === 'string' && row.body.length <= 6000 &&
    Number.isSafeInteger(row.sequence_no) && row.sequence_no > 0) &&
    context.activeFacts.every((row: unknown) => exact(row, ['fact_key', 'fact_value', 'value_type', 'display_value', 'fact_schema_version', 'status', 'source', 'created_at']) &&
      isAiProposableNeedFactV2Key(row.fact_key) && row.fact_schema_version === NEED_FACT_SCHEMA_V2);
}

function outputText(payload: any): string | null {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) return part.text;
    }
  }
  return null;
}

function geminiText(payload: any): string | null {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (typeof part?.text === 'string' && part.text.trim()) return part.text;
    }
  }
  return null;
}

async function postgrest(
  url: string,
  apiKey: string,
  authorization: string,
  path: string,
  init: RequestInit = {},
) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function legacyProviderSchema() {
  return {
    type: 'OBJECT',
    additionalProperties: false,
    properties: {
      safety: { type: 'STRING', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
      assistantMessage: { type: 'STRING' },
      facts: {
        type: 'ARRAY',
        maxItems: 10,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: LEGACY_FACT_KEYS },
            value: { type: 'STRING' },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            evidence: { type: 'STRING' },
          },
          required: ['key', 'value', 'confidence', 'evidence'],
        },
      },
    },
    required: ['safety', 'assistantMessage', 'facts'],
  };
}

function v2ProviderSchema() {
  return {
    type: 'OBJECT',
    additionalProperties: false,
    properties: {
      safety: { type: 'STRING', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
      assistantMessage: { type: 'STRING' },
      facts: {
        type: 'ARRAY',
        maxItems: 12,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: AI_PROPOSABLE_NEED_FACT_V2_KEYS },
            // JSON encoded as a string keeps Gemini/OpenAI structured-output
            // contracts provider-neutral. Edge parses it back to real JSON and
            // PostgreSQL remains the final type/range/enum authority.
            valueJson: { type: 'STRING' },
            displayValue: { type: 'STRING' },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            evidence: { type: 'STRING' },
          },
          required: ['key', 'valueJson', 'displayValue', 'confidence', 'evidence'],
        },
      },
    },
    required: ['safety', 'assistantMessage', 'facts'],
  };
}

function openAiSchema(schemaVersion: FactSchemaVersion) {
  const src = schemaVersion === NEED_FACT_SCHEMA_V2 ? v2ProviderSchema() : legacyProviderSchema();
  const convert = (node: any): any => {
    if (Array.isArray(node)) return node.map(convert);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' && typeof value === 'string') out[key] = value.toLowerCase();
      else out[key] = convert(value);
    }
    return out;
  };
  return convert(src);
}

function commonInstruction(activeFacts: any[], timeContext: ServerTimeContext) {
  // Defense in depth if the context transport returns rows outside its query
  // allowlist. This filters structured facts, not arbitrary conversation text.
  const known = activeFacts.filter((fact) => aiContextFactKeySet.has(fact?.fact_key)).map((fact) => ({
    key: fact.fact_key,
    value: fact.fact_value,
    displayValue: fact.display_value ?? null,
    status: fact.status,
  }));
  return [
    'Odgovarajte prirodno na srpskom latinicom, kratko, jasno i ljudski.',
    'Ovo je višekoračni razgovor, ne formular. Ne ponavljajte pitanja za podatke koji su već poznati i važeći.',
    'Ako nešto materijalno nedostaje ili je kontradiktorno, postavite jedno najvažnije sledeće pitanje; najviše dva usko povezana samo kada je prirodno.',
    'Ako korisnik ispravlja raniji podatak, predložite novu vrednost istog ključa. Server čuva supersession istoriju.',
    'Nikada ne izmišljajte cenu, vreme, lokaciju, sprat, lift, broj ljudi, vozilo, dozvolu ili drugi materijalni uslov.',
    `Serverski vremenski kontekst za trenutni unos u Srbiji: ${JSON.stringify(timeContext)}.`,
    'Relativne datume poput danas, sutra i prekosutra tumačite prema ovom serverskom lokalnom datumu, a ne prema sopstvenoj memoriji ili datumu koji klijent tvrdi da je sada. Ako je relevantna druga vremenska zona ili je datum dvosmislen, tražite razjašnjenje.',
    'Ovaj vremenski kontekst je referenca za predlog, nikada potvrđen termin Zadatka. Datum i vreme jasno prikažite korisniku radi potvrde. Ne izmišljajte nedostajući čas, trajanje, kraj termina ili nejasnu lokaciju; postavite sledeće potrebno pitanje. Timestamp predlozi moraju sadržati eksplicitni vremenski pomak za taj datum.',
    'AI predlog nikada nije ljudska potvrda i nikada nije dozvola za objavu.',
    'Safety je samo razgovorni signal. Ne tvrdite da je nešto zakonski dozvoljeno na osnovu sopstvene memorije. Ako je pravno/policy nejasno ili regulisano, koristite REVIEW; ako se bezbedno pitanje može razjasniti, CLARIFY.',
    `Aktuelne server-side činjenice: ${JSON.stringify(known).slice(0, 8000)}`,
  ];
}

function legacyInstruction(activeFacts: any[], timeContext: ServerTimeContext) {
  return [
    'Vi ste USKOČI razgovorni AI asistent koji vodi korisnika kroz unos jednog Zadatka.',
    ...commonInstruction(activeFacts, timeContext),
    'Iz NAJNOVIJE poruke izdvojite samo podržane legacy činjenice.',
    'evidence mora biti kratak doslovan isečak najnovije korisnikove poruke.',
  ].join(' ');
}

function v2Instruction(activeFacts: any[], timeContext: ServerTimeContext) {
  const registry = AI_PROPOSABLE_NEED_FACT_V2_KEYS.map((key) => ({ key, ...NEED_FACT_V2_DEFINITIONS[key] }));
  return [
    'Vi ste USKOČI AI kopilot za sastavljanje kvalitetnog Zadatka iz prirodnog razgovora.',
    ...commonInstruction(activeFacts, timeContext),
    'Sastavite lep, kratak i smislen need.title kada razgovor daje dovoljno osnove. Need.description može biti uredna ljudska sinteza potvrđenih/poznatih činjenica i najnovije poruke, ali ne sme dodati nijedan novi materijalni uslov.',
    'Za obične atomske činjenice evidence je kratak citat korisnika. Za naslov/opis koji su sinteza, evidence može biti kratko: "Sinteza potvrđenih činjenica i razgovora".',
    'valueJson je JSON tekst stvarne tipizovane vrednosti: tekst/enum/timestamp kao JSON string sa navodnicima, integer kao broj, boolean true/false, niz kao JSON niz stringova, geography kao JSON objekat.',
    'need.price_mode može biti samo MY_PRICE ili OFFERS. Ako je MY_PRICE, need.price_rsd mora biti poznat pre spremnosti za nacrt.',
    'need.schedule_kind može biti samo FIXED_WINDOW, FLEXIBLE, REMOTE_ANYTIME, TODAY_FLEXIBLE, TOMORROW_FLEXIBLE ili WEEK_FLEXIBLE. FIXED_WINDOW zahteva i starts_at i ends_at, sa krajem posle početka.',
    'need.task_geography.mode može biti STATIONARY, POINT_TO_POINT, MULTI_STOP, AREA_BASED ili REMOTE. Objekat sme imati samo mode/start/end/waypoints/serviceArea; lokacijske tačke samo label/city/area. REMOTE nema fizičke tačke. AREA_BASED koristi start ili serviceArea. Tačnu adresu stavljajte isključivo u need.exact_address.',
    'Tačna privatna adresa/access notes nikada se ne prebacuju u javnu geography ili opis.',
    `Jedini podržani V2 fact registry: ${JSON.stringify(registry)}`,
  ].join(' ');
}

function parseSafety(value: unknown): ParsedTurn['safety'] {
  return ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(String(value))
    ? String(value) as ParsedTurn['safety']
    : 'REVIEW';
}

function rejectManualOnlyFacts(parsed: any): void {
  for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
    const key = typeof fact?.key === 'string' ? fact.key : '';
    if (isNeedFactV2Key(key) && !isAiProposableNeedFactV2Key(key)) {
      // Reject the entire turn before any writer, including BLOCK and legacy
      // replies; silently dropping this fact would still persist the response.
      throw new Error('AI_MANUAL_ONLY_FACT_REJECTED');
    }
  }
}

function parseLegacyOutput(parsed: any): ParsedTurn {
  rejectManualOnlyFacts(parsed);
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim().slice(0, 1200)
    : '';
  if (!assistantMessage) throw new Error('ASSISTANT_MESSAGE_MISSING');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      const value = typeof fact?.value === 'string' ? fact.value.trim().slice(0, 2000) : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim().slice(0, 500) : '';
      const confidence = Number(fact?.confidence);
      if (!legacyFactKeySet.has(key) || !value || !evidence || !Number.isFinite(confidence)) continue;
      proposals.push({ key, value, confidence: Math.max(0, Math.min(1, confidence)), evidence });
    }
  }
  return { safety, assistantMessage, proposals };
}

function valueMatchesType(valueType: string, value: unknown): boolean {
  if (valueType === 'TEXT' || valueType === 'ENUM' || valueType === 'TIMESTAMPTZ') return typeof value === 'string' && value.trim().length > 0;
  if (valueType === 'INTEGER') return typeof value === 'number' && Number.isInteger(value);
  if (valueType === 'BOOLEAN') return typeof value === 'boolean';
  if (valueType === 'TEXT_ARRAY') {
    return Array.isArray(value)
      && value.length <= 50
      && value.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 500);
  }
  if (valueType === 'OBJECT') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  return false;
}

function locationRefValid(value: unknown): boolean {
  if (value == null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['label', 'city', 'area'].includes(key))) return false;
  const values = ['label', 'city', 'area'].map((key) => typeof record[key] === 'string' ? record[key].trim() : '');
  if (!values.some(Boolean)) return false;
  return values[0].length <= 240 && values[1].length <= 160 && values[2].length <= 160;
}

function geographyValid(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const geo = value as Record<string, unknown>;
  if (Object.keys(geo).some((key) => !['mode', 'start', 'end', 'waypoints', 'serviceArea'].includes(key))) return false;
  const mode = typeof geo.mode === 'string' ? geo.mode : '';
  if (!GEOGRAPHY_MODES.has(mode)) return false;
  const start = geo.start ?? null;
  const end = geo.end ?? null;
  const serviceArea = geo.serviceArea ?? null;
  const waypoints = geo.waypoints ?? [];
  if (!Array.isArray(waypoints) || waypoints.length > 20) return false;
  if (!locationRefValid(start) || !locationRefValid(end) || !locationRefValid(serviceArea) || !waypoints.every(locationRefValid)) return false;

  if (mode === 'REMOTE') return start == null && end == null && serviceArea == null && waypoints.length === 0;
  if (mode === 'STATIONARY') return start != null && end == null && serviceArea == null && waypoints.length === 0;
  if (mode === 'POINT_TO_POINT') return start != null && end != null && serviceArea == null && waypoints.length === 0;
  if (mode === 'MULTI_STOP') return start != null && serviceArea == null && (end != null || waypoints.length > 0);
  if (mode === 'AREA_BASED') return end == null && waypoints.length === 0 && (start != null || serviceArea != null);
  return false;
}

function valueMatchesContract(key: string, value: unknown): boolean {
  if (!isNeedFactV2Key(key)) return false;
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  if (!valueMatchesType(definition.valueType, value)) return false;

  if (key === 'need.title') return (value as string).trim().length <= 140;
  if (key === 'need.description') return (value as string).trim().length <= 6000;
  if (key === 'need.category') return (value as string).trim().length <= 120;
  if (key === 'need.price_mode') return PRICE_MODES.has(String(value));
  if (key === 'need.price_rsd') return Number(value) >= 1 && Number(value) <= 100000000;
  if (key === 'need.schedule_kind') return SCHEDULE_KINDS.has(String(value));
  if (key === 'need.people_needed') return Number(value) >= 1 && Number(value) <= 50;
  if (key === 'need.minimum_experience_years') return Number(value) >= 0 && Number(value) <= 60;
  if (key === 'need.exact_address') return (value as string).trim().length <= 1000;
  if (key === 'need.access_notes') return (value as string).trim().length <= 2000;
  if (key === 'need.task_geography') return geographyValid(value);
  return true;
}

function parseV2Output(parsed: any): ParsedTurn {
  rejectManualOnlyFacts(parsed);
  if (!exact(parsed, ['safety', 'assistantMessage', 'facts']) || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(parsed.safety) ||
    !Array.isArray(parsed.facts) || parsed.facts.length > 12) throw new Error('AI_V2_OUTPUT_INVALID');
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim()
    : '';
  if (!assistantMessage || assistantMessage.length > 1200 || safety === 'BLOCK' && parsed.facts.length) throw new Error('ASSISTANT_MESSAGE_INVALID');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    const seen = new Set<string>();
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      if (!exact(fact, ['key', 'valueJson', 'displayValue', 'evidence', 'confidence']) ||
        !isAiProposableNeedFactV2Key(key) || seen.has(key) || typeof fact.valueJson !== 'string') throw new Error('AI_V2_FACT_INVALID');
      let value: unknown;
      try { value = JSON.parse(fact.valueJson); } catch { throw new Error('AI_V2_FACT_INVALID'); }
      if (!valueMatchesContract(key, value)) throw new Error('AI_V2_FACT_INVALID');
      const displayValue = typeof fact?.displayValue === 'string' ? fact.displayValue.trim() : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim() : '';
      const confidence = fact?.confidence;
      if (!displayValue || displayValue.length > 1000 || !evidence || evidence.length > 500 ||
        typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('AI_V2_FACT_INVALID');
      seen.add(key);
      proposals.push({
        key,
        value,
        displayValue,
        confidence: Math.max(0, Math.min(1, confidence)),
        evidence,
      });
    }
  }
  return { safety, assistantMessage, proposals };
}

async function callGemini(
  key: string,
  model: string,
  schemaVersion: FactSchemaVersion,
  history: any[],
  activeFacts: any[],
  text: string,
  timeContext: ServerTimeContext,
  signal?: AbortSignal,
) {
  const contents = history.slice(-30).map((row) => ({
    role: row.role === 'ASSISTANT' ? 'model' : 'user',
    parts: [{ text: String(row.body ?? '').slice(0, 4000) }],
  }));
  contents.push({ role: 'user', parts: [{ text }] });
  const providerResponse = await boundedJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: schemaVersion === NEED_FACT_SCHEMA_V2 ? v2Instruction(activeFacts, timeContext) : legacyInstruction(activeFacts, timeContext) }] },
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: schemaVersion === NEED_FACT_SCHEMA_V2 ? v2ProviderSchema() : legacyProviderSchema(),
        },
      }),
    }, 131072, 12000, signal, true,
  );
  if (!providerResponse.ok) {
    console.error('GEMINI_GENERATE_FAILED', providerResponse.status);
    throw new Error('PROVIDER_HTTP_FAILED');
  }
  const payload = providerResponse.data;
  const raw = geminiText(payload);
  if (!raw) {
    const blocked = Boolean(payload?.promptFeedback?.blockReason)
      || (payload?.candidates ?? []).some((candidate: any) => ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(candidate?.finishReason));
    if (blocked) return { safety: 'BLOCK', assistantMessage: 'Ne mogu da pomognem sa tim zahtevom.', proposals: [] };
    throw new Error('PROVIDER_OUTPUT_MISSING');
  }
  const parsed = JSON.parse(raw);
  return schemaVersion === NEED_FACT_SCHEMA_V2 ? parseV2Output(parsed) : parseLegacyOutput(parsed);
}

async function callOpenAI(
  key: string,
  model: string,
  schemaVersion: FactSchemaVersion,
  history: any[],
  activeFacts: any[],
  text: string,
  timeContext: ServerTimeContext,
  signal?: AbortSignal,
) {
  const transcript = history.slice(-30).map((row) => ({
    role: row.role === 'ASSISTANT' ? 'assistant' : 'user',
    content: [{ type: row.role === 'ASSISTANT' ? 'output_text' : 'input_text', text: String(row.body ?? '').slice(0, 4000) }],
  }));
  transcript.push({ role: 'user', content: [{ type: 'input_text', text }] });
  const providerResponse = await boundedJson('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions: schemaVersion === NEED_FACT_SCHEMA_V2 ? v2Instruction(activeFacts, timeContext) : legacyInstruction(activeFacts, timeContext),
      input: transcript,
      text: {
        format: {
          type: 'json_schema',
          name: schemaVersion === NEED_FACT_SCHEMA_V2 ? 'uskoci_need_intake_v2' : 'uskoci_need_intake_legacy',
          strict: true,
          schema: openAiSchema(schemaVersion),
        },
      },
    }),
  }, 131072, 12000, signal, true);
  if (!providerResponse.ok) {
    console.error('OPENAI_RESPONSES_FAILED', providerResponse.status);
    throw new Error('PROVIDER_HTTP_FAILED');
  }
  const payload = providerResponse.data;
  if (payload?.status !== undefined && payload.status !== 'completed') throw new Error('PROVIDER_OUTPUT_INCOMPLETE');
  const raw = outputText(payload);
  if (!raw) throw new Error('PROVIDER_OUTPUT_MISSING');
  const parsed = JSON.parse(raw);
  return schemaVersion === NEED_FACT_SCHEMA_V2 ? parseV2Output(parsed) : parseLegacyOutput(parsed);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { code: 'METHOD_NOT_ALLOWED', message: 'Koristite POST.' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
  let body: any;
  try { body = (await boundedJson(req, {}, 18000, 3000, req.signal)).data; }
  catch { return response(400, { code: 'INVALID_JSON', message: 'Zahtev nije ispravan.' }); }
  if (!object(body) || Object.keys(body).some(key => !['conversationId', 'text', 'clientRequestId'].includes(key)))
    return response(400, { code: 'REQUEST_INVALID', message: 'Zahtev nije ispravan.' });
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim().toLowerCase() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!isUuid(conversationId)) return response(400, { code: 'CONVERSATION_ID_INVALID', message: 'Nacrt Zadatka nije ispravan.' });
  if (!text || text.length > 4000) return response(400, { code: 'MESSAGE_INVALID', message: 'Unesite poruku do 4.000 znakova.' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
  let accountId: string;
  try {
    // Actual Auth user verification; neither body IDs nor editable JWT metadata
    // are accepted as the account identity used by the service-only completion.
    const verified = await boundedJson(supabaseUrl + '/auth/v1/user', {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 65536, 5000, req.signal, true);
    if (!verified.ok || !isUuid(verified.data?.id)) return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
    accountId = verified.data.id.toLowerCase();
  } catch { return response(401, { code: 'AUTH_REQUIRED', message: 'Nalog nije mogao da se proveri.' }); }
  const release = admitUser(accountId);
  if (!release) return response(429, { code: 'AI_RATE_LIMITED', message: 'Sačekajte trenutak pre sledeće poruke.' });
  let requestId = '', attemptId: string | null = null, claimedTurnId: string | null = null;
  let serviceRoleKey = '';
  const rpc = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => boundedJson(supabaseUrl + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: { apikey: serviceRoleKey, Authorization: 'Bearer ' + serviceRoleKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }, 524288, 8000, signal);
  const identityArgs = () => ({ p_account_id: accountId, p_conversation_id: conversationId, p_client_request_id: requestId });
  const retireAttempt = async () => {
    if (!attemptId) return;
    try {
      // Metadata only; never retries the materializer after an uncertain result.
      await rpc('rpc_ai_fail_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId });
    } catch { /* Readback or expiry resolves an uncertain metadata acknowledgment. */ }
  };
  try {
    const conversationQuery = await boundedJson(supabaseUrl + '/rest/v1/ai_conversations?id=eq.' + encodeURIComponent(conversationId) +
      '&purpose=eq.NEED_INTAKE&select=id,account_id,fact_schema_version,status&limit=1', {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 8192, 8000, req.signal);
    if (!conversationQuery.ok) return response(502, { code: 'CONVERSATION_READ_FAILED', message: 'Nacrt nije mogao da se proveri.' });
    const rows = conversationQuery.data;
    if (!Array.isArray(rows) || rows.length !== 1 || !sameUuid(rows[0]?.id, conversationId) || !sameUuid(rows[0]?.account_id, accountId))
      return response(404, { code: 'CONVERSATION_NOT_FOUND', message: 'Nacrt nije dostupan ovom nalogu.' });
    const schemaVersion: FactSchemaVersion = rows[0].fact_schema_version === NEED_FACT_SCHEMA_V2 ? NEED_FACT_SCHEMA_V2 : LEGACY_FACT_SCHEMA_V1;
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      if (!exact(body, ['conversationId', 'text', 'clientRequestId']) || !isUuid(body.clientRequestId))
        return response(400, { code: 'CLIENT_REQUEST_ID_INVALID', message: 'Ponovo otvorite unos pre slanja.' });
      requestId = body.clientRequestId.toLowerCase();
    } else if (!exact(body, ['conversationId', 'text']) || rows[0].status !== 'OPEN') {
      return response(409, { code: 'CONVERSATION_NOT_OPEN', message: 'Ovaj razgovor više nije otvoren.' });
    }
    serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceRoleKey) return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
    let history: any[], activeFacts: any[];
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      const result = await rpc('rpc_ai_claim_need_turn_v2_service', { ...identityArgs(), p_user_message: text }, req.signal);
      if (!result.ok) {
        const name = result.data?.message;
        if (name === 'AI_RATE_LIMITED') return response(429, { code: 'AI_RATE_LIMITED', message: 'Sačekajte trenutak pre sledeće poruke.' });
        if (name === 'AI_REQUEST_ID_REUSED') return response(409, { code: 'AI_REQUEST_ID_REUSED', message: 'Ovaj pokušaj pripada drugoj poruci. Proverite razgovor.' });
        return response(502, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Proverite ishod poruke pre nastavka.' });
      }
      const value = result.data;
      if (!exact(value, ['turn', 'claim']) || !validTurn(value.turn, conversationId, requestId)) throw new Error('AI_CLAIM_INVALID');
      if (value.claim === null) return turnResponse(value.turn);
      const claim = value.claim;
      if (value.turn.state !== 'PROCESSING' || !exact(claim, ['attemptId', 'leaseExpiresAt', 'context']) || !isUuid(claim.attemptId) ||
        typeof claim.leaseExpiresAt !== 'string' || !Number.isFinite(Date.parse(claim.leaseExpiresAt)) || Date.parse(claim.leaseExpiresAt) <= Date.now())
        throw new Error('AI_CLAIM_INVALID');
      attemptId = claim.attemptId; claimedTurnId = value.turn.turnId;
      if (!validClaimContext(claim.context)) throw new Error('AI_CONTEXT_INVALID');
      history = claim.context.history; activeFacts = claim.context.activeFacts;
    } else {
      const headers = { apikey: anonKey, Authorization: authorization };
      const [messages, facts] = await Promise.all([
        boundedJson(supabaseUrl + '/rest/v1/ai_messages?conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&select=role,body,sequence_no&order=sequence_no.desc&limit=40', { headers }, 262144, 8000, req.signal),
        boundedJson(supabaseUrl + '/rest/v1/ai_structured_facts?conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&fact_key=in.(' + encodeURIComponent(AI_CONTEXT_FACT_KEYS.map(key => JSON.stringify(key)).join(',')) +
          ')&superseded_at=is.null&select=fact_key,fact_value,value_type,display_value,fact_schema_version,status,source,created_at&order=created_at.asc', { headers }, 262144, 8000, req.signal),
      ]);
      if (!messages.ok || !facts.ok || !Array.isArray(messages.data) || !Array.isArray(facts.data)) throw new Error('AI_CONTEXT_INVALID');
      history = [...messages.data].reverse(); activeFacts = facts.data;
    }
    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '', geminiModel = Deno.env.get('GEMINI_MODEL') ?? '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '', openaiModel = Deno.env.get('OPENAI_MODEL') ?? '';
    const selectedProvider = Deno.env.get('AI_PROVIDER');
    const provider = selectedProvider === undefined
      ? (openaiKey && openaiModel ? 'openai' : geminiKey && geminiModel ? 'gemini' : '') : selectedProvider;
    const timeContext = serverTimeContext(new Date());
    let aiTurn: ParsedTurn;
    try {
      if (provider === 'gemini' && geminiKey && geminiModel)
        aiTurn = await callGemini(geminiKey, geminiModel, schemaVersion, history, activeFacts, text, timeContext, req.signal);
      else if (provider === 'openai' && openaiKey && openaiModel)
        aiTurn = await callOpenAI(openaiKey, openaiModel, schemaVersion, history, activeFacts, text, timeContext, req.signal);
      else {
        await retireAttempt();
        return response(503, { code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI obrada još nije aktivirana na serveru.' });
      }
    } catch {
      console.error('AI_PROVIDER_FAILED');
      await retireAttempt();
      return response(502, { code: 'AI_PROVIDER_FAILED', message: 'AI obrada trenutno nije uspela. Proverite ishod pre nastavka.' });
    }
    if (req.signal.aborted) throw new Error('AI_REQUEST_CANCELLED');
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      const result = await rpc('rpc_ai_complete_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId,
        p_user_message: text, p_assistant_message: aiTurn.assistantMessage, p_safety: aiTurn.safety, p_proposals: aiTurn.proposals }, req.signal);
      if (!result.ok || !validTurn(result.data, conversationId, requestId) || result.data.turnId !== claimedTurnId)
        throw new Error('AI_TURN_RECEIPT_INVALID');
      if (result.data.state === 'SUCCEEDED' && (result.data.receipt.proposedCount !== aiTurn.proposals.length || result.data.receipt.safety !== aiTurn.safety))
        throw new Error('AI_TURN_RECEIPT_INVALID');
      return turnResponse(result.data);
    }
    // Existing LEGACY_TEXT_V1 path remains isolated. V2 never calls this writer.
    const result = await rpc('rpc_ai_apply_legacy_need_turn_service', { p_account_id: accountId, p_conversation_id: conversationId,
      p_user_message: text, p_assistant_message: aiTurn.assistantMessage, p_safety: aiTurn.safety, p_proposals: aiTurn.proposals }, req.signal);
    if (!result.ok) throw new Error('AI_LEGACY_PERSIST_FAILED');
    const proposedCount = Number(result.data?.proposedCount ?? result.data?.proposed_count ?? aiTurn.proposals.length);
    return response(200, { predlozeno: Number.isFinite(proposedCount) ? Math.max(0, Math.trunc(proposedCount)) : aiTurn.proposals.length,
      assistantMessage: aiTurn.assistantMessage, safety: aiTurn.safety, blocked: aiTurn.safety === 'BLOCK', schemaVersion, provider });
  } catch {
    await retireAttempt();
    return response(502, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Potvrda nije stigla. Proverite ishod poruke pre nastavka.' });
  } finally { release(); }
});
