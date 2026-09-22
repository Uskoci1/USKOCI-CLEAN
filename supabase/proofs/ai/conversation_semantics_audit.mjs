// Diagnostic observations, NOT a proof that conversation quality is acceptable.
// Executes the existing handler with synthetic Auth/SQL/provider transport only.
// No real fetch, environment, account, secret or paid provider is available.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadOwnedIntakeHandler } from './owned_intake_edge_runtime.mjs';

const id = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const account = id(1), conversation = id(2), request = id(3), turnId = id(4), attemptId = id(5);
const now = '2026-09-21T10:00:00.000Z';
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return Date.parse(now); }
}
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const turn = (state, count = 0) => ({ conversationId: conversation, clientRequestId: request,
  turnId, state, retryAllowed: false, receipt: state === 'SUCCEEDED' ? {
    userMessageId: id(6), assistantMessageId: id(7), proposedCount: count,
    safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true,
  } : null });
const fact = (key, value, valueType = 'TEXT', display = String(value)) => ({
  fact_key: key, fact_value: value, value_type: valueType, display_value: display,
  fact_schema_version: 'NEED_FACT_V2', status: 'NEEDS_CONFIRMATION',
  source: 'AI_INFERENCE', created_at: now,
});
const proposal = (key, value, evidence = 'Synthetic user statement') => ({
  key, valueJson: JSON.stringify(value), displayValue: String(value), evidence, confidence: 0.95,
});

async function observe({ input, answer, facts = [], activeFacts = [], history = [] }) {
  let providerBody, completion, providerCalls = 0;
  const environment = {
    SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_ANON_KEY: 'SYNTHETIC_PUBLIC',
    SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC_SERVICE', AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'SYNTHETIC_PROVIDER', GEMINI_MODEL: 'gemini-3.8-flash',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'true',
  };
  const runtime = loadOwnedIntakeHandler({ Date: FixedDate, env: name => environment[name],
    fetch: async (inputUrl, init = {}) => {
      const url = new URL(String(inputUrl)), body = init.body ? JSON.parse(init.body) : null;
      if (url.hostname === 'synthetic.invalid') {
        if (url.pathname === '/auth/v1/user') return json({ id: account });
        if (url.pathname === '/rest/v1/ai_conversations') return json([{ id: conversation,
          account_id: account, status: 'OPEN', fact_schema_version: 'NEED_FACT_V2' }]);
        if (url.pathname === '/rest/v1/rpc/rpc_ai_claim_need_turn_v2_service') return json({
          turn: turn('PROCESSING'), claim: { attemptId,
            leaseExpiresAt: new Date(Date.parse(now) + 90000).toISOString(),
            context: { schemaVersion: 'NEED_FACT_V2', activeFacts, history } },
        });
        if (url.pathname === '/rest/v1/rpc/rpc_ai_test_budget_reserve_service')
          return json({ admitted: true, reservationId: id(8), replay: false, code: 'AI_TEST_RESERVED' });
        if (url.pathname === '/rest/v1/rpc/rpc_ai_dispatch_need_turn_v2_service') return json(true);
        if (url.pathname === '/rest/v1/rpc/rpc_ai_complete_need_turn_v2_service') {
          completion = body; return json(turn('SUCCEEDED', body.p_proposals.length));
        }
        if (url.pathname === '/rest/v1/rpc/rpc_ai_fail_need_turn_v2_service') return json(turn('FAILED'));
      }
      if (url.hostname === 'generativelanguage.googleapis.com') {
        assert.equal(url.pathname, '/v1beta/models/gemini-3.8-flash:generateContent');
        providerCalls++; providerBody = body;
        return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{
          text: JSON.stringify({ safety: 'ALLOW', assistantMessage: answer, facts }),
        }] } }] });
      }
      assert.fail('UNEXPECTED_ROUTE_NO_NETWORK_ALLOWED');
    },
  });
  const response = await runtime.handler(new Request('https://synthetic-edge.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer SYNTHETIC_SESSION', 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: conversation, clientRequestId: request, text: input }),
  }));
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
  assert.ok(completion);
  return { providerBody, completion, sourceHashes: runtime.sourceHashes };
}

const observations = [];
const known = [fact('need.people_needed', 3, 'INTEGER'), fact('need.price_rsd', 5000, 'INTEGER')];
const repeated = await observe({ input: 'Cena je po osobi.', activeFacts: known,
  answer: 'Koliko ljudi ti treba?' });
assert.equal(repeated.completion.p_assistant_message, 'Koliko ljudi ti treba?');
observations.push({ id: 'KNOWN_FIELD_QUESTION', finding: 'A question for an already supplied field reaches the SQL completion boundary.' });

const multi = await observe({ input: 'Treba mi pomoc.',
  answer: 'Koliko ljudi ti treba, kada pocinje posao, gde se radi i koliko placas?' });
assert.equal(multi.completion.p_assistant_message.split('?').length - 1, 1);
observations.push({ id: 'MULTI_TOPIC_QUESTION', finding: 'Four question topics behind one question mark reach completion; punctuation counting cannot enforce one topic.' });

const temporal = await observe({ input: 'Treba mi sutra.', answer: 'Zabelezeno za danas.',
  facts: [proposal('need.schedule_kind', 'TODAY_FLEXIBLE', 'sutra')] });
assert.equal(temporal.completion.p_proposals[0].value, 'TODAY_FLEXIBLE');
assert.match(temporal.providerBody.systemInstruction.parts[0].text, /2026-09-21/);
observations.push({ id: 'RELATIVE_DATE_CONTRADICTION', finding: 'Valid enum plus evidence saying tomorrow is accepted as TODAY_FLEXIBLE despite supplied server date.' });

const mismatch = await observe({ input: 'Tri dana, 5000 dnevno po osobi.',
  answer: 'Cena za sve dane je 15000 RSD po osobi.',
  facts: [proposal('need.price_rsd', 5000), proposal('need.price_basis', 'PER_PERSON')] });
assert.equal(mismatch.completion.p_proposals[0].value, 5000);
observations.push({ id: 'MESSAGE_FACT_MISMATCH', finding: 'Spoken amount and structured amount can disagree without a response consistency rejection.' });

const unchanged = await observe({ input: 'Kada mozes da nastavis?', activeFacts: known,
  answer: 'Zabelezio sam tri osobe.', facts: [proposal('need.people_needed', 3)] });
assert.equal(unchanged.completion.p_proposals[0].value, known[0].fact_value);
observations.push({ id: 'UNCHANGED_PROPOSAL', finding: 'An unchanged fact is forwarded as a new proposal; live SQL separately confirms unconditional supersession.' });

const history = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'ASSISTANT' : 'USER',
  body: i === 0 ? 'SYNTHETIC_PHOTO_OFFER_DECLINED' : `Synthetic history ${i + 1}`, sequence_no: i + 1 }));
const shortened = await observe({ input: 'Nastavi.', history, answer: 'Sta jos treba?' });
assert.equal(shortened.providerBody.contents.length, 31);
assert.ok(!JSON.stringify(shortened.providerBody.contents).includes('SYNTHETIC_PHOTO_OFFER_DECLINED'));
observations.push({ id: 'HISTORY_WINDOW', finding: 'Only 30 previous messages plus latest input reach the model; an older declined suggestion is absent.' });

const rich = await observe({ input: 'Promeni naslov.', answer: 'Naslov je izmenjen.', activeFacts: [
  fact('need.description', 'D'.repeat(4000), 'TEXT', 'd'.repeat(1000)),
  fact('need.access_notes', 'A'.repeat(2000), 'TEXT', 'a'.repeat(1000)),
  fact('need.people_needed', 3, 'INTEGER'),
] });
const instruction = rich.providerBody.systemInstruction.parts[0].text;
const serialized = instruction.split('Aktuelne server-side činjenice: ')[1].split(' Sastavite lep, kratak')[0];
assert.equal(serialized.length, 8000);
assert.throws(() => JSON.parse(serialized));
assert.ok(!serialized.includes('need.people_needed'));
observations.push({ id: 'FACT_TEXT_TRUNCATION', finding: 'Valid rich fact rows produce an 8000-character incomplete JSON string; a later headcount fact disappears. Synthetic, not measured as a DEV incident.' });

const refusal = await observe({ input: 'Nastavi.', answer: 'Izaberi mesto na mapi.' });
assert.deepEqual(Object.keys(refusal.providerBody), ['systemInstruction', 'contents', 'generationConfig']);
assert.ok(!Object.hasOwn(refusal.providerBody, 'uiState'));
observations.push({ id: 'NO_UI_STATE', finding: 'No structured map-confirmed/photo-present/declined-offer state is supplied. Live context definition establishes the corresponding exclusion.' });

const report = { kind: 'CONVERSATION_SEMANTICS_DIAGNOSTIC_NOT_ACCEPTANCE', generatedAt: new Date().toISOString(),
  actualHandler: true, actualDatabase: false, actualProvider: false, actualNetwork: false,
  syntheticCases: observations.length, sourceHashes: repeated.sourceHashes, observations };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
