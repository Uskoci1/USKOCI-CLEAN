import type { AiNeedSafety, AiNeedV2FactSource, AiNeedV2FactStatus } from '../contracts/aiNeedV2';
import type { NeedLocationInput } from '../contracts/location';
import { isNeedFactV2Key, NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../contracts/needFactsV2';
import type { PublicationEvaluation, PublishNeedReceipt } from '../contracts/publication';
import { normalizeNeedLocation, normalizeTaskGeography, locationRevision } from '../lib/location';
import { calendarInstant } from '../lib/calendarTime';
import { countryCode } from '../lib/market';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { decodePublicationEvaluation } from './publicationClientService';
import { failure, positiveInteger, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type AiTaskReviewFact = Readonly<{
  id: string | null; key: NeedFactV2Key; value: unknown; displayValue: string;
  privacyClass: 'PUBLIC' | 'PRIVATE'; source: AiNeedV2FactSource; status: AiNeedV2FactStatus;
}>;
/** Owner-only server snapshot. Never persist or send these projections to public analytics. */
export type AiTaskReviewEnvelope = Readonly<{
  reviewId: string; accountId: string; conversationId: string; schemaVersion: 'NEED_FACT_V2'; draftId: string | null; draftRevision: number;
  displayedContentDigest: string; factsRevision: string; sourceTurnRevision: number; geographyRevision: string;
  expiresAt: string; responseDeadline: string | null;
  publicProjection: readonly AiTaskReviewFact[]; ownerPrivateProjection: readonly AiTaskReviewFact[];
  location: NeedLocationInput | null; missingRequired: readonly NeedFactV2Key[]; canAccept: boolean; safety: AiNeedSafety;
}>;
export type AiTaskPublicationCommand = Readonly<{
  reviewId: string; clientRequestId: string; needId: string; needRevision: number;
  state: 'ACCEPTED' | 'EVALUATING' | 'UNKNOWN_OUTCOME' | 'EVALUATED' | 'PUBLISHED';
  evaluation: PublicationEvaluation | null; published: PublishNeedReceipt | null; authoritative: true;
}>;
export type AiTaskReviewRead = Readonly<{ review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand | null }>;
export type AiTaskReviewPrepare = Readonly<{
  conversationId: string; responseDeadline: string | null;
  location?: Readonly<{ expectedRevision: string; value: NeedLocationInput }>;
}>;

const COPY: Readonly<Record<string, string>> = {
  IDENTITY_VERIFICATION_UNAVAILABLE: 'Provera identiteta nije dostupna. U pregledu uklonite taj uslov da biste nastavili običnim zadatkom.',
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.', AUTH_ACCOUNT_CHANGED: 'Nalog je promenjen. Ponovo otvorite zadatak.',
  TASK_REVIEW_NOT_FOUND: 'Pregled nije pronađen. Ponovo otvorite zadatak.',
  TASK_REVIEW_NOT_EDITABLE: 'Ovaj razgovor je već sačuvan. Učitajte njegov zadatak.',
  TASK_REVIEW_DIGEST_MISMATCH: 'Pregled je promenjen. Učitajte tačnu verziju pre objave.',
  TASK_REVIEW_STALE: 'Podaci su promenjeni posle pregleda. Pregledajte novu verziju.',
  TASK_REVIEW_EXPIRED: 'Pregled je istekao. Osvežite ga pre objave.',
  TASK_REVIEW_POLICY_STALE: 'Uslovi za objavu su promenjeni. Osvežite pregled.',
  TASK_REVIEW_INCOMPLETE: 'Dopunite podatke koji nedostaju pre objave.',
  TASK_REVIEW_COMMAND_MISMATCH: 'Zahtev za objavu više ne odgovara ovom pregledu.',
  TASK_REVIEW_ATTEMPT_STALE: 'Ishod provere još nije potvrđen. Učitajte stanje zahteva.',
  TASK_REVIEW_INPUT_INVALID: 'Proverite podatke i ponovo otvorite pregled.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev već pripada drugom pregledu. Učitajte sačuvano stanje.',
  LOCATION_VERSION_CONFLICT: 'Mesto je promenjeno. Pregledajte novu lokaciju.',
  LOCATION_INPUT_INVALID: 'Proverite mesto i privatne tačke lokacije.',
  LOCATION_BINDING_CHANGED: 'Mesto je promenjeno. Ponovo označite potrebne tačke.',
  ACCOUNT_CLOSING: 'Nalog se zatvara i ne može da objavi novi zadatak.',
  REQUESTER_PROFILE_NOT_READY: 'Dopunite svoj profil pre objave.',
  RESPONSE_DEADLINE_INVALID: 'Rok za prijave mora biti u budućnosti.',
  PUBLICATION_DECISION_NOT_ALLOW: 'Zadatak još nije odobren za objavu.',
  NEED_REVISION_STALE: 'Zadatak je promenjen. Pregledajte novu verziju.',
  STALE_REVIEW_REQUIRED: 'Zadatak je promenjen. Ponovo otvorite uređivanje.',
  NEED_NOT_EDITABLE_PUBLIC_STATE: 'Ovaj zadatak trenutno ne može da se menja.',
  NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR: 'Uslovi zadatka su već deo dogovora i ne mogu ovde da se menjaju.',
  EVALUATOR_UNAVAILABLE: 'Provera objave trenutno nije dostupna. Nacrt je sačuvan.',
  RATE_LIMITED: 'Sačekajte pre sledeće provere. Nacrt je sačuvan.',
};
const hash = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const only = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const text = (x: unknown, max: number): x is string => typeof x === 'string' && x.trim().length > 0 && Array.from(x).length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
const scope = (): ReceiptAccount | null => { const s = sesijaSada(); return s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null; };
const current = (s: ReceiptAccount) => { const now = sesijaSada(); return now.user?.id === s.accountId && now.accountRevision === s.accountRevision; };
const invalid = <T>(): Promise<Ishod<T>> => Promise.resolve(failure('TASK_REVIEW_INPUT_INVALID', COPY.TASK_REVIEW_INPUT_INVALID));
function validValue(key: NeedFactV2Key, value: unknown): boolean {
  const type = NEED_FACT_V2_DEFINITIONS[key].valueType;
  if (type === 'TEXT_ARRAY') return Array.isArray(value) && value.length <= 100 && value.every(x => text(x, 1000));
  if (type === 'BOOLEAN') return typeof value === 'boolean';
  if (type === 'INTEGER') return typeof value === 'number' && Number.isSafeInteger(value) && value >= (key === 'need.minimum_experience_years' ? 0 : 1) && value <= (key === 'need.price_rsd' ? 100_000_000 : key === 'need.people_needed' ? 50 : 60);
  if (type === 'TIMESTAMPTZ') return timestamp(value);
  if (key === 'need.task_country_code') return typeof value === 'string' && countryCode(value) === value;
  if (key === 'need.task_geography') return normalizeTaskGeography(value) !== null;
  if (key === 'need.resolved_location') { const v = record(value); return !!v && !!normalizeNeedLocation({ ...record(v.binding), accessNotes: null, resolvedLocation: value })?.resolvedLocation; }
  if (key === 'need.price_mode') return ['FASTEST', 'MY_PRICE', 'OFFERS'].includes(String(value));
  if (key === 'need.schedule_kind') return ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(String(value));
  return text(value, key === 'need.title' ? 140 : key === 'need.category' ? 120 : key === 'need.exact_address' ? 1000 : key === 'need.access_notes' ? 2000 : 6000);
}
function fact(raw: unknown, privacy: 'PUBLIC' | 'PRIVATE'): AiTaskReviewFact | null {
  const f = record(raw);
  if (!f || !only(f, ['id', 'key', 'value', 'displayValue', 'privacyClass', 'source', 'status']) || (f.id !== null && !uuid(f.id))
    || typeof f.key !== 'string' || !isNeedFactV2Key(f.key) || f.privacyClass !== privacy || NEED_FACT_V2_DEFINITIONS[f.key].privacyClass !== privacy
    || !text(f.displayValue, 2000) || !validValue(f.key, f.value)
    || !['EXPLICIT_USER_ANSWER', 'CONFIRMED_PROFILE', 'AI_INFERENCE', 'SYSTEM', 'SYSTEM_DERIVED'].includes(String(f.source))
    || !['NEEDS_CONFIRMATION', 'INFERRED', 'CONFIRMED', 'UNKNOWN'].includes(String(f.status))) return null;
  return f as unknown as AiTaskReviewFact;
}
export function decodeAiTaskReview(raw: unknown, accountId: string): AiTaskReviewEnvelope | null {
  const r = record(raw);
  if (!r || !only(r, ['reviewId', 'accountId', 'conversationId', 'schemaVersion', 'draftId', 'draftRevision', 'displayedContentDigest', 'factsRevision', 'sourceTurnRevision', 'geographyRevision', 'expiresAt', 'responseDeadline', 'publicProjection', 'ownerPrivateProjection', 'location', 'missingRequired', 'canAccept', 'safety'])
    || !uuid(r.reviewId) || !sameId(r.accountId, accountId) || !uuid(r.conversationId) || r.schemaVersion !== 'NEED_FACT_V2'
    || (r.draftId === null ? r.draftRevision !== 0 : !uuid(r.draftId) || !positiveInteger(r.draftRevision))
    || !hash(r.displayedContentDigest) || !hash(r.factsRevision) || !locationRevision(r.geographyRevision)
    || typeof r.sourceTurnRevision !== 'number' || !Number.isSafeInteger(r.sourceTurnRevision) || r.sourceTurnRevision < 0
    || !timestamp(r.expiresAt) || (r.responseDeadline !== null && !timestamp(r.responseDeadline))
    || typeof r.canAccept !== 'boolean' || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(String(r.safety))
    || !Array.isArray(r.publicProjection) || !Array.isArray(r.ownerPrivateProjection) || r.publicProjection.length + r.ownerPrivateProjection.length > 22
    || !Array.isArray(r.missingRequired) || r.missingRequired.length > 22 || !r.missingRequired.every(k => typeof k === 'string' && isNeedFactV2Key(k) && NEED_FACT_V2_DEFINITIONS[k].requiredForDraft)) return null;
  const publicProjection = r.publicProjection.map(x => fact(x, 'PUBLIC')), ownerPrivateProjection = r.ownerPrivateProjection.map(x => fact(x, 'PRIVATE'));
  const all = [...publicProjection, ...ownerPrivateProjection];
  if (all.some(x => !x) || new Set(all.map(x => x?.key)).size !== all.length || new Set(r.missingRequired).size !== r.missingRequired.length) return null;
  const location = r.location === null ? null : normalizeNeedLocation(r.location);
  if ((r.location !== null && !location) || (r.canAccept && (r.safety === 'BLOCK' || !location || r.missingRequired.length > 0))) return null;
  return { reviewId: r.reviewId, accountId: r.accountId, conversationId: r.conversationId, schemaVersion: 'NEED_FACT_V2',
    draftId: r.draftId as string | null, draftRevision: r.draftRevision as number,
    displayedContentDigest: r.displayedContentDigest, factsRevision: r.factsRevision, sourceTurnRevision: r.sourceTurnRevision,
    geographyRevision: r.geographyRevision, expiresAt: r.expiresAt, responseDeadline: r.responseDeadline as string | null,
    publicProjection: publicProjection as AiTaskReviewFact[], ownerPrivateProjection: ownerPrivateProjection as AiTaskReviewFact[],
    location, missingRequired: r.missingRequired as NeedFactV2Key[], canAccept: r.canAccept, safety: r.safety as AiNeedSafety };
}
export function decodeAiTaskPublicationCommand(raw: unknown, reviewId?: string): AiTaskPublicationCommand | null {
  const c = record(raw);
  if (!c || !only(c, ['reviewId', 'clientRequestId', 'needId', 'needRevision', 'state', 'evaluation', 'published', 'authoritative'])
    || !uuid(c.reviewId) || (reviewId && !sameId(c.reviewId, reviewId)) || !uuid(c.clientRequestId) || !uuid(c.needId) || !positiveInteger(c.needRevision)
    || !['ACCEPTED', 'EVALUATING', 'UNKNOWN_OUTCOME', 'EVALUATED', 'PUBLISHED'].includes(String(c.state)) || c.authoritative !== true) return null;
  const evaluation = c.evaluation === null ? null : decodePublicationEvaluation(c.evaluation, { needId: c.needId, expectedRevision: c.needRevision });
  if ((c.evaluation !== null && !evaluation) || (['EVALUATED', 'PUBLISHED'].includes(String(c.state)) !== (evaluation !== null))) return null;
  const p = record(c.published);
  if (c.state === 'PUBLISHED') {
    if (!p || !only(p, ['needId', 'status', 'publishedAt', 'responseDeadline', 'idempotentReplay']) || !sameId(p.needId, c.needId)
      || p.status !== 'PUBLISHED' || !timestamp(p.publishedAt) || (p.responseDeadline !== null && !timestamp(p.responseDeadline))
      || typeof p.idempotentReplay !== 'boolean' || evaluation?.kind !== 'DECISION' || evaluation.decision.outcome !== 'ALLOW') return null;
  } else if (c.published !== null) return null;
  return { ...c, evaluation, published: p } as AiTaskPublicationCommand;
}
function decodeRead(raw: unknown, accountId: string, reviewId?: string): AiTaskReviewRead | null {
  const v = record(raw); if (!v || !only(v, ['review', 'command'])) return null;
  const review = decodeAiTaskReview(v.review, accountId); if (!review || (reviewId && !sameId(review.reviewId, reviewId))) return null;
  const command = v.command === null ? null : decodeCommandForReview(v.command, review);
  return v.command !== null && !command ? null : { review, command };
}
function decodeCommandForReview(raw: unknown, review: AiTaskReviewEnvelope): AiTaskPublicationCommand | null {
  const command = decodeAiTaskPublicationCommand(raw, review.reviewId);
  if (!command || command.needRevision !== review.draftRevision + 1 || (review.draftId && !sameId(command.needId, review.draftId))) return null;
  if (command.published && (review.responseDeadline === null ? command.published.responseDeadline !== null
    : calendarInstant(command.published.responseDeadline) !== calendarInstant(review.responseDeadline))) return null;
  return command;
}
function rpc<T>(s: ReceiptAccount, name: string, args: Record<string, unknown>, decode: (raw: unknown) => T | null, write = false): Promise<Ishod<T>> {
  return readOwnedResult({ account: s, request: () => supabaseKlijent().rpc(name, args), decode, errors: COPY, write,
    fallback: write ? 'TASK_REVIEW_OUTCOME_UNCONFIRMED' : 'TASK_REVIEW_READ_FAILED', invalid: 'TASK_REVIEW_INVALID_RESPONSE' });
}
async function readFor(s: ReceiptAccount, reviewId: string): Promise<Ishod<AiTaskReviewRead>> {
  return rpc(s, 'rpc_read_ai_task_review', { p_review_id: reviewId }, raw => decodeRead(raw, s.accountId, reviewId));
}
/** A refusal is only useful if it says what to do next. Codes come from
 *  rpc_get_need_publication_context and from the evaluator's own readiness gates. */
function notReadyCopy(code: string, missing?: readonly string[]): string {
  const slots = (missing ?? []).length ? ' (' + (missing ?? []).join(', ') + ')' : '';
  switch (code) {
    case 'LOCATION_INCOMPLETE':
      return 'Lokacija nije potvrđena na mapi' + slots + '. Dodirni lokaciju u pregledu i postavi je, pa objavi.';
    case 'COUNTRY_NOT_READY':
      return 'Država zadatka nije potvrđena. Dodirni državu u pregledu i potvrdi je.';
    case 'PUBLIC_MEDIA_NOT_READY':
      return 'Fotografije još nisu proverene. Sačekaj proveru ili ih ukloni, pa objavi.';
    case 'POLICY_NOT_READY':
    case 'POLICY_CONTENT_NOT_READY':
      return 'Pravila objave nisu spremna na serveru. Nije na tebi — nacrt je sačuvan, probaj kasnije.';
    case 'EVALUATOR_UNAVAILABLE':
      return 'Provera objave trenutno nije dostupna. Nacrt je sačuvan, probaj ponovo za koji minut.';
    default:
      return 'Objava još nije moguća' + slots + '. Nacrt je sačuvan; učitaj pregled ponovo.';
  }
}

async function resumeFor(s: ReceiptAccount, command: AiTaskPublicationCommand): Promise<Ishod<AiTaskPublicationCommand>> {
  const read = await readFor(s, command.reviewId);
  if (!read.ok) return read;
  let stored = read.podatak.command;
  if (!stored || stored.clientRequestId !== command.clientRequestId) return failure('TASK_REVIEW_COMMAND_MISMATCH', COPY.TASK_REVIEW_COMMAND_MISMATCH);
  if ((stored.state === 'ACCEPTED' || stored.state === 'EVALUATED')
    && read.podatak.review.publicProjection.some(f => f.key === 'need.verified_identity_required' && f.value === true)) {
    return failure('IDENTITY_VERIFICATION_UNAVAILABLE', COPY.IDENTITY_VERIFICATION_UNAVAILABLE);
  }
  if (stored.state === 'ACCEPTED') {
    const request = { needId: stored.needId, expectedRevision: stored.needRevision, acceptedReviewId: stored.reviewId };
    const evaluated = await readOwnedResult({ account: s, errors: COPY, write: true, fallback: 'TASK_REVIEW_OUTCOME_UNCONFIRMED', invalid: 'TASK_REVIEW_INVALID_RESPONSE',
      decode: raw => decodePublicationEvaluation(raw, request), request: async () => {
        const client = supabaseKlijent(), session = await client.auth.getSession();
        if (!current(s) || session.error || session.data.session?.user.id !== s.accountId) return { data: null, error: { message: 'AUTH_ACCOUNT_CHANGED' } };
        return client.functions.invoke('uskoci-publication-evaluate', { body: request, headers: { Authorization: `Bearer ${session.data.session.access_token}` } });
      } });
    // Resolve the durable claim even when the Edge response was lost. Never
    // launch another evaluator attempt from a response/error/timeout callback.
    const refreshed = await readFor(s, stored.reviewId);
    if (!refreshed.ok) return refreshed;
    stored = refreshed.podatak.command;
    if (!stored) return failure('TASK_REVIEW_COMMAND_MISMATCH', COPY.TASK_REVIEW_COMMAND_MISMATCH);
    if (stored.state === 'ACCEPTED') {
      if (!evaluated.ok) return evaluated;
      // The server says exactly what is missing. Repeating a generic "reload" left the
      // owner stuck on a real device: reloading can never satisfy a missing location.
      return failure(evaluated.podatak.kind === 'NOT_READY' ? evaluated.podatak.code : 'TASK_REVIEW_OUTCOME_UNCONFIRMED',
        evaluated.podatak.kind === 'NOT_READY' ? notReadyCopy(evaluated.podatak.code, evaluated.podatak.missingSlots)
          : 'Ishod objave nije potvrđen. Nacrt je sačuvan; učitaj pregled ponovo.');
    }
  }
  if (stored.state !== 'EVALUATED' || stored.evaluation?.kind !== 'DECISION' || stored.evaluation.decision.outcome !== 'ALLOW') return { ok: true, podatak: stored };
  return rpc(s, 'rpc_publish_accepted_ai_task_review', { p_review_id: stored.reviewId, p_client_request_id: stored.clientRequestId }, raw => decodeCommandForReview(raw, read.podatak.review), true);
}
export const aiTaskReviewClientService = {
  prepare(request: AiTaskReviewPrepare): Promise<Ishod<AiTaskReviewEnvelope>> {
    const s = scope(); if (!s) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED));
    if (!uuid(request?.conversationId) || (request.responseDeadline !== null && !timestamp(request.responseDeadline))) return invalid();
    const location = request.location ? normalizeNeedLocation(request.location.value) : null;
    if (request.location && (!location || !locationRevision(request.location.expectedRevision))) return invalid();
    return rpc(s, 'rpc_prepare_ai_task_review', { p_conversation_id: request.conversationId, p_response_deadline: request.responseDeadline,
      p_location: request.location ? { expectedRevision: request.location.expectedRevision, value: location } : null }, raw => {
      const review = decodeAiTaskReview(raw, s.accountId); return review && sameId(review.conversationId, request.conversationId) ? review : null;
    }, true);
  },
  read(reviewId: string): Promise<Ishod<AiTaskReviewRead>> {
    const s = scope(); return !s ? Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED)) : !uuid(reviewId) ? invalid() : readFor(s, reviewId);
  },
  readLatest(conversationId: string): Promise<Ishod<AiTaskReviewRead | null>> {
    const s = scope(); if (!s) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED)); if (!uuid(conversationId)) return invalid();
    // Wrap a nullable success because the shared receipt decoder reserves null
    // for invalid server replies.
    return rpc(s, 'rpc_read_latest_ai_task_review', { p_conversation_id: conversationId }, raw => {
      const value = raw === null ? null : decodeRead(raw, s.accountId);
      return raw !== null && (!value || !sameId(value.review.conversationId, conversationId)) ? null : { value };
    }).then(r => r.ok ? { ok: true, podatak: r.podatak.value } : r);
  },
  async acceptAndPublish(command: Readonly<{ review: AiTaskReviewEnvelope; clientRequestId: string }>): Promise<Ishod<AiTaskPublicationCommand>> {
    const s = scope(); if (!s) return failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED);
    if (!uuid(command?.clientRequestId) || !decodeAiTaskReview(command.review, s.accountId)) return invalid();
    const reviewId = command.review.reviewId, digest = command.review.displayedContentDigest, requestId = command.clientRequestId;
    const frozenReview = { ...command.review };
    const accepted = await rpc(s, 'rpc_accept_ai_task_review', { p_review_id: reviewId,
      p_displayed_content_digest: digest, p_client_request_id: requestId }, raw => decodeCommandForReview(raw, frozenReview), true);
    if (!accepted.ok) return accepted;
    return resumeFor(s, accepted.podatak);
  },
  resume(command: AiTaskPublicationCommand): Promise<Ishod<AiTaskPublicationCommand>> {
    const s = scope(); return !s ? Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED)) : !decodeAiTaskPublicationCommand(command) ? invalid() : resumeFor(s, command);
  },
};
