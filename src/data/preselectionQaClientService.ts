import type {
  AnswerQuestionReceipt,
  AskQuestionReceipt,
  DispositionReceipt,
  OwnerPreselectionQuestion,
  PreselectionQuestionStatus,
  PublicPreselectionQa,
  QuestionDisposition,
} from '../contracts/preselectionQa';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

const STATUSES = new Set<PreselectionQuestionStatus>(['PENDING_ANSWER', 'ANSWERED_PUBLIC', 'IGNORED', 'REPORTED']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Server exception names → product language. The user never sees a code.
// Q&A is fail-closed on live until the block/rate authority (P5) and the
// publication policy bundle (D-0140) exist; those names share one honest line.
const NOT_READY_COPY = 'Pitanja o Zadatku još nisu dostupna.';
const PUBLIC_FLOOR_COPY = 'Pitanja i odgovori su javni: bez telefona, e-pošte, linkova i naloga.';
const STALE_COPY = 'Zadatak je u međuvremenu izmenjen. Osvežite prikaz.';
const QA_COPY: Record<string, string> = {
  RU4B_BLOCK_AUTHORITY_NOT_READY: NOT_READY_COPY,
  RU4B_RATE_POLICY_NOT_READY: NOT_READY_COPY,
  PRESELECTION_QA_POLICY_NOT_READY: NOT_READY_COPY,
  RU4B_MATERIALITY_NOT_READY: NOT_READY_COPY,
  EMPTY_CONTENT: 'Unesite tekst.',
  QUESTION_REQUIRED: 'Unesite pitanje.',
  ANSWER_REQUIRED: 'Unesite odgovor.',
  EMAIL_NOT_PUBLIC: PUBLIC_FLOOR_COPY,
  PHONE_NOT_PUBLIC: PUBLIC_FLOOR_COPY,
  OFF_PLATFORM_LINK_NOT_PUBLIC: PUBLIC_FLOOR_COPY,
  SOCIAL_HANDLE_NOT_PUBLIC: PUBLIC_FLOOR_COPY,
  STALE_NEED_REVISION: STALE_COPY,
  QUESTION_STALE_AFTER_NEED_REVISION: STALE_COPY,
  NEED_NOT_FOUND: 'Zadatak nije pronađen.',
  NEED_NOT_PUBLIC: 'Zadatak više nije javan.',
  REQUESTER_CANNOT_ASK_OWN_TASK: 'Ne možete postaviti pitanje na sopstveni Zadatak.',
  ACTIVE_WORKER_REQUIRED: 'Dopunite Radni profil da biste postavili pitanje.',
  RU4B_MATERIAL_REQUIRES_RU4_EDIT: 'Ovaj odgovor menja Zadatak. Izmenite Zadatak umesto odgovora.',
  QUESTION_NOT_FOUND: 'Pitanje nije pronađeno.',
  QUESTION_NOT_ANSWERABLE: 'Na ovo pitanje više ne može da se odgovori.',
  QUESTION_NOT_PENDING: 'Ovo pitanje je već obrađeno.',
  NOT_NEED_OWNER: 'Ovo nije Vaš Zadatak.',
  RU4B_DISPOSITION_INVALID: 'Radnja nije prepoznata.',
  IDEMPOTENCY_KEY_REUSED: 'Radnja nije mogla da se ponovi sa istim zahtevom. Pokušajte ponovo.',
  REQUEST_ID_REQUIRED: 'Radnja trenutno nije mogla da se zabeleži. Pokušajte ponovo.',
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
};

function qaFailure(error: any, fallback: string): Ishod<never> {
  const name = typeof error?.message === 'string' ? error.message : '';
  return fail(name || error?.code || fallback, QA_COPY[name] ?? 'Radnja trenutno nije mogla da se završi. Pokušajte ponovo.');
}

function invalidRequestId(): Ishod<never> {
  return fail('REQUEST_ID_INVALID', QA_COPY.REQUEST_ID_REQUIRED);
}

function mapOwnerQuestion(raw: any): OwnerPreselectionQuestion | null {
  if (typeof raw?.question_id !== 'string' || !STATUSES.has(raw?.status)) return null;
  return {
    questionId: raw.question_id,
    needRevision: Number(raw.need_revision ?? 0),
    questionText: String(raw.question_text ?? ''),
    status: raw.status,
    createdAt: String(raw.created_at ?? ''),
    answerVersion: typeof raw.answer_version === 'number' ? raw.answer_version : null,
    answerText: typeof raw.answer_text === 'string' ? raw.answer_text : null,
    edited: raw.edited === true,
  };
}

function mapPublicQa(raw: any): PublicPreselectionQa | null {
  if (typeof raw?.question_id !== 'string' || typeof raw?.answer_text !== 'string' || typeof raw?.answer_version !== 'number') return null;
  return {
    questionId: raw.question_id,
    needRevision: Number(raw.need_revision ?? 0),
    questionText: String(raw.question_text ?? ''),
    answerVersion: raw.answer_version,
    answerText: raw.answer_text,
    edited: raw.edited === true,
    answeredAt: String(raw.answered_at ?? ''),
  };
}

/**
 * RU-4B — the only client owner of pre-Dogovor clarification Q&A.
 * Every command carries one stable uuid request id per intent, so a retry
 * replays the original receipt; the server's exception names are mapped once
 * to product language and never shown raw. No client-side authority: who may
 * ask, whether an answer is material, and whether the policy bundle admits the
 * text are all server decisions.
 */
export const preselectionQaClientService = {
  async askQuestion(needId: string, expectedRevision: number, questionText: string, requestId: string): Promise<Ishod<AskQuestionReceipt>> {
    if (!UUID.test(requestId)) return invalidRequestId();
    const { data, error } = await supabase.rpc('rpc_ru4b_ask_preselection_question', {
      p_need_id: needId, p_expected_revision: expectedRevision, p_question_text: questionText, p_request_id: requestId,
    });
    if (error) return qaFailure(error, 'QUESTION_ASK_FAILED');
    if (data?.ok !== true || typeof data?.questionId !== 'string') return fail('QUESTION_ASK_INVALID_RESPONSE', 'Server nije potvrdio pitanje.');
    return { ok: true, podatak: { questionId: data.questionId, status: 'PENDING_ANSWER', needRevision: Number(data.needRevision ?? expectedRevision), idempotentReplay: data.idempotentReplay === true } };
  },

  async answerQuestion(questionId: string, answerText: string, requestId: string): Promise<Ishod<AnswerQuestionReceipt>> {
    if (!UUID.test(requestId)) return invalidRequestId();
    const { data, error } = await supabase.rpc('rpc_ru4b_answer_preselection_question', {
      p_question_id: questionId, p_answer_text: answerText, p_request_id: requestId,
    });
    if (error) return qaFailure(error, 'QUESTION_ANSWER_FAILED');
    if (data?.ok !== true || typeof data?.answerVersion !== 'number') return fail('QUESTION_ANSWER_INVALID_RESPONSE', 'Server nije potvrdio odgovor.');
    return { ok: true, podatak: { questionId: String(data.questionId ?? questionId), status: 'ANSWERED_PUBLIC', answerVersion: data.answerVersion, edited: data.edited === true, idempotentReplay: data.idempotentReplay === true } };
  },

  async dispositionQuestion(questionId: string, action: QuestionDisposition, requestId: string): Promise<Ishod<DispositionReceipt>> {
    if (!UUID.test(requestId)) return invalidRequestId();
    const { data, error } = await supabase.rpc('rpc_ru4b_disposition_preselection_question', {
      p_question_id: questionId, p_action: action, p_request_id: requestId,
    });
    if (error) return qaFailure(error, 'QUESTION_DISPOSITION_FAILED');
    if (data?.ok !== true || (data?.status !== 'IGNORED' && data?.status !== 'REPORTED')) return fail('QUESTION_DISPOSITION_INVALID_RESPONSE', 'Server nije potvrdio radnju.');
    return { ok: true, podatak: { questionId: String(data.questionId ?? questionId), status: data.status, idempotentReplay: data.idempotentReplay === true } };
  },

  async ownerQuestions(needId: string): Promise<Ishod<OwnerPreselectionQuestion[]>> {
    const { data, error } = await supabase.rpc('rpc_ru4b_owner_preselection_questions', { p_need_id: needId });
    if (error) return qaFailure(error, 'OWNER_QUESTIONS_READ_FAILED');
    const rows = (Array.isArray(data) ? data : []).map(mapOwnerQuestion);
    if (rows.some((r) => r === null)) return fail('OWNER_QUESTIONS_INVALID_RESPONSE', 'Server je vratio nečitljivo pitanje.');
    return { ok: true, podatak: rows as OwnerPreselectionQuestion[] };
  },

  async publicQa(needId: string): Promise<Ishod<PublicPreselectionQa[]>> {
    const { data, error } = await supabase.rpc('rpc_ru4b_public_preselection_qa', { p_need_id: needId });
    if (error) return qaFailure(error, 'PUBLIC_QA_READ_FAILED');
    const rows = (Array.isArray(data) ? data : []).map(mapPublicQa);
    if (rows.some((r) => r === null)) return fail('PUBLIC_QA_INVALID_RESPONSE', 'Server je vratio nečitljiv odgovor.');
    return { ok: true, podatak: rows as PublicPreselectionQa[] };
  },
};
