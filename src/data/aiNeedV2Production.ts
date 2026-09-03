import type {
  AiNeedMessage,
  AiNeedSafety,
  AiNeedV2Conversation,
  AiNeedV2Fact,
  AiNeedV2Review,
} from '../contracts/aiNeedV2';
import {
  NEED_FACT_SCHEMA_V2,
  NEED_FACT_V2_DEFINITIONS,
  isNeedFactV2Key,
} from '../contracts/needFactsV2';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

function mapRpcError(error: any, fallback: string) {
  return fail(error?.code || error?.message || fallback, error?.message || 'Radnja trenutno nije mogla da se završi.');
}

async function edgeFailure(error: any) {
  let payload: any = null;
  try {
    const context = error?.context;
    if (context && typeof context.clone === 'function') payload = await context.clone().json();
    else if (context && typeof context.json === 'function') payload = await context.json();
  } catch {}
  return fail(
    typeof payload?.code === 'string' ? payload.code : error?.name || error?.message || 'AI_EDGE_FAILED',
    typeof payload?.message === 'string' ? payload.message : 'AI obrada trenutno nije uspela.',
  );
}

function mapFact(raw: any): AiNeedV2Fact | null {
  if (!isNeedFactV2Key(String(raw?.key ?? raw?.fact_key ?? ''))) return null;
  const key = String(raw?.key ?? raw?.fact_key) as keyof typeof NEED_FACT_V2_DEFINITIONS;
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  const display = String(raw?.displayValue ?? raw?.display_value ?? '').trim();
  if (!display) return null;
  return {
    id: String(raw.id),
    key,
    value: raw?.value ?? raw?.fact_value,
    displayValue: display,
    valueType: (raw?.valueType ?? raw?.value_type ?? definition.valueType) as AiNeedV2Fact['valueType'],
    privacyClass: (raw?.privacyClass ?? definition.privacyClass) as AiNeedV2Fact['privacyClass'],
    requiredForDraft: Boolean(raw?.requiredForDraft ?? definition.requiredForDraft),
    status: String(raw?.status ?? 'UNKNOWN') as AiNeedV2Fact['status'],
    source: String(raw?.source ?? 'SYSTEM') as AiNeedV2Fact['source'],
    evidence: typeof (raw?.evidence ?? raw?.evidence_excerpt) === 'string'
      ? String(raw?.evidence ?? raw?.evidence_excerpt).trim() || null
      : null,
  };
}

function mapReview(raw: any): AiNeedV2Review | null {
  if (!raw || raw.schemaVersion !== NEED_FACT_SCHEMA_V2) return null;
  const facts = (Array.isArray(raw.facts) ? raw.facts : []).map(mapFact).filter(Boolean) as AiNeedV2Fact[];
  const missingRequired = (Array.isArray(raw.missingRequired) ? raw.missingRequired : [])
    .map(String)
    .filter(isNeedFactV2Key);
  return {
    conversationId: String(raw.conversationId),
    schemaVersion: NEED_FACT_SCHEMA_V2,
    canSaveDraft: Boolean(raw.canSaveDraft),
    missingRequired,
    facts,
  };
}

function latestSafety(messages: any[]): AiNeedSafety {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const value = messages[i]?.safety;
    if (['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(value)) return value;
  }
  return 'REVIEW';
}

export const aiNeedV2Production = {
  async openConversation(): Promise<Ishod<{ conversationId: string }>> {
    const { data, error } = await supabase.rpc('rpc_ai_open_need_conversation_v2');
    if (error || typeof data !== 'string' || !data) return mapRpcError(error, 'AI_V2_OPEN_FAILED');
    return { ok: true, podatak: { conversationId: data } };
  },

  async loadConversation(conversationId: string): Promise<AiNeedV2Conversation | null> {
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .select('id,purpose,status,fact_schema_version')
      .eq('id', conversationId)
      .eq('purpose', 'NEED_INTAKE')
      .maybeSingle();
    if (conversationError) throw new Error(conversationError.message || 'AI_V2_CONVERSATION_READ_FAILED');
    if (!conversation || conversation.fact_schema_version !== NEED_FACT_SCHEMA_V2) return null;

    const [messagesResult, reviewResult] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('id,role,body,safety,proposed_fact_ids,sequence_no')
        .eq('conversation_id', conversationId)
        .order('sequence_no', { ascending: true }),
      supabase.rpc('rpc_ai_need_review_v2', { p_conversation_id: conversationId }),
    ]);
    if (messagesResult.error) throw new Error(messagesResult.error.message || 'AI_V2_MESSAGES_READ_FAILED');
    if (reviewResult.error) throw new Error(reviewResult.error.message || 'AI_V2_REVIEW_READ_FAILED');
    const review = mapReview(reviewResult.data);
    if (!review) throw new Error('AI_V2_REVIEW_SCHEMA_MISMATCH');

    const messages: AiNeedMessage[] = (messagesResult.data ?? []).map((row: any) => ({
      id: String(row.id),
      fromAi: row.role === 'ASSISTANT',
      body: String(row.body ?? ''),
      safety: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(row.safety) ? row.safety : null,
      proposedFactIds: Array.isArray(row.proposed_fact_ids) ? row.proposed_fact_ids.map(String) : [],
    }));

    return {
      conversationId,
      schemaVersion: NEED_FACT_SCHEMA_V2,
      messages,
      facts: review.facts,
      review,
      safety: latestSafety(messagesResult.data ?? []),
    };
  },

  async sendMessage(conversationId: string, body: string): Promise<Ishod<{ proposed: number }>> {
    const text = body.trim();
    if (!text) return fail('MESSAGE_REQUIRED', 'Unesite poruku.');
    if (text.length > 4000) return fail('MESSAGE_TOO_LONG', 'Poruka može imati najviše 4000 znakova.');
    const { data, error } = await supabase.functions.invoke('uskoci-ai-interview', {
      body: { conversationId, text },
    });
    if (error) return edgeFailure(error);
    if (!data || data.schemaVersion !== NEED_FACT_SCHEMA_V2 || !Number.isFinite(Number(data.predlozeno))) {
      return fail('AI_V2_EDGE_INVALID_RESPONSE', 'AI server nije vratio ispravan V2 rezultat.');
    }
    return { ok: true, podatak: { proposed: Math.max(0, Math.trunc(Number(data.predlozeno))) } };
  },

  async confirmFact(factId: string): Promise<Ishod<null>> {
    const { error } = await supabase.rpc('rpc_ai_confirm_fact', { p_fact_id: factId });
    if (error) return mapRpcError(error, 'AI_FACT_CONFIRM_FAILED');
    return { ok: true, podatak: null };
  },

  async correctFact(
    factId: string,
    value: unknown,
    displayValue: string,
  ): Promise<Ishod<{ newFactId: string }>> {
    const display = displayValue.trim();
    if (!display) return fail('FACT_DISPLAY_REQUIRED', 'Unesite vrednost.');
    const { data, error } = await supabase.rpc('rpc_ai_correct_fact_v2', {
      p_fact_id: factId,
      p_value: value,
      p_display_value: display,
    });
    if (error || typeof data !== 'string' || !data) return mapRpcError(error, 'AI_V2_FACT_CORRECTION_FAILED');
    return { ok: true, podatak: { newFactId: data } };
  },

  async saveDraft(conversationId: string, clientRequestId: string): Promise<Ishod<{ needId: string }>> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return fail('AUTH_REQUIRED', 'Prijavite se da biste sačuvali nacrt.');

    const { data: profile, error: profileError } = await supabase
      .from('app_profiles')
      .select('id')
      .eq('account_id', userData.user.id)
      .eq('kind', 'REQUESTER')
      .eq('profile_status', 'ACTIVE')
      .maybeSingle();
    if (profileError || !profile?.id) return fail('REQUESTER_PROFILE_NOT_READY', 'Profil za MENI TREBA nije spreman.');

    const { data, error } = await supabase.rpc('rpc_save_need_draft_from_review', {
      p_conversation_id: conversationId,
      p_requester_profile_id: profile.id,
      p_client_request_id: clientRequestId,
    });
    if (error) return mapRpcError(error, 'NEED_V2_DRAFT_SAVE_FAILED');
    const needId = typeof data?.needId === 'string' ? data.needId : typeof data?.need_id === 'string' ? data.need_id : '';
    if (!needId) return fail('NEED_V2_DRAFT_INVALID_RESPONSE', 'Server nije vratio sačuvan Zadatak.');
    return { ok: true, podatak: { needId } };
  },
};
