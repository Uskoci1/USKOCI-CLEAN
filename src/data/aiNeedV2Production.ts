import type {
  AiNeedEditConfirmed,
  AiNeedEditOpened,
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

// RU-4 edit authority speaks in server exception names; the user reads product language.
const NEED_EDIT_COPY: Record<string, string> = {
  NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR:
    'Zadatak više ne može da se menja jer je već sklopljen Dogovor. Promene idu kroz izmenu Dogovora.',
  NEED_NOT_EDITABLE_PUBLIC_STATE: 'Ovaj Zadatak trenutno nije u stanju u kom može da se menja.',
  NEED_EDIT_GEOGRAPHY_NOT_READY: 'Lokacija Zadatka još nije spremna za izmenu.',
  NEED_NOT_OWNED: 'Samo vlasnik Zadatka može da ga menja.',
  NOT_OWNER: 'Samo vlasnik Zadatka može da ga menja.',
  NEED_NOT_FOUND: 'Zadatak nije pronađen.',
  STALE_REVIEW_REQUIRED: 'Zadatak je u međuvremenu promenjen. Otvorite ga ponovo i proverite podatke.',
  NEED_EDIT_CONFLICT: 'Zadatak je u međuvremenu promenjen. Otvorite ga ponovo i proverite podatke.',
  EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION: 'Potvrdite sve podatke pre čuvanja izmena.',
  REQUIRED_CONFIRMED_FACTS_MISSING: 'Nedostaju obavezni podaci. Dopunite ih pre čuvanja.',
  NO_MATERIAL_CHANGE: 'Niste promenili nijedan podatak.',
  EDIT_CONVERSATION_NOT_CONFIRMABLE: 'Ova izmena više nije otvorena. Pokrenite izmenu ponovo iz Zadatka.',
  EDIT_CONVERSATION_NEED_MISMATCH: 'Ova izmena ne pripada ovom Zadatku.',
  MY_PRICE_AMOUNT_REQUIRED: 'Unesite cenu ili izaberite prikupljanje ponuda.',
  FIXED_WINDOW_BOUNDS_REQUIRED: 'Termin mora imati početak i kraj.',
};

function editFailure(error: any, fallback: string): Ishod<never> {
  const name = typeof error?.message === 'string' ? error.message : '';
  return fail(
    name || error?.code || fallback,
    NEED_EDIT_COPY[name] ?? 'Izmena trenutno nije mogla da se sačuva. Pokušajte ponovo.',
  );
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
    boundNeedId: typeof raw.boundNeedId === 'string' && raw.boundNeedId ? raw.boundNeedId : null,
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

  /**
   * RU-4 owner edit. The server seeds a NEED_INTAKE conversation bound to the
   * Zadatak with its current confirmed facts and returns the exact revision.
   * Refused after the first Dogovor; that is the server's rule, not the client's.
   */
  async openEditConversation(needId: string): Promise<Ishod<AiNeedEditOpened>> {
    const { data, error } = await supabase.rpc('rpc_ai_open_need_edit_conversation_v2', { p_need_id: needId });
    if (error) return editFailure(error, 'NEED_EDIT_OPEN_FAILED');
    const conversationId = typeof data?.conversationId === 'string' ? data.conversationId : '';
    const revision = Number(data?.revision);
    if (!conversationId || !Number.isInteger(revision) || revision < 1) {
      return fail('NEED_EDIT_INVALID_RESPONSE', 'Server nije otvorio izmenu Zadatka.');
    }
    return {
      ok: true,
      podatak: { conversationId, needId: typeof data?.needId === 'string' ? data.needId : needId, revision },
    };
  },

  /**
   * RU-4 material edit confirmation from R07. Carries the revision the owner
   * reviewed; a moved revision is STALE_REVIEW_REQUIRED, never a silent overwrite.
   * The same clientRequestId across retries of the same intent replays the receipt.
   */
  async confirmEdit(
    needId: string,
    expectedRevision: number,
    conversationId: string,
    clientRequestId: string,
  ): Promise<Ishod<AiNeedEditConfirmed>> {
    const { data, error } = await supabase.rpc('rpc_confirm_need_edit_from_review_v2', {
      p_need_id: needId,
      p_expected_revision: expectedRevision,
      p_conversation_id: conversationId,
      p_client_request_id: clientRequestId,
    });
    if (error) return editFailure(error, 'NEED_EDIT_CONFIRM_FAILED');
    const resultNeedId = typeof data?.needId === 'string' ? data.needId : '';
    const revision = Number(data?.revision);
    if (!resultNeedId || !Number.isInteger(revision) || revision < 1) {
      return fail('NEED_EDIT_INVALID_RESPONSE', 'Server nije potvrdio izmenu Zadatka.');
    }
    return {
      ok: true,
      podatak: {
        needId: resultNeedId,
        fromRevision: Number.isInteger(Number(data?.fromRevision)) ? Number(data.fromRevision) : expectedRevision,
        revision,
        requiresReadmission: data?.requiresReadmission !== false,
        idempotentReplay: data?.idempotentReplay === true,
      },
    };
  },
};
