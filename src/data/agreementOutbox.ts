import { AgreementMessageError, type AgreementMessageCommand, type AgreementMessageErrorCode, type AgreementMessagePort } from '../contracts/agreementMessages';

export type OutboxError = AgreementMessageErrorCode | 'STORAGE_UNAVAILABLE' | 'STORAGE_INVALID' | 'CAPACITY' | 'NOT_READY';
export type OutboxEntry = Readonly<{
  command: AgreementMessageCommand;
  state: 'sending' | 'unknown' | 'failed' | 'confirmed';
  messageId?: string;
  error?: OutboxError;
  persisted: boolean;
  attempt: number;
}>;
export type OutboxSnapshot = Readonly<{
  phase: 'idle' | 'loading' | 'ready' | 'error';
  draft: string;
  capturing: boolean;
  entries: readonly OutboxEntry[];
  error: OutboxError | null;
}>;
export type ReadOwnMessage = Readonly<{ senderAccountId: string; clientMessageId: string; messageId: string; body: string }>;
export type AgreementOutboxOptions = {
  accountId: string;
  agreementId: string;
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
  messagePort: AgreementMessagePort;
  newId(): string;
  isCurrent(): boolean;
  canSendNew(): boolean;
  maxPending?: number;
};
type Stored = { version: 1; accountId: string; agreementId: string; revision: number; entries: OutboxEntry[] };
class Fault extends Error { constructor(readonly code: OutboxError) { super(code); } }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) && v.length === 36;
const clientKey = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/.test(v) && !/\s/.test(v);
const bodyValid = (body: unknown): body is string => typeof body === 'string' && body.length > 0 && !body.includes('\0') &&
  Array.from(body).length <= 2000 && !Array.from(body).some(point => { const code = point.codePointAt(0)!; return code >= 0xd800 && code <= 0xdfff; });
const errorCodes = new Set<OutboxError>(['AUTH_CONTEXT_CHANGED', 'INVALID_MESSAGE', 'READ_ONLY', 'NOT_AVAILABLE', 'CONFLICT', 'UNAVAILABLE', 'INVALID_RESPONSE', 'STORAGE_UNAVAILABLE', 'STORAGE_INVALID', 'CAPACITY', 'NOT_READY']);
const immutable = (entry: OutboxEntry): OutboxEntry => Object.freeze({ ...entry, command: Object.freeze({ ...entry.command }) });
const sameCommand = (a: AgreementMessageCommand, b: AgreementMessageCommand) => a.accountId === b.accountId && a.agreementId === b.agreementId && a.clientMessageId === b.clientMessageId && a.body === b.body;

// One read/merge/write queue per durable account+Agreement key, including across
// remounted instances with different storage wrapper objects. No network awaits
// occupy this queue: late acknowledgments merge into the newest durable record.
const queues = new Map<string, Promise<void>>();
const channels = new Map<string, Set<(record: Stored) => void>>();
function serial<T>(key: string, work: () => Promise<T>): Promise<T> {
  const task = (queues.get(key) ?? Promise.resolve()).then(work);
  const tail = task.then(() => undefined, () => undefined);
  queues.set(key, tail);
  void tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
  return task;
}

export function createAgreementOutbox(input: AgreementOutboxOptions) {
  const options = { ...input };
  if (!uuid(options.accountId) || !uuid(options.agreementId)) throw new Fault('AUTH_CONTEXT_CHANGED');
  const limit = options.maxPending ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Fault('CAPACITY');
  const storageKey = `uskoci:agreement-outbox:v1:${options.accountId}:${options.agreementId}`;
  let snapshot: OutboxSnapshot = Object.freeze({ phase: 'idle', draft: '', capturing: false, entries: [], error: null });
  let active = false, generation = 0, draftRevision = 0, appliedRevision = -1;
  let starting: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const inFlight = new Map<string, symbol>();
  const unsaved = new Map<string, OutboxEntry>();
  const owns = () => { try { return options.isCurrent(); } catch { return false; } };
  const current = () => active && owns();
  const maySendNew = () => { try { return options.canSendNew(); } catch { return false; } };
  const publish = (patch: Partial<OutboxSnapshot>) => {
    if (!current()) return;
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of listeners) { try { listener(); } catch { /* UI listeners do not invalidate a durable command. */ } }
  };
  const apply = (record: Stored) => {
    if (!current() || record.revision <= appliedRevision) return;
    appliedRevision = record.revision;
    for (const entry of record.entries) unsaved.delete(entry.command.clientMessageId);
    const entries = [...record.entries.map(entry => immutable({ ...entry,
      state: entry.state === 'sending' && !inFlight.has(entry.command.clientMessageId) ? 'unknown' : entry.state })), ...unsaved.values()];
    publish({ phase: 'ready', entries: Object.freeze(entries) });
  };
  const empty = (): Stored => ({ version: 1, accountId: options.accountId, agreementId: options.agreementId, revision: 0, entries: [] });
  async function read(): Promise<Stored> {
    let raw: string | null;
    try { raw = await options.storage.getItem(storageKey); } catch { throw new Fault('STORAGE_UNAVAILABLE'); }
    if (raw === null) return empty();
    try {
      if (raw.length > 2_000_000) throw new Error();
      const data = JSON.parse(raw) as Stored;
      if (data.version !== 1 || data.accountId !== options.accountId || data.agreementId !== options.agreementId ||
        !Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.entries) || data.entries.length > 100) throw new Error();
      const keys = new Set<string>();
      for (const entry of data.entries) {
        const command = entry.command;
        if (!command || command.accountId !== options.accountId || command.agreementId !== options.agreementId ||
          !clientKey(command.clientMessageId) || keys.has(command.clientMessageId) || !bodyValid(command.body) || command.body !== command.body.trim() ||
          !['sending', 'unknown', 'failed', 'confirmed'].includes(entry.state) || entry.persisted !== true ||
          !Number.isSafeInteger(entry.attempt) || entry.attempt < 1 ||
          (entry.error !== undefined && !errorCodes.has(entry.error)) ||
          (entry.state === 'confirmed' ? !uuid(entry.messageId) : entry.messageId !== undefined)) throw new Error();
        keys.add(command.clientMessageId);
      }
      return { ...data, entries: data.entries.map(immutable) };
    } catch { throw new Fault('STORAGE_INVALID'); }
  }
  function update(change: (record: Stored) => void, requireActive = true, admitted?: number): Promise<Stored> {
    return serial(storageKey, async () => {
      if (!owns() || (requireActive && !active) || (admitted !== undefined && admitted !== generation)) throw new Fault('AUTH_CONTEXT_CHANGED');
      const record = await read();
      const before = JSON.stringify(record.entries);
      change(record);
      if (!owns() || (requireActive && !active) || (admitted !== undefined && admitted !== generation)) throw new Fault('AUTH_CONTEXT_CHANGED');
      if (JSON.stringify(record.entries) === before) { apply(record); return record; }
      record.revision += 1;
      // Pending/unknown intents are never pruned. A bounded acknowledged cache
      // complements the authoritative server history; it is not chat history.
      let confirmed = record.entries.filter(entry => entry.state === 'confirmed').length;
      record.entries = record.entries.filter(entry => entry.state !== 'confirmed' || confirmed-- <= limit);
      try { await options.storage.setItem(storageKey, JSON.stringify(record)); } catch { throw new Fault('STORAGE_UNAVAILABLE'); }
      for (const receive of channels.get(storageKey) ?? []) receive(record);
      return record;
    });
  }
  const failureCode = (error: unknown): OutboxError => error instanceof Fault || error instanceof AgreementMessageError ? error.code : 'UNAVAILABLE';
  async function finish(command: AgreementMessageCommand, attempt: number, state: OutboxEntry['state'], messageId?: string, error?: OutboxError) {
    try {
      await update(record => {
        const index = record.entries.findIndex(entry => entry.command.clientMessageId === command.clientMessageId);
        if (index < 0) return;
        const existing = record.entries[index];
        if (!sameCommand(existing.command, command)) throw new Fault('CONFLICT');
        // A refreshed committed row or another instance's acknowledgment wins
        // over a late timeout/refusal from an older request.
        if (existing.state === 'confirmed') return;
        if (state !== 'confirmed' && existing.attempt !== attempt) return;
        record.entries[index] = immutable({ command, state, messageId, error, persisted: true, attempt: existing.attempt });
      }, false);
    } catch (error) {
      if (!current()) return;
      publish({ error: failureCode(error), entries: Object.freeze(snapshot.entries.map(entry =>
        entry.command.clientMessageId === command.clientMessageId && entry.state !== 'confirmed' && entry.attempt === attempt
          ? immutable({ ...entry, state: 'unknown', error: 'STORAGE_UNAVAILABLE' }) : entry)) });
    }
  }
  async function dispatch(command: AgreementMessageCommand, attempt: number, isNew: boolean, admitted: number) {
    if (!current() || admitted !== generation) return;
    if (isNew && !maySendNew()) { await finish(command, attempt, 'failed', undefined, 'READ_ONLY'); return; }
    // No await between the final context check and the actor-bound port call.
    if (!current() || admitted !== generation) return;
    try {
      const acknowledgment = await options.messagePort.send(command);
      if (!uuid(acknowledgment?.messageId)) throw new AgreementMessageError('INVALID_RESPONSE');
      await finish(command, attempt, 'confirmed', acknowledgment.messageId);
    } catch (error) {
      const code = failureCode(error);
      await finish(command, attempt, code === 'UNAVAILABLE' || code === 'INVALID_RESPONSE' ? 'unknown' : 'failed', undefined, code);
    }
  }
  function add(record: Stored, command: AgreementMessageCommand) {
    if (record.entries.some(entry => entry.command.clientMessageId === command.clientMessageId)) throw new Fault('CONFLICT');
    // A retry converts its own volatile reservation to durable storage. Other
    // unsaved intents still consume capacity and must not be silently dropped.
    const pending = new Set(record.entries.filter(entry => entry.state !== 'confirmed').map(entry => entry.command.clientMessageId));
    for (const key of unsaved.keys()) if (key !== command.clientMessageId) pending.add(key);
    if (pending.size >= limit) throw new Fault('CAPACITY');
    record.entries.push(immutable({ command, state: 'sending', persisted: true, attempt: record.revision + 1 }));
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(): Promise<void> {
      if (active && starting) return starting;
      active = true; const admitted = ++generation;
      appliedRevision = -1;
      const receivers = channels.get(storageKey) ?? new Set(); receivers.add(apply); channels.set(storageKey, receivers);
      publish({ phase: 'loading', error: null, capturing: false });
      const task = serial(storageKey, read).then(record => {
        if (admitted === generation) apply(record);
      }).catch(error => { if (admitted === generation) publish({ phase: 'error', error: failureCode(error) }); });
      starting = task;
      void task.then(() => { if (starting === task) starting = null; });
      return task;
    },
    stop() {
      active = false; generation += 1;
      inFlight.clear();
      const receivers = channels.get(storageKey); receivers?.delete(apply);
      if (receivers?.size === 0) channels.delete(storageKey);
    },
    setDraft(draft: string) {
      if (!current()) return;
      draftRevision += 1; publish({ draft, error: null });
    },
    sendDraft(): Promise<void> {
      if (!current()) return Promise.resolve();
      if (snapshot.capturing) return Promise.resolve();
      if (snapshot.phase !== 'ready') { publish({ error: 'NOT_READY' }); return Promise.resolve(); }
      if (!maySendNew()) { publish({ error: 'READ_ONLY' }); return Promise.resolve(); }
      // Reserve capacity before storage can fail. Otherwise repeated failures
      // while the user types the next draft grow the volatile fallback forever.
      if (snapshot.entries.filter(entry => entry.state !== 'confirmed').length >= limit) {
        publish({ error: 'CAPACITY' }); return Promise.resolve();
      }
      const admitted = generation;
      const originalDraft = snapshot.draft, revision = draftRevision;
      const body = originalDraft.trim();
      let id: string;
      try { id = options.newId(); } catch { publish({ error: 'INVALID_MESSAGE' }); return Promise.resolve(); }
      if (!bodyValid(body) || !clientKey(id)) { publish({ error: 'INVALID_MESSAGE' }); return Promise.resolve(); }
      const command = Object.freeze({ accountId: options.accountId, agreementId: options.agreementId, clientMessageId: id, body });
      const request = Symbol(); inFlight.set(id, request); publish({ capturing: true, error: null });
      return (async () => {
        try {
          const record = await update(record => add(record, command), true, admitted);
          if (admitted === generation) {
            if (revision === draftRevision) publish({ draft: '' });
            publish({ capturing: false });
          }
          await dispatch(command, record.entries.find(entry => entry.command.clientMessageId === id)!.attempt, true, admitted);
        } catch (error) {
          // If the user already composed different text, retain the unsaved
          // captured intent as a retryable local row instead of losing either.
          if (current() && admitted === generation && revision !== draftRevision && failureCode(error) === 'STORAGE_UNAVAILABLE') {
            const entry = immutable({ command, state: 'failed', persisted: false, error: 'STORAGE_UNAVAILABLE', attempt: 1 });
            unsaved.set(id, entry); publish({ entries: Object.freeze([...snapshot.entries, entry]) });
          }
          if (admitted === generation) publish({ error: failureCode(error), capturing: false });
        } finally { if (inFlight.get(id) === request) inFlight.delete(id); }
      })();
    },
    async retry(clientMessageId: string): Promise<void> {
      if (!current() || snapshot.phase !== 'ready' || inFlight.has(clientMessageId)) return;
      const entry = snapshot.entries.find(item => item.command.clientMessageId === clientMessageId);
      if (!entry || entry.state === 'confirmed') return;
      const admitted = generation;
      const command = entry.command;
      const request = Symbol(); inFlight.set(clientMessageId, request); publish({ error: null });
      try {
        let acknowledged = false;
        const record = await update(record => {
          const index = record.entries.findIndex(item => item.command.clientMessageId === clientMessageId);
          if (index < 0) { if (entry.persisted) throw new Fault('STORAGE_INVALID'); add(record, command); return; }
          if (!sameCommand(record.entries[index].command, command)) throw new Fault('CONFLICT');
          if (record.entries[index].state === 'confirmed') { acknowledged = true; return; }
          record.entries[index] = immutable({ command, state: 'sending', persisted: true, attempt: record.revision + 1 });
        }, true, admitted);
        if (!acknowledged) await dispatch(command, record.entries.find(item => item.command.clientMessageId === clientMessageId)!.attempt, false, admitted);
      } catch (error) { if (admitted === generation) publish({ error: failureCode(error) }); }
      finally { if (inFlight.get(clientMessageId) === request) inFlight.delete(clientMessageId); }
    },
    async reconcile(readOwn: readonly ReadOwnMessage[]): Promise<void> {
      if (!current() || snapshot.phase !== 'ready' || readOwn.length === 0) return;
      const admitted = generation;
      // Capture external reads before awaiting storage or accepting another account.
      const reads = readOwn.filter(row => row.senderAccountId === options.accountId && clientKey(row.clientMessageId) && uuid(row.messageId) && bodyValid(row.body)).map(row => ({ ...row }));
      if (reads.length === 0) return;
      try {
        let matched = false;
        await update(record => {
          record.entries = record.entries.map(entry => {
            const matches = reads.filter(row => row.clientMessageId === entry.command.clientMessageId);
            if (matches.length === 0) return entry;
            matched = true;
            if (matches.some(row => row.body !== entry.command.body || row.messageId !== matches[0].messageId ||
              (entry.messageId !== undefined && row.messageId !== entry.messageId))) throw new Fault('CONFLICT');
            return immutable({ command: entry.command, state: 'confirmed', messageId: matches[0].messageId, persisted: true, attempt: entry.attempt });
          });
        }, true, admitted);
        if (matched && admitted === generation && snapshot.error !== null) publish({ error: null });
      } catch (error) { if (admitted === generation) publish({ error: failureCode(error) }); }
    },
  };
}
