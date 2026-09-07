import type { AiNeedContext, AiNeedMessage, AiNeedResult, AiNeedSafety, AiNeedV2Conversation, AiNeedV2Fact, AiNeedV2Port, AiNeedV2Review } from '../contracts/aiNeedV2';
import { NEED_FACT_SCHEMA_V2, NEED_FACT_V2_DEFINITIONS, isNeedFactV2Key } from '../contracts/needFactsV2';
import { supabaseKlijent } from './supabaseClient';

const uuid = (value: unknown): value is string => typeof value === 'string' && value.length === 36 &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const safety = (value: unknown): value is AiNeedSafety => ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(value as string);
const fixed = (kod: string, poruka: string, outcome: 'rejected' | 'unknown' = 'rejected'): AiNeedResult<never> => ({ ok: false, kod, poruka, outcome });
const unknown = () => fixed('AI_OUTCOME_UNKNOWN', 'Potvrda nije stigla. Osvežite razgovor pre nastavka.', 'unknown');
// Only these exact Edge status/code pairs exit before the provider/persist stage.
// Never expose provider payloads, exception messages or raw response bodies.
async function edgeFailure(error: any): Promise<AiNeedResult<never>> {
  const known: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, 'Prijavite se da biste nastavili.'],
    MESSAGE_INVALID: [400, 'Unesite poruku do 4.000 znakova.'],
    CONVERSATION_ID_INVALID: [400, 'Nacrt nije ispravan. Vratite se na Zadatke.'],
    CONVERSATION_NOT_FOUND: [404, 'Nacrt nije dostupan ovom nalogu.'],
    SERVER_CONFIG_ERROR: [500, 'Serverska konfiguracija trenutno nije dostupna.'],
    SERVER_IDENTITY_ERROR: [500, 'Nalog nije mogao da se proveri.'],
    AI_PROVIDER_NOT_CONFIGURED: [503, 'AI obrada još nije aktivirana na serveru. Tekst nije poslat na obradu.'],
    CONVERSATION_READ_FAILED: [502, 'Nacrt nije mogao da se proveri. Pokušajte ponovo.'],
    CONVERSATION_CONTEXT_FAILED: [502, 'Razgovor nije mogao da se proveri. Pokušajte ponovo.'],
  };
  try {
    const response = error?.context;
    if (!response || typeof response.clone !== 'function') return unknown();
    const body = await response.clone().json();
    const refusal = typeof body?.code === 'string' && known[body.code];
    return refusal && response.status === refusal[0] ? fixed(body.code, refusal[1]) : unknown();
  } catch { return unknown(); }
}
function assertCurrent(context: AiNeedContext) {
  if (!uuid(context.accountId) || !context.isCurrent()) throw new Error('AI_AUTH_CONTEXT_CHANGED');
}
const copyContext = (context: AiNeedContext): AiNeedContext => Object.freeze({ accountId: context.accountId, isCurrent: context.isCurrent });
function rpcFailure(error: any): AiNeedResult<never> {
  if (!error || !['28000', '42501', '22023', '22001', '40001', 'P0001', 'P0002', '23505'].includes(error.code)) return unknown();
  if (error.message === 'AI_NEED_DRAFT_BLOCKED') return fixed('AI_NEED_DRAFT_BLOCKED', 'Ovaj zahtev ne može da bude sačuvan kao nacrt.');
  if (error.code === '28000' || error.code === '42501') return fixed('AUTH_REQUIRED', 'Nacrt nije dostupan ovom nalogu.');
  return fixed('AI_ACTION_REJECTED', 'Radnja nije prihvaćena. Osvežite nacrt i proverite podatke.');
}

function mapFact(raw: any): AiNeedV2Fact {
  const key = raw?.key ?? raw?.fact_key;
  if (!isNeedFactV2Key(key) || !uuid(raw?.id)) throw new Error('AI_FACT_INVALID');
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  const display = raw.displayValue ?? raw.display_value;
  const status = raw.status, source = raw.source, valueType = raw.valueType ?? raw.value_type;
  if (typeof display !== 'string' || !display.trim() || valueType !== definition.valueType ||
    raw.privacyClass !== definition.privacyClass || typeof raw.requiredForDraft !== 'boolean' ||
    !['NEEDS_CONFIRMATION', 'INFERRED', 'CONFIRMED', 'UNKNOWN'].includes(status) ||
    !['EXPLICIT_USER_ANSWER', 'CONFIRMED_PROFILE', 'AI_INFERENCE', 'SYSTEM_DERIVED'].includes(source)) throw new Error('AI_FACT_INVALID');
  const value = Object.prototype.hasOwnProperty.call(raw, 'value') ? raw.value : raw.fact_value;
  const validValue = valueType === 'INTEGER' ? Number.isSafeInteger(value)
    : valueType === 'BOOLEAN' ? typeof value === 'boolean'
    : valueType === 'TEXT_ARRAY' ? Array.isArray(value) && value.every(item => typeof item === 'string')
    : valueType === 'OBJECT' ? !!value && typeof value === 'object' && !Array.isArray(value)
    : typeof value === 'string';
  if (!validValue) throw new Error('AI_FACT_VALUE_INVALID');
  return { id: raw.id, key, value, displayValue: display.trim(), valueType,
    privacyClass: definition.privacyClass, requiredForDraft: raw.requiredForDraft, status, source,
    evidence: typeof raw.evidence === 'string' ? raw.evidence : null };
}

export function mapAiNeedReview(raw: any, conversationId: string): AiNeedV2Review {
  if (!raw || raw.schemaVersion !== NEED_FACT_SCHEMA_V2 || raw.conversationId !== conversationId ||
    !safety(raw.safety) || typeof raw.canSaveDraft !== 'boolean' || !Array.isArray(raw.facts) ||
    !Array.isArray(raw.missingRequired) || !raw.missingRequired.every(isNeedFactV2Key) ||
    !(raw.boundNeedId === null || uuid(raw.boundNeedId))) throw new Error('AI_REVIEW_INVALID');
  const facts = raw.facts.map(mapFact);
  if (new Set(facts.map((fact: AiNeedV2Fact) => fact.id)).size !== facts.length ||
    new Set(facts.map((fact: AiNeedV2Fact) => fact.key)).size !== facts.length) throw new Error('AI_REVIEW_DUPLICATE_FACT');
  if (raw.safety === 'BLOCK' && raw.canSaveDraft) throw new Error('AI_REVIEW_SAFETY_CONFLICT');
  return { conversationId, schemaVersion: NEED_FACT_SCHEMA_V2, boundNeedId: raw.boundNeedId,
    safety: raw.safety, canSaveDraft: raw.canSaveDraft, missingRequired: raw.missingRequired, facts };
}

export function createAiNeedV2Service(client: () => ReturnType<typeof supabaseKlijent>): AiNeedV2Port {
  async function authenticated(context: AiNeedContext) {
    assertCurrent(context);
    const { data, error } = await client().auth.getUser();
    assertCurrent(context);
    if (error || data.user?.id !== context.accountId) throw new Error('AI_AUTH_CONTEXT_CHANGED');
  }
  async function command<T>(scope: AiNeedContext, work: (context: AiNeedContext) => Promise<AiNeedResult<T>>): Promise<AiNeedResult<T>> {
    const context = copyContext(scope);
    try { await authenticated(context); const result = await work(context); assertCurrent(context); return result; }
    catch (error) { return error instanceof Error && error.message === 'AI_AUTH_CONTEXT_CHANGED'
      ? fixed('AUTH_CONTEXT_CHANGED', 'Nalog je promenjen. Vratite se na Zadatke.') : unknown(); }
  }
  return {
    openConversation: scope => command(scope, async context => {
      assertCurrent(context);
      const { data, error } = await client().rpc('rpc_ai_open_need_conversation_v2');
      return error ? rpcFailure(error) : uuid(data) ? { ok: true, podatak: { conversationId: data } } : unknown();
    }),
    async loadConversation(id, scope): Promise<AiNeedV2Conversation | null> {
      const context = copyContext(scope);
      if (!uuid(id)) throw new Error('AI_CONVERSATION_INVALID');
      await authenticated(context);
      const { data: conversation, error } = await client().from('ai_conversations')
        .select('id,purpose,status,fact_schema_version').eq('id', id).eq('purpose', 'NEED_INTAKE').maybeSingle();
      assertCurrent(context);
      if (error) throw new Error('AI_CONVERSATION_READ_FAILED');
      if (!conversation) return null;
      if (conversation.id !== id || conversation.fact_schema_version !== NEED_FACT_SCHEMA_V2) throw new Error('AI_CONVERSATION_INVALID');
      const [messagesResult, reviewResult] = await Promise.all([
        client().from('ai_messages').select('id,role,body,safety,proposed_fact_ids,sequence_no')
          .eq('conversation_id', id).order('sequence_no', { ascending: true }),
        client().rpc('rpc_ai_need_review_v2', { p_conversation_id: id }),
      ]);
      assertCurrent(context);
      if (messagesResult.error || reviewResult.error || !Array.isArray(messagesResult.data)) throw new Error('AI_REVIEW_READ_FAILED');
      const review = mapAiNeedReview(reviewResult.data, id);
      const messages: AiNeedMessage[] = messagesResult.data.map((row: any) => {
        if (!uuid(row?.id) || !['USER', 'ASSISTANT', 'SYSTEM'].includes(row.role) || typeof row.body !== 'string') throw new Error('AI_MESSAGE_INVALID');
        return { id: row.id, fromAi: row.role !== 'USER', body: row.body,
          safety: safety(row.safety) ? row.safety : null, proposedFactIds: Array.isArray(row.proposed_fact_ids) ? row.proposed_fact_ids : [] };
      });
      await authenticated(context);
      return { conversationId: id, schemaVersion: NEED_FACT_SCHEMA_V2, messages, facts: review.facts, review, safety: review.safety };
    },
    sendMessage(id, body, scope) {
      const text = body.trim();
      if (!uuid(id) || !text || text.length > 4000) return Promise.resolve(fixed('INVALID_MESSAGE', 'Unesite poruku do 4.000 znakova.'));
      return command(scope, async context => {
        assertCurrent(context);
        const { data, error } = await client().functions.invoke('uskoci-ai-interview', { body: { conversationId: id, text } });
        // No durable Edge turn key exists: failed/invalid responses may follow
        // a committed turn and cannot safely trigger an automatic retry.
        if (error) return edgeFailure(error);
        if (!data || data.schemaVersion !== NEED_FACT_SCHEMA_V2 || !Number.isSafeInteger(data.predlozeno) || data.predlozeno < 0) return unknown();
        return { ok: true, podatak: { proposed: data.predlozeno } };
      });
    },
    confirmFact: (id, scope) => command(scope, async context => {
      if (!uuid(id)) return fixed('INVALID_FACT', 'Podatak nije dostupan.');
      assertCurrent(context);
      const { error } = await client().rpc('rpc_ai_confirm_fact', { p_fact_id: id });
      return error ? rpcFailure(error) : { ok: true, podatak: null };
    }),
    correctFact(id, value, display, scope) {
      let captured: unknown;
      try { captured = JSON.parse(JSON.stringify(value)); }
      catch { return Promise.resolve(fixed('INVALID_FACT', 'Proverite ispravku podatka.')); }
      const text = display.trim();
      return command(scope, async context => {
        if (!uuid(id) || !text) return fixed('INVALID_FACT', 'Proverite ispravku podatka.');
        assertCurrent(context);
        const { data, error } = await client().rpc('rpc_ai_correct_fact_v2', { p_fact_id: id, p_value: captured, p_display_value: text });
        return error ? rpcFailure(error) : uuid(data) ? { ok: true, podatak: { newFactId: data } } : unknown();
      });
    },
    saveDraft: (id, key, scope) => command(scope, async context => {
      if (!uuid(id) || typeof key !== 'string' || !key.trim()) return fixed('INVALID_DRAFT', 'Nacrt nije dostupan.');
      const { data: profile, error } = await client().from('app_profiles').select('id')
        .eq('account_id', context.accountId).eq('kind', 'REQUESTER').eq('profile_status', 'ACTIVE').maybeSingle();
      assertCurrent(context);
      if (error || !uuid(profile?.id)) return fixed('REQUESTER_PROFILE_NOT_READY', 'Profil za MENI TREBA nije spreman.');
      const result = await client().rpc('rpc_save_need_draft_from_review', {
        p_conversation_id: id, p_requester_profile_id: profile.id, p_client_request_id: key,
      });
      const needId = result.data?.needId ?? result.data?.need_id;
      return result.error ? rpcFailure(result.error) : uuid(needId) ? { ok: true, podatak: { needId } } : unknown();
    }),
  };
}

export const aiNeedV2Production = createAiNeedV2Service(supabaseKlijent);
