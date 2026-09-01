// @ts-nocheck
// USKOCI server-side AI intake boundary.
// Secrets live only in Supabase Edge Function environment. Never expose
// OPENAI_API_KEY / OPENAI_MODEL to Expo, EXPO_PUBLIC_*, source or logs.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FACT_KEYS = [
  'naslov',
  'opis',
  'kategorija',
  'datum',
  'vreme',
  'polaziste',
  'odrediste',
  'osoba',
  'vozilo',
  'uslovi',
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

async function postgrest(
  url: string,
  anonKey: string,
  authorization: string,
  path: string,
  init: RequestInit = {},
) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
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
  if (!supabaseUrl || !anonKey) {
    console.error('AI_EDGE_SUPABASE_ENV_MISSING');
    return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
  }

  // Ownership + purpose are checked through the caller JWT and RLS before any
  // provider call. A user cannot spend AI capacity against somebody else's draft.
  const conversationQuery = await postgrest(
    supabaseUrl,
    anonKey,
    authorization,
    `ai_conversations?id=eq.${encodeURIComponent(conversationId)}&purpose=eq.NEED_INTAKE&status=eq.OPEN&select=id&limit=1`,
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

  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  const model = Deno.env.get('OPENAI_MODEL') ?? '';
  if (!apiKey || !model) {
    return response(503, {
      code: 'AI_PROVIDER_NOT_CONFIGURED',
      message: 'AI obrada još nije aktivirana na serveru.',
    });
  }

  const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: [
        'Vi ste USKOČI intake parser za marketplace Potrebu.',
        'Odgovarajte na srpskom latinicom.',
        'Iz korisnikove poslednje poruke izdvojite samo činjenice koje su stvarno podržane tekstom.',
        'Ne izmišljajte adresu, cenu, datum, vreme, vozilo, broj ljudi ili uslove.',
        'Svaka činjenica je samo AI predlog i mora kasnije biti potvrđena od korisnika.',
        'evidence mora biti kratak doslovan isečak korisnikove poruke koji podržava predlog.',
        'Ako je zahtev nejasan, postavite jedno kratko sledeće pitanje u assistantMessage.',
        'Ako zahtev deluje zabranjeno ili rizično, postavite safety na REVIEW ili BLOCK i ne predlažite rizične činjenice.',
      ].join(' '),
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: `JSON extraction input:\n${text}` }],
      }],
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

  if (!openaiResponse.ok) {
    console.error('OPENAI_RESPONSES_FAILED', openaiResponse.status);
    return response(502, { code: 'AI_PROVIDER_FAILED', message: 'AI obrada trenutno nije uspela.' });
  }

  const providerPayload = await openaiResponse.json();
  const rawOutput = outputText(providerPayload);
  if (!rawOutput) {
    console.error('OPENAI_STRUCTURED_OUTPUT_MISSING');
    return response(502, { code: 'AI_OUTPUT_INVALID', message: 'AI odgovor nije mogao da se obradi.' });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    console.error('OPENAI_STRUCTURED_OUTPUT_PARSE_FAILED');
    return response(502, { code: 'AI_OUTPUT_INVALID', message: 'AI odgovor nije mogao da se obradi.' });
  }

  const safety = ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(parsed?.safety)
    ? parsed.safety
    : 'REVIEW';
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim().slice(0, 1000)
    : '';

  if (safety === 'BLOCK') {
    return response(422, {
      code: 'AI_SAFETY_BLOCK',
      message: assistantMessage || 'Ovaj zahtev ne može da se obradi kroz USKOČI.',
      safety,
      predlozeno: 0,
    });
  }

  const facts = Array.isArray(parsed?.facts) ? parsed.facts : [];
  let proposed = 0;
  for (const fact of facts) {
    const key = typeof fact?.key === 'string' ? fact.key : '';
    const value = typeof fact?.value === 'string' ? fact.value.trim() : '';
    const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim().slice(0, 500) : '';
    const confidence = Number(fact?.confidence);
    if (!factKeySet.has(key) || !value || !evidence || !Number.isFinite(confidence)) continue;

    const rpc = await postgrest(
      supabaseUrl,
      anonKey,
      authorization,
      'rpc/rpc_ai_propose_fact',
      {
        method: 'POST',
        body: JSON.stringify({
          p_conversation_id: conversationId,
          p_fact_key: key,
          p_fact_value: value,
          p_source: 'AI_INFERENCE',
          p_scope: 'NEED_DRAFT',
          p_confidence: Math.max(0, Math.min(1, confidence)),
          p_evidence: evidence,
        }),
      },
    );
    if (!rpc.ok) {
      console.error('AI_FACT_PROPOSAL_FAILED', rpc.status, key);
      return response(502, {
        code: 'AI_FACT_PERSIST_FAILED',
        message: 'AI predlog nije mogao bezbedno da se sačuva.',
      });
    }
    proposed += 1;
  }

  return response(200, {
    predlozeno: proposed,
    assistantMessage,
    safety,
  });
});
