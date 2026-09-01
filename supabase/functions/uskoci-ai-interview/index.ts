// @ts-nocheck
// USKOCI server-side AI intake boundary.
// Secrets live only in Supabase Edge Function environment. Never expose
// OPENAI_API_KEY / OPENAI_MODEL / SUPABASE_SERVICE_ROLE_KEY to Expo, source or logs.

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

  // Caller JWT + RLS proves ownership before provider spend. The account id
  // returned by this caller-scoped query is the only identity passed to the
  // service-role atomic writer later in the request.
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

  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  const model = Deno.env.get('OPENAI_MODEL') ?? '';
  if (!openaiKey || !model) {
    return response(503, {
      code: 'AI_PROVIDER_NOT_CONFIGURED',
      message: 'AI obrada još nije aktivirana na serveru.',
    });
  }

  const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
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
        'assistantMessage mora uvek sadržati korisnu, kratku poruku za korisnika.',
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
  if (!assistantMessage) {
    console.error('OPENAI_ASSISTANT_MESSAGE_MISSING');
    return response(502, { code: 'AI_OUTPUT_INVALID', message: 'AI odgovor nije mogao da se obradi.' });
  }

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
        p_assistant_message: assistantMessage,
        p_safety: safety,
        p_proposals: proposals,
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
  const proposedCount = Number(persisted?.proposedCount ?? persisted?.proposed_count ?? proposals.length);
  return response(200, {
    predlozeno: Number.isFinite(proposedCount) ? Math.max(0, Math.trunc(proposedCount)) : proposals.length,
    assistantMessage,
    safety,
    blocked: safety === 'BLOCK',
  });
});
