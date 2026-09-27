jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: null, accountRevision: 0 }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { createAgreementHistoryModel, AGREEMENT_HISTORY_LIMIT, type AgreementHistoryPosition } from '../agreementHistoryModel';
import type { AgreementHistoryMessage, AgreementMessageCursor } from '../agreementMessageHistoryService';

const account = { accountId: '10000000-0000-4000-8000-000000000001', accountRevision: 7 };
const agreementId = '20000000-0000-4000-8000-000000000001';
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number): AgreementHistoryMessage => ({ id: id(n), moja: false, posiljalacIme: 'Sagovornik',
  posiljalacAccountId: '10000000-0000-4000-8000-000000000002', telo: `Message ${n}`, vremeTekst: '12:00', procitano: null,
  createdAt: `2026-09-27T12:00:00.${String(Math.floor(n / 3)).padStart(6, '0')}+00:00`, kind: 'TEXT' });
const cursor = (message: AgreementHistoryMessage): AgreementMessageCursor => ({ createdAt: message.createdAt, messageId: message.id });
const defer = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function setup(count = 521) {
  let rows = Array.from({ length: count }, (_, n) => row(n + 1)), owned = true;
  let position: AgreementHistoryPosition = { following: true };
  const envelope = { accountId: account.accountId, agreementId, authoritative: true as const, asOf: '2026-09-27T13:00:00.123456Z' };
  const page = jest.fn(async (_id: string, options: { limit?: number; before?: AgreementMessageCursor; signal?: AbortSignal }) => {
    const end = options.before ? rows.findIndex(message => message.id === options.before!.messageId) : rows.length;
    if (options.before) expect(cursor(rows[end])).toEqual(options.before);
    const start = Math.max(0, end - (options.limit ?? 50)), messages = rows.slice(start, end);
    return { ok: true as const, podatak: { ...envelope, messages, olderCursor: start ? cursor(messages[0]) : null } };
  });
  const window = jest.fn(async (_id: string, target: string, options: { beforeCount?: number; afterCount?: number; signal?: AbortSignal }) => {
    const index = rows.findIndex(message => message.id === target);
    if (index < 0) throw new Error('CHAT_MESSAGE_NOT_AVAILABLE');
    const start = Math.max(0, index - (options.beforeCount ?? 24)), end = Math.min(rows.length, index + (options.afterCount ?? 25) + 1);
    const messages = rows.slice(start, end);
    return { ok: true as const, podatak: { ...envelope, targetMessageId: target, messages,
      beforeCursor: start ? cursor(messages[0]) : null, afterCursor: end < rows.length ? cursor(messages[messages.length - 1]) : null } };
  });
  const model = createAgreementHistoryModel({ account, agreementId, port: { page, window },
    isCurrent: () => owned, position: () => position });
  return { model, page, window, setRows: (next: AgreementHistoryMessage[]) => { rows = next; },
    setOwned: (value: boolean) => { owned = value; }, setPosition: (next: AgreementHistoryPosition) => { position = next; } };
}
afterEach(() => jest.useRealTimers());

it('pages all 521 tied/microsecond rows backward and forward through a 200-row interval without gaps or duplicate IDs', async () => {
  const { model, page } = setup(); await model.start();
  expect(model.snapshot().data?.map(message => message.id)).toEqual(Array.from({ length: 50 }, (_, n) => id(n + 472)));
  const seen = new Set<string>();
  const inspect = () => {
    const rows = model.snapshot().data!;
    expect(rows.length).toBeLessThanOrEqual(AGREEMENT_HISTORY_LIMIT);
    expect(new Set(rows.map(message => message.id)).size).toBe(rows.length);
    const first = Number(rows[0].id.slice(-12));
    expect(rows.map(message => message.id)).toEqual(Array.from({ length: rows.length }, (_, n) => id(first + n)));
    rows.forEach(message => seen.add(message.id));
  };
  inspect();
  for (let n = 0; model.snapshot().olderCursor && n < 20; n++) { await model.loadOlder(); inspect(); }
  expect(model.snapshot().olderCursor).toBeNull();
  expect(model.snapshot().data?.[0].id).toBe(id(1));
  expect(model.snapshot().newerCursor).toEqual(cursor(row(200)));
  for (let n = 0; model.snapshot().newerCursor && n < 20; n++) { await model.loadNewer(); inspect(); }
  expect(model.snapshot().newerCursor).toBeNull();
  expect(model.snapshot().data?.at(-1)?.id).toBe(id(521));
  expect(seen.size).toBe(521);
  expect(page.mock.calls[1][1].before).toEqual(cursor(row(472)));
  model.stop();
});

it('keeps a reading anchor on refresh and exposes a disconnected newest page through bounded continuation', async () => {
  const { model, setRows, setPosition, window } = setup(200); await model.start();
  await model.loadOlder(); await model.loadOlder(); await model.loadOlder();
  setPosition({ following: false, anchor: { messageId: id(35) } });
  setRows(Array.from({ length: 400 }, (_, n) => row(n + 1)));
  await model.refresh('silent');
  expect(window).toHaveBeenLastCalledWith(agreementId, id(35), expect.objectContaining({ beforeCount: 24, afterCount: 25 }), account);
  expect(model.snapshot().data?.map(message => message.id)).toEqual(Array.from({ length: 200 }, (_, n) => id(n + 1)));
  expect(model.snapshot().newerCursor).toEqual(cursor(row(200)));
  await model.loadNewer();
  expect(model.snapshot().data?.at(-1)?.id).toBe(id(249));
  expect(model.snapshot().data).toHaveLength(200);
  model.stop();
});

it('merges an overlapping newest read, including a newly committed row before the prior last timestamp', async () => {
  const { model, setRows, setPosition } = setup(20); await model.start();
  setPosition({ following: false, anchor: { messageId: id(2) } });
  const late = { ...row(99), createdAt: row(12).createdAt };
  setRows([...Array.from({ length: 14 }, (_, n) => row(n + 1)), late, ...Array.from({ length: 16 }, (_, n) => row(n + 15))]);
  await model.refresh();
  expect(model.snapshot().data?.some(message => message.id === late.id)).toBe(true);
  expect(model.snapshot().data?.at(-1)?.id).toBe(id(30));
  expect(model.snapshot().newerCursor).toBeNull();
  model.stop();
});

it('uses a newly authorized anchor window on foreground restore, and newest only for an explicit latest intent', async () => {
  const { model, setPosition, window } = setup(); await model.start();
  setPosition({ following: false, anchor: { messageId: id(100) } });
  model.forget(); expect(model.snapshot().data).toBeNull();
  await model.start();
  expect(window).toHaveBeenLastCalledWith(agreementId, id(100), expect.objectContaining({ beforeCount: 24, afterCount: 25 }), account);
  expect(model.snapshot().data?.[0].id).toBe(id(76)); expect(model.snapshot().data?.at(-1)?.id).toBe(id(125));
  await model.showLatest();
  expect(model.snapshot().data?.[0].id).toBe(id(472)); expect(model.snapshot().newerCursor).toBeNull();
  model.stop();
});

it.each(['blur', 'background', 'account'] as const)('retires a late page after %s and aborts its signal', async cause => {
  const { model, page, setOwned } = setup();
  const pending = defer<any>(); page.mockReturnValueOnce(pending.promise);
  const read = model.start(); const signal = page.mock.calls[0][1].signal!;
  if (cause === 'blur') model.stop(); else if (cause === 'background') model.forget(); else setOwned(false);
  pending.resolve({ ok: true, podatak: { messages: [row(1)], olderCursor: null } }); await read;
  expect(model.snapshot().data).toBeNull(); expect(signal.aborted).toBe(true);
  model.stop();
});

it('times out stalled paging, retains the current interval and allows retry without applying the late result', async () => {
  jest.useFakeTimers(); const { model, page } = setup(); await model.start();
  const previous = model.snapshot().data; const pending = defer<any>(); page.mockReturnValueOnce(pending.promise);
  const read = model.loadOlder();
  await jest.advanceTimersByTimeAsync(15_000); await read;
  expect(model.snapshot()).toMatchObject({ data: previous, loadingOlder: false, historyErrorDirection: 'older' });
  await model.loadOlder(); const recovered = model.snapshot().data;
  expect(recovered).toHaveLength(100);
  pending.resolve({ ok: true, podatak: { messages: [row(1)], olderCursor: null } });
  await Promise.resolve(); expect(model.snapshot().data).toBe(recovered);
  model.stop();
});

it('coalesces concurrent refresh hints into one trailing read and never overlaps paging', async () => {
  const { model, window } = setup(); await model.start();
  const pending = defer<any>(); window.mockReturnValueOnce(pending.promise);
  const read = model.refresh(); const joined = model.refresh(); const third = model.refresh();
  expect(joined).toBe(read); expect(third).toBe(read); expect(window).toHaveBeenCalledTimes(1);
  expect(model.loadOlder()).toBe(read);
  pending.resolve({ ok: true, podatak: { messages: [row(521)], beforeCursor: cursor(row(521)), afterCursor: null, asOf: '2026-09-27T13:00:00.123456Z' } });
  await read; expect(window).toHaveBeenCalledTimes(2); expect(model.snapshot().refreshing).toBe(false);
  model.stop();
});

it('an explicit newest intent supersedes an older pending page and preserves canonical photo recovery identities', async () => {
  const { model, page, setRows } = setup(); await model.start();
  const pending = defer<any>(); page.mockReturnValueOnce(pending.promise); const old = model.loadOlder();
  const photo = { ...row(522), kind: 'PHOTO' as const, clientMessageId: 'photo_retry_123', dogovorVerzija: 3,
    fotografije: [{ assetId: '40000000-0000-4000-8000-000000000001', width: 100, height: 100, byteSize: 1000, contentType: 'image/jpeg' as const }] };
  setRows([...Array.from({ length: 521 }, (_, n) => row(n + 1)), photo]);
  await model.showLatest(); expect(model.snapshot().data?.at(-1)).toEqual(photo);
  pending.resolve({ ok: true, podatak: { messages: [row(1)], olderCursor: null } }); await old;
  expect(model.snapshot().data?.at(-1)).toEqual(photo); expect(model.snapshot().data).toHaveLength(50);
  model.stop();
});

it('clears retained private rows after an explicit authority refusal, including the newest probe', async () => {
  const { model, page } = setup(); await model.start();
  page.mockResolvedValueOnce({ ok: false, kod: 'MEDIA_NOT_FOUND', poruka: 'unavailable' } as any);
  await model.refresh();
  expect(model.snapshot()).toMatchObject({ data: null, loading: false, error: true });
  model.stop();
});

it('removes previously retained edges when a refreshed authoritative window reaches both true history boundaries', async () => {
  const { model, setRows, setPosition } = setup(3); await model.start();
  setPosition({ following: false, anchor: { messageId: id(2) } });
  setRows([row(2)]); await model.refresh();
  expect(model.snapshot().data).toEqual([row(2)]);
  expect(model.snapshot().olderCursor).toBeNull(); expect(model.snapshot().newerCursor).toBeNull();
  model.stop();
});

it('does not let an older concurrent newest statement remove a newer window arrival', async () => {
  const { model, window } = setup(20); await model.start();
  window.mockResolvedValueOnce({ ok: true, podatak: { accountId: account.accountId, agreementId, authoritative: true,
    targetMessageId: id(20), messages: [row(20), row(21)], beforeCursor: cursor(row(20)), afterCursor: null,
    asOf: '2026-09-27T13:00:00.123457Z' } });
  await model.refresh(); expect(model.snapshot().data?.at(-1)?.id).toBe(id(21));
  model.stop();
});

it('accepts an authoritative empty newest statement and removes the retained transcript', async () => {
  const { model, page } = setup(3); await model.start();
  page.mockResolvedValueOnce({ ok: true, podatak: { accountId: account.accountId, agreementId, authoritative: true,
    messages: [], olderCursor: null, asOf: '2026-09-27T13:00:00.123457Z' } });
  await model.refresh(); expect(model.snapshot()).toMatchObject({ data: [], olderCursor: null, newerCursor: null, error: false });
  model.stop();
});

it.each(['older', 'newer'] as const)('keeps a newer user reading anchor when a delayed %s page would otherwise evict it', async direction => {
  const { model, page, window, setPosition } = setup(350); await model.start();
  await model.loadOlder(); await model.loadOlder(); await model.loadOlder(); // 151..350
  if (direction === 'newer') { await model.loadOlder(); await model.loadOlder(); await model.loadOlder(); } // 1..200
  setPosition({ following: false, anchor: { messageId: id(direction === 'older' ? 151 : 200) } });
  const pending = defer<any>();
  if (direction === 'older') page.mockReturnValueOnce(pending.promise); else window.mockReturnValueOnce(pending.promise);
  const read = direction === 'older' ? model.loadOlder() : model.loadNewer();
  const held = id(direction === 'older' ? 350 : 1);
  setPosition({ following: false, anchor: { messageId: held } });
  pending.resolve({ ok: true, podatak: direction === 'older'
    ? { messages: Array.from({ length: 50 }, (_, n) => row(n + 101)), olderCursor: cursor(row(101)) }
    : { messages: Array.from({ length: 50 }, (_, n) => row(n + 200)), beforeCursor: cursor(row(200)), afterCursor: cursor(row(249)) } });
  await read;
  expect(model.snapshot().data).toHaveLength(200);
  expect(model.snapshot().data?.some(message => message.id === held)).toBe(true);
  expect(direction === 'older' ? model.snapshot().olderCursor : model.snapshot().newerCursor).toEqual(cursor(row(direction === 'older' ? 151 : 200)));
  model.stop();
});
