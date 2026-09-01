// @ts-nocheck
// USKOCI server-side AI intake boundary.
// Provider secrets live only in Supabase Edge Function environment. Never expose
// GEMINI_API_KEY / OPENAI_API_KEY / SUPABASE_SERVICE_ROLE_KEY to Expo, source or logs.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FACT_KEYS = [
  'naslov', 'opis', 'kategorija', 'datum', 'vreme',
  'polaziste', 'odrediste', 'osoba', 'vozilo', 'uslovi',
] as const;

const factKeySet = new Set<string>(FACT_KEYS);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function outputText(payload: any): string | null {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  for (const item of payload?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
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

function providerSchema() {
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
            key: { type: 'STRING', enum: FACT_KEYS },
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

function systemInstruction(activeFacts: any[]) {
  const known = activeFacts.map((fact) => ({
    key: fact.fact_key,
    value: fact.fact_value,
    status: fact.status,
  }));

  return [
    'Vi ste USKOČI razgovorni AI asistent koji vodi Naručioca kroz unos jedne Potrebe na marketplace-u.',
    'Odgovarajte prirodno na srpskom latinicom, kratko i ljudski.',
    'Ovo je pravi višekoračni razgovor, a ne formular. Ne govorite "Razumeo sam ovako" posle svake poruke.',
    'Koristite istoriju razgovora i već poznate činjenice; nikada ne pitajte ponovo ono što je već jasno.',
    'Ako nešto važno nedostaje ili je nejasno, postavite jedno najkorisnije sledeće pitanje, najviše dva usko povezana pitanja.',
    'Pitanja prilagodite poslu. Za selidbu/prevoz možete pitati polazište, odredište, sprat, lift, dimenzije, rastavljanje, potreban broj ljudi, vozilo i vreme samo kada je relevantno i nije već poznato.',
    'Ako korisnik u jednoj poruci već kaže više podataka, izvucite sve podržane podatke i ne tražite ih ponovo.',
    'Iz korisnikove NAJNOVIJE poruke izdvojite samo činjenice koje su stvarno podržane tom porukom. Ne izmišljajte adresu, cenu, datum, vreme, vozilo, broj ljudi ili uslove.',
    'Ako korisnik ispravlja raniji podatak, predložite novu vrednost tog istog ključa. Server će bezbedno potisnuti staru aktivnu vrednost.',
    'Svaka AI činjenica je samo predlog NEEDS_CONFIRMATION i korisnik je kasnije potvrđuje ili ispravlja.',
    'evidence mora biti kratak doslovan isečak najnovije korisnikove poruke koji podržava predlog.',
    'assistantMessage mora uvek biti korisna naredna poruka korisniku. Sažetak koristite samo kada стварно помаже или пред завршну проверу.',
    'Ako zahtev deluje zabranjeno ili rizično, stavite safety REVIEW ili BLOCK i ne predlažite rizične činjenice.',
    `Aktuelne server-side činjenice (mogu biti AI predlozi ili potvrđene): ${JSON.stringify(known).slice(0, 6000)}`,
  ].join(' ');
}

function parseProviderOutput(parsed: any) {
  const safety = ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(parsed?.safety)
    ? parsed.safety
    : 'REVIEW';
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim().slice(0, 1000)
    : '';
  if (!assistantMessage) throw new Error('ASSISTANT_MESSAGE_MISSING');

  const proposals: Array<{ key: string; value: string; confidence: number; evidence: string }> = [];
  if (safety !== 'BLOCK') {
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      const value = typeof fact?.value === 'string' ? fact.value.trim().slice(0, 2000) : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim().slice(0, 500) : '';
      const confidence = Number(fact?.confidence);
      if (!factKeySet.has(key) || !value || !evidence || !Number.isFinite(confidence)) continue;
      proposals.push({
        key,
        value,
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
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction(activeFacts) }] },
        contents,
        generationConfig: {
          temperature: 0.25,
          responseMimeType: 'application/json',
          responseSchema: providerSchema(),
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
      || (payload?.candidates ?? []).some((candidate: any) =>
        ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(candidate?.finishReason));
    if (blocked) {
      return {
        safety: 'BLOCK',
        assistantMessage: 'Ne mogu da pomognem sa tim zahtevom.',
        proposals: [],
      };
    }
    console.error('GEMINI_STRUCTURED_OUTPUT_MISSING');
    throw new Error('PROVIDER_OUTPUT_MISSING');
  }

  try {
    return parseProviderOutput(JSON.parse(raw));
  } catch {
    console.error('GEMINI_STRUCTURED_OUTPUT_INVALID');
    throw new Error('PROVIDER_OUTPUT_INVALID');
  }
}

async function callOpenAI(
  key: string,
  model: string,
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
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: systemInstruction(activeFacts),
      input: transcript,
      text: {
        format: {
          type: 'json_schema',
          name: 'uskoci_need_intake',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              safety: { type: 'string', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
              assistantMessage: { type: 'string' },
              facts: {
                type: 'array',
                maxItems: 10,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    key: { type: 'string', enum: FACT_KEYS },
                    value: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    evidence: { type: 'string' },
                  },
                  required: ['key', 'value', 'confidence', 'evidence'],
                },
              },
            },
            required: ['safety', 'assistantMessage', 'facts'],
          },
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
  if (!raw) {
    console.error('OPENAI_STRUCTURED_OUTPUT_MISSING');
    throw new Error('PROVIDER_OUTPUT_MISSING');
  }
  try {
    return parseProviderOutput(JSON.parse(raw));
  } catch {
    console.error('OPENAI_STRUCTURED_OUTPUT_INVALID');
    throw new Error('PROVIDER_OUTPUT_INVALID');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return response(405, { code: 'METHOD_NOT_ALLOWED', message: 'Koristite POST.' });
  }

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return response(400, { code: 'INVALID_JSON', message: 'Zahtev nije ispravan.' });
  }

  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId.trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!uuidPattern.test(conversationId)) {
    return response(400, { code: 'CONVERSATION_ID_INVALID', message: 'Nacrt Potrebe nije ispravan.' });
  }
  if (!text || text.length > 4000) {
    return response(400, {
      code: 'MESSAGE_INVALID',
      message: text ? 'Poruka može imati najviše 4000 znakova.' : 'Unesite poruku.',
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('AI_EDGE_SUPABASE_ENV_MISSING');
    return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
  }

  // Caller JWT + RLS proves ownership before any provider spend.
  const conversationQuery = await postgrest(
    supabaseUrl,
    anonKey,
    authorization,
    `ai_conversations?id=eq.${encodeURIComponent(conversationId)}&purpose=eq.NEED_INTAKE&status=eq.OPEN&select=id,account_id&limit=1`,
    { method: 'GET' },
  );
  if (!conversationQuery.ok) {
    console.error('AI_EDGE_CONVERSATION_QUERY_FAILED', conversationQuery.status);
    return response(502, { code: 'CONVERSATION_READ_FAILED', message: 'Nacrt nije mogao da se proveri.' });
  }
  const conversations = await conversationQuery.json();
  if (!Array.isArray(conversations) || conversations.length !== 1) {
    return response(404, { code: 'CONVERSATION_NOT_FOUND', message: 'Nacrt nije dostupan ovom nalogu.' });
  }
  const accountId = typeof conversations[0]?.account_id === 'string' ? conversations[0].account_id : '';
  if (!uuidPattern.test(accountId)) {
    console.error('AI_EDGE_ACCOUNT_ID_INVALID');
    return response(500, { code: 'SERVER_IDENTITY_ERROR', message: 'Serverski identitet nije mogao da se potvrdi.' });
  }

  // Read server history + active facts with caller JWT/RLS. Provider sees the
  // same conversation state the authenticated user is allowed to see.
  const [historyResponse, factsResponse] = await Promise.all([
    postgrest(
      supabaseUrl,
      anonKey,
      authorization,
      `ai_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=role,body,sequence_no&order=sequence_no.asc&limit=40`,
      { method: 'GET' },
    ),
    postgrest(
      supabaseUrl,
      anonKey,
      authorization,
      `ai_structured_facts?conversation_id=eq.${encodeURIComponent(conversationId)}&superseded_at=is.null&select=fact_key,fact_value,status,source,created_at&order=created_at.asc`,
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

  let aiTurn: { safety: string; assistantMessage: string; proposals: Array<{ key: string; value: string; confidence: number; evidence: string }> };
  let provider = '';
  try {
    if (geminiKey && geminiModel) {
      provider = 'gemini';
      aiTurn = await callGemini(geminiKey, geminiModel, Array.isArray(history) ? history : [], Array.isArray(activeFacts) ? activeFacts : [], text);
    } else if (openaiKey && openaiModel) {
      provider = 'openai';
      aiTurn = await callOpenAI(openaiKey, openaiModel, Array.isArray(history) ? history : [], Array.isArray(activeFacts) ? activeFacts : [], text);
    } else {
      return response(503, {
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'AI obrada još nije aktivirana na serveru.',
      });
    }
  } catch {
    return response(502, { code: 'AI_PROVIDER_FAILED', message: 'AI obrada trenutno nije uspela.' });
  }

  // One service-role-only RPC is the entire persistence boundary. If any fact or
  // message is invalid, PostgreSQL rolls the whole turn back; partial AI state
  // cannot survive.
  const persist = await postgrest(
    supabaseUrl,
    serviceRoleKey,
    `Bearer ${serviceRoleKey}`,
    'rpc/rpc_ai_apply_interview_turn_service',
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
    console.error('AI_TURN_PERSIST_FAILED', persist.status);
    return response(502, {
      code: 'AI_TURN_PERSIST_FAILED',
      message: 'AI odgovor nije mogao bezbedno da se sačuva.',
    });
  }

  const persisted = await persist.json();
  const proposedCount = Number(persisted?.proposedCount ?? persisted?.proposed_count ?? aiTurn.proposals.length);
  return response(200, {
    predlozeno: Number.isFinite(proposedCount) ? Math.max(0, Math.trunc(proposedCount)) : aiTurn.proposals.length,
    assistantMessage: aiTurn.assistantMessage,
    safety: aiTurn.safety,
    blocked: aiTurn.safety === 'BLOCK',
    provider,
  });
});
