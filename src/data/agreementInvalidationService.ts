import { AppState } from 'react-native';
import { sesijaSada } from '../store/sesija';
import { createAgreementIncomingRefresh } from './agreementIncomingRefresh';
import { record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type AgreementInvalidationScope = {
  accountId: string; accountRevision: number; sessionEpoch: number; agreementId: string;
  /** Caller owns focus, source, loaded participant and current chat/closure admission. */
  isCurrent: () => boolean;
  /** Re-read the existing bounded B3 history; never merge a wire row or send an ACK. */
  refresh: () => Promise<void>;
  /** A native owner may share one coalescer with its push fallback. */
  onHint?: () => void;
};
type Owner = { accountId: string | null; accountRevision: number; sessionEpoch: number };
export type AgreementInvalidationTransport = {
  change: (event: 'INSERT' | 'UPDATE', agreementId: string, callback: (value: unknown) => void) => void;
  system: (callback: (value: unknown) => void) => void;
  subscribe: (callback: (status: string) => void) => void;
  remove: () => unknown;
};
type Dependencies = {
  open: (topic: string) => AgreementInvalidationTransport;
  owner: () => Owner;
  activity: () => string | null;
  onActivity: (callback: (state: string) => void) => { remove: () => void };
};
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const revision = (value: number) => Number.isSafeInteger(value) && value >= 0;
let nextSubscription = 0;

/** Deliberately returns no row: even a validated revision is only a reread hint. */
export function isAgreementInvalidation(value: unknown, agreementId: string): boolean {
  const payload = record(value), row = record(payload?.new), old = record(payload?.old);
  if (!uuid(agreementId) || !payload || !row || !old
    || Object.keys(payload).some(key => !['schema', 'table', 'eventType', 'commit_timestamp', 'new', 'old', 'errors'].includes(key))
    || payload.schema !== 'public' || payload.table !== 'agreement_invalidations_v1'
    || (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') || !timestamp(payload.commit_timestamp)
    || (payload.errors != null && (!Array.isArray(payload.errors) || payload.errors.length !== 0))
    || Object.keys(row).length !== 2 || !Object.prototype.hasOwnProperty.call(row, 'agreement_id')
    || !Object.prototype.hasOwnProperty.call(row, 'revision') || !sameId(row.agreement_id, agreementId) || !positive(row.revision)
    || Object.keys(old).some(key => key !== 'agreement_id' && key !== 'revision')
    || ('agreement_id' in old && !sameId(old.agreement_id, agreementId))
    || ('revision' in old && !positive(old.revision))) return false;
  return true;
}

/** One foreground owner creates one SDK channel. SDK reconnects that
 * channel; this service never starts another channel, polls, or resumes itself.
 */
export function createAgreementInvalidationService(dependencies: Dependencies) {
  return (input: AgreementInvalidationScope): (() => void) => {
    const scope = { ...input };
    let alive = true, queued = false;
    let channel: AgreementInvalidationTransport | undefined;
    let activity: { remove: () => void } | undefined;
    let coordinator: ReturnType<typeof createAgreementIncomingRefresh> | undefined;
    const stop = () => {
      alive = false; queued = false; coordinator?.stop();
      const oldActivity = activity, oldChannel = channel;
      activity = undefined; channel = undefined;
      try { oldActivity?.remove(); } catch { /* Ownership is already retired. */ }
      try { void Promise.resolve(oldChannel?.remove()).catch(() => undefined); } catch { /* No retained callback can act. */ }
    };
    const current = () => {
      if (!alive) return false;
      try {
        const owner = dependencies.owner();
        if (dependencies.activity() === 'active' && scope.isCurrent()
          && owner.accountId === scope.accountId && owner.accountRevision === scope.accountRevision
          && owner.sessionEpoch === scope.sessionEpoch) return true;
      } catch { /* An unavailable owner cannot authorize a hint. */ }
      stop(); return false;
    };
    // Join, Postgres-ready and arrival callbacks can share the same JS turn.
    // Batch that turn; a hint arriving during a read still earns a trailing read.
    const hint = () => {
      if (!current() || queued) return;
      if (scope.onHint) { scope.onHint(); return; }
      queued = true;
      void Promise.resolve().then(() => {
        queued = false;
        if (current()) coordinator?.hint();
      });
    };
    if (!uuid(scope.accountId) || !uuid(scope.agreementId) || !revision(scope.accountRevision)
      || !revision(scope.sessionEpoch) || !current()) { stop(); return stop; }
    if (!scope.onHint) coordinator = createAgreementIncomingRefresh({ refresh: scope.refresh, isCurrent: current });
    try {
      activity = dependencies.onActivity(state => { if (state !== 'active') stop(); });
      if (!current()) { stop(); return stop; }
      channel = dependencies.open('agreement-invalidation-' + ++nextSubscription);
      if (!current()) { stop(); return stop; }
      const change = (value: unknown) => { if (current() && isAgreementInvalidation(value, scope.agreementId)) hint(); };
      channel.change('INSERT', scope.agreementId, change);
      if (!current()) { stop(); return stop; }
      channel.change('UPDATE', scope.agreementId, change);
      if (!current()) { stop(); return stop; }
      channel.system(value => {
        if (!current()) return;
        const event = record(value);
        if (event?.extension === 'postgres_changes' && event.status === 'ok') hint();
      });
      if (!current()) { stop(); return stop; }
      channel.subscribe(status => { if (current() && status === 'SUBSCRIBED') hint(); });
      if (!current()) stop();
    } catch { stop(); }
    return stop;
  };
}

/** The existing authenticated singleton already forwards Auth token changes to
 * Realtime. Do not freeze a JWT or change its shared auth/accessToken settings.
 * Native owner calls stop on blur/source/session/terminal changes.
 */
export const subscribeAgreementInvalidations = createAgreementInvalidationService({
  owner: () => {
    const session = sesijaSada();
    return { accountId: session.session?.user.id ?? null,
      accountRevision: session.accountRevision, sessionEpoch: session.sessionEpoch };
  },
  activity: () => AppState.currentState,
  onActivity: callback => AppState.addEventListener('change', callback),
  open: topic => {
    const client = supabaseKlijent(), channel = client.channel(topic);
    return {
      change: (event, agreementId, callback) => {
        if (event === 'INSERT') channel.on('postgres_changes', { event, schema: 'public', table: 'agreement_invalidations_v1', filter: 'agreement_id=eq.' + agreementId }, callback);
        else channel.on('postgres_changes', { event, schema: 'public', table: 'agreement_invalidations_v1', filter: 'agreement_id=eq.' + agreementId }, callback);
      },
      system: callback => { channel.on('system', {}, callback); },
      subscribe: callback => { channel.subscribe(callback, 15_000); },
      remove: () => client.removeChannel(channel),
    };
  },
});
