// @ts-nocheck
// USKOCI server-side AI intake boundary.
// Provider secrets live only in Supabase Edge Function environment. Never expose
// GEMINI_API_KEY / OPENAI_API_KEY / SUPABASE_SERVICE_ROLE_KEY to Expo, source or logs.

import {
  LEGACY_FACT_SCHEMA_V1,
  NEED_FACT_SCHEMA_V2,
  NEED_FACT_V2_DEFINITIONS,
  NEED_FACT_V2_KEYS,
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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_MODES = new Set(['FASTEST', 'MY_PRICE', 'OFFERS']);
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

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
        maxItems: 20,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: NEED_FACT_V2_KEYS },
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

function commonInstruction(activeFacts: any[]) {
  const known = activeFacts.map((fact) => ({
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
    'AI predlog nikada nije ljudska potvrda i nikada nije dozvola za objavu.',
    'Safety je samo razgovorni signal. Ne tvrdite da je nešto zakonski dozvoljeno na osnovu sopstvene memorije. Ako je pravno/policy nejasno ili regulisano, koristite REVIEW; ako se bezbedno pitanje može razjasniti, CLARIFY.',
    `Aktuelne server-side činjenice: ${JSON.stringify(known).slice(0, 8000)}`,
  ];
}

function legacyInstruction(activeFacts: any[]) {
  return [
    'Vi ste USKOČI razgovorni AI asistent koji vodi korisnika kroz unos jednog Zadatka.',
    ...commonInstruction(activeFacts),
    'Iz NAJNOVIJE poruke izdvojite samo podržane legacy činjenice.',
    'evidence mora biti kratak doslovan isečak najnovije korisnikove poruke.',
  ].join(' ');
}

function v2Instruction(activeFacts: any[]) {
  const registry = NEED_FACT_V2_KEYS.map((key) => ({ key, ...NEED_FACT_V2_DEFINITIONS[key] }));
  return [
    'Vi ste USKOČI AI kopilot za sastavljanje kvalitetnog Zadatka iz prirodnog razgovora.',
    ...commonInstruction(activeFacts),
    'Sastavite lep, kratak i smislen need.title kada razgovor daje dovoljno osnove. Need.description može biti uredna ljudska sinteza potvrđenih/poznatih činjenica i najnovije poruke, ali ne sme dodati nijedan novi materijalni uslov.',
    'Za obične atomske činjenice evidence je kratak citat korisnika. Za naslov/opis koji su sinteza, evidence može biti kratko: "Sinteza potvrđenih činjenica i razgovora".',
    'valueJson je JSON tekst stvarne tipizovane vrednosti: tekst/enum/timestamp kao JSON string sa navodnicima, integer kao broj, boolean true/false, niz kao JSON niz stringova, geography kao JSON objekat.',
    'need.price_mode može biti samo FASTEST, MY_PRICE ili OFFERS. Ako je MY_PRICE, need.price_rsd mora biti poznat pre spremnosti za nacrt.',
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

function parseLegacyOutput(parsed: any): ParsedTurn {
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
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim().slice(0, 1200)
    : '';
  if (!assistantMessage) throw new Error('ASSISTANT_MESSAGE_MISSING');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    const seen = new Set<string>();
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      if (!isNeedFactV2Key(key) || seen.has(key)) continue;
      let value: unknown;
      try { value = JSON.parse(String(fact?.valueJson ?? '')); } catch { continue; }
      if (!valueMatchesContract(key, value)) continue;
      const displayValue = typeof fact?.displayValue === 'string' ? fact.displayValue.trim().slice(0, 1000) : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim().slice(0, 500) : '';
      const confidence = Number(fact?.confidence);
      if (!displayValue || !evidence || !Number.isFinite(confidence)) continue;
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
) {
  const contents = history.slice(-30).map((row) => ({
    role: row.role === 'ASSISTANT' ? 'model' : 'user',
    parts: [{ text: String(row.body ?? '').slice(0, 4000) }],
  }));
  contents.push({ role: 'user', parts: [{ text }] });
  const providerResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: schemaVersion === NEED_FACT_SCHEMA_V2 ? v2Instruction(activeFacts) : legacyInstruction(activeFacts) }] },
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: schemaVersion === NEED_FACT_SCHEMA_V2 ? v2ProviderSchema() : legacyProviderSchema(),
        },
      }),
    },
  );
  if (!providerResponse.ok) {
    console.error('GEMINI_GENERATE_FAILED', providerResponse.status);
    throw new Error('PROVIDER_HTTP_FAILED');
  }
  const payload = await providerResponse.json();
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
) {
  const transcript = history.slice(-30).map((row) => ({
    role: row.role === 'ASSISTANT' ? 'assistant' : 'user',
    content: [{ type: row.role === 'ASSISTANT' ? 'output_text' : 'input_text', text: String(row.body ?? '').slice(0, 4000) }],
  }));
  transcript.push({ role: 'user', content: [{ type: 'input_text', text }] });
  const providerResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions: schemaVersion === NEED_FACT_SCHEMA_V2 ? v2Instruction(activeFacts) : legacyInstruction(activeFacts),
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
  });
  if (!providerResponse.ok) {
    console.error('OPENAI_RESPONSES_FAILED', providerResponse.status);
    throw new Error('PROVIDER_HTTP_FAILED');
  }
  const payload = await providerResponse.json();
  const raw = outputText(payload);
  if (!raw) throw new Error('PROVIDER_OUTPUT_MISSING');
  const parsed = JSON.parse(raw);
  return schemaVersion === NEED_FACT_SCHEMA_V2 ? parseV2Output(parsed) : parseLegacyOutput(parsed);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { code: 'METHOD_NOT_ALLOWED', message: 'Koristite POST.' });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });

  let body: any;
  try { body = await req.json(); } catch { return response(400, { code: 'INVALID_JSON', message: 'Zahtev nije ispravan.' }); }

  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!uuidPattern.test(conversationId)) return response(400, { code: 'CONVERSATION_ID_INVALID', message: 'Nacrt Zadatka nije ispravan.' });
  if (!text || text.length > 4000) return response(400, { code: 'MESSAGE_INVALID', message: text ? 'Poruka može imati najviše 4000 znakova.' : 'Unesite poruku.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('AI_EDGE_SUPABASE_ENV_MISSING');
    return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
  }

  const conversationQuery = await postgrest(
    supabaseUrl,
    anonKey,
    authorization,
    `ai_conversations?id=eq.${encodeURIComponent(conversationId)}&purpose=eq.NEED_INTAKE&status=eq.OPEN&select=id,account_id,fact_schema_version&limit=1`,
    { method: 'GET' },
  );
  if (!conversationQuery.ok) {
    console.error('AI_EDGE_CONVERSATION_QUERY_FAILED', conversationQuery.status);
    return response(502, { code: 'CONVERSATION_READ_FAILED', message: 'Nacrt nije mogao da se proveri.' });
  }
  const conversations = await conversationQuery.json();
  if (!Array.isArray(conversations) || conversations.length !== 1) return response(404, { code: 'CONVERSATION_NOT_FOUND', message: 'Nacrt nije dostupan ovom nalogu.' });

  const accountId = typeof conversations[0]?.account_id === 'string' ? conversations[0].account_id : '';
  if (!uuidPattern.test(accountId)) return response(500, { code: 'SERVER_IDENTITY_ERROR', message: 'Serverski identitet nije mogao da se potvrdi.' });
  const schemaVersion: FactSchemaVersion = conversations[0]?.fact_schema_version === NEED_FACT_SCHEMA_V2
    ? NEED_FACT_SCHEMA_V2
    : LEGACY_FACT_SCHEMA_V1;

  const [historyResponse, factsResponse] = await Promise.all([
    postgrest(
      supabaseUrl, anonKey, authorization,
      `ai_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=role,body,sequence_no&order=sequence_no.asc&limit=40`,
      { method: 'GET' },
    ),
    postgrest(
      supabaseUrl, anonKey, authorization,
      `ai_structured_facts?conversation_id=eq.${encodeURIComponent(conversationId)}&superseded_at=is.null&select=fact_key,fact_value,value_type,display_value,fact_schema_version,status,source,created_at&order=created_at.asc`,
      { method: 'GET' },
    ),
  ]);
  if (!historyResponse.ok || !factsResponse.ok) {
    console.error('AI_EDGE_CONTEXT_QUERY_FAILED', historyResponse.status, factsResponse.status);
    return response(502, { code: 'CONVERSATION_CONTEXT_FAILED', message: 'Razgovor trenutno nije mogao da se nastavi.' });
  }
  const history = await historyResponse.json();
  const activeFacts = await factsResponse.json();

  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  const geminiModel = Deno.env.get('GEMINI_MODEL') ?? '';
  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  const openaiModel = Deno.env.get('OPENAI_MODEL') ?? '';

  let aiTurn: ParsedTurn;
  let provider = '';
  try {
    if (geminiKey && geminiModel) {
      provider = 'gemini';
      aiTurn = await callGemini(geminiKey, geminiModel, schemaVersion, Array.isArray(history) ? history : [], Array.isArray(activeFacts) ? activeFacts : [], text);
    } else if (openaiKey && openaiModel) {
      provider = 'openai';
      aiTurn = await callOpenAI(openaiKey, openaiModel, schemaVersion, Array.isArray(history) ? history : [], Array.isArray(activeFacts) ? activeFacts : [], text);
    } else {
      return response(503, { code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI obrada još nije aktivirana na serveru.' });
    }
  } catch (error) {
    console.error('AI_PROVIDER_FAILED', error instanceof Error ? error.message : 'unknown');
    return response(502, { code: 'AI_PROVIDER_FAILED', message: 'AI obrada trenutno nije uspela.' });
  }

  const rpc = schemaVersion === NEED_FACT_SCHEMA_V2
    ? 'rpc/rpc_ai_apply_interview_turn_v2_service'
    : 'rpc/rpc_ai_apply_interview_turn_service';
  const persist = await postgrest(
    supabaseUrl,
    serviceRoleKey,
    `Bearer ${serviceRoleKey}`,
    rpc,
    {
      method: 'POST',
      body: JSON.stringify({
        p_account_id: accountId,
        p_conversation_id: conversationId,
        p_user_message: text,
        p_assistant_message: aiTurn.assistantMessage,
        p_safety: aiTurn.safety,
        p_proposals: aiTurn.proposals,
      }),
    },
  );
  if (!persist.ok) {
    console.error('AI_TURN_PERSIST_FAILED', persist.status, schemaVersion);
    return response(502, { code: 'AI_TURN_PERSIST_FAILED', message: 'AI odgovor nije mogao bezbedno da se sačuva.' });
  }

  const persisted = await persist.json();
  const proposedCount = Number(persisted?.proposedCount ?? persisted?.proposed_count ?? aiTurn.proposals.length);
  return response(200, {
    predlozeno: Number.isFinite(proposedCount) ? Math.max(0, Math.trunc(proposedCount)) : aiTurn.proposals.length,
    assistantMessage: aiTurn.assistantMessage,
    safety: aiTurn.safety,
    blocked: aiTurn.safety === 'BLOCK',
    schemaVersion,
    provider,
  });
});
