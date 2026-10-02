jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { REVIEW_TAGS, type ReviewCommand } from '../reviewsClientService';
import { REVIEW_COMMENT_MESSAGES } from '../reviewCommentText';
import {
  REVIEW_COMMENT_PAGE_MAX, REVIEW_COMMENT_PAGE_SIZE, resetReviewCommentCapability, reviewCommentCapability, reviewCommentsClientService as service,
} from '../reviewCommentsClientService';

/**
 * D12, the client service (supabase/candidates/d12_review_comment.sql is the contract): the flag decides whether anything new is
 * ever asked; the capability test is PGRST202 on `rpc_get_my_agreement_review_v2`; the review is sent through v2 with
 * `p_comment` only when the person wrote one; the echoed comment is compared with what was sent; every error becomes a plain
 * sentence; the comment text is never written anywhere. Special characters are built from numbers: see review-comment-text.test.ts.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', R = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const P = '99999999-9999-4999-8999-999999999999', R2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff', P2 = '88888888-8888-4888-8888-888888888888';
const ch = (...codes: number[]) => String.fromCodePoint(...codes);
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
const FLAG = 'EXPO_PUBLIC_D12_REVIEW_COMMENT';
const command = (patch: Partial<ReviewCommand> = {}): ReviewCommand => ({ agreementId: D, targetAccountId: B, rating: 5, tags: ['RELIABLE', 'ON_TIME'], clientRequestId: K, ...patch });
const receipt = () => ({ agreementId: D, targetAccountId: B, rating: 5, tags: ['ON_TIME', 'RELIABLE'], clientRequestId: K, reviewId: R, reviewerAccountId: A,
  createdAt: '2026-10-02T06:49:50.123456+00:00', idempotentReplay: false, authoritative: true });
const policy = () => ({ supported: true, maxLength: 500, version: 'REVIEW_COMMENT_V1' });
const context = () => ({ accountId: A, agreementId: D, targetAccountId: B, eligible: true, review: null,
  tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [...REVIEW_TAGS] }, authoritative: true });
const context2 = () => ({ ...context(), commentPolicy: policy() });
const NOT_FOUND = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.rpc_get_my_agreement_review_v2(p_agreement_id) in the schema cache' } };
const calls = () => mockRpc.mock.calls.map(call => call[0]);
const SECRET = 'Tajni komentar 12345 qwertz';

beforeEach(() => {
  mockSession = { user: { id: A }, accountRevision: 1 };
  mockRpc.mockReset(); resetReviewCommentCapability();
  delete process.env[FLAG];
});
afterAll(() => { delete process.env[FLAG]; });
const flagOn = () => { process.env[FLAG] = '1'; };

describe('flag OFF: the legacy review pair only, no extra request, nothing new', () => {
  it('reads the context through the legacy function, once, and the context carries no comment policy', async () => {
    mockRpc.mockResolvedValue({ data: context(), error: null });
    const result = await service.context(D);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_get_my_agreement_review', { p_agreement_id: D });
    expect(result).toEqual({ ok: true, podatak: context() });
    expect(reviewCommentCapability()).toBe('unknown');
  });

  it('sends the review through the legacy function with the legacy arguments and nothing else', async () => {
    mockRpc.mockResolvedValue({ data: receipt(), error: null });
    const result = await service.submit(command());
    expect(result).toMatchObject({ ok: true });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_submit_agreement_review',
      { p_agreement_id: D, p_target_account_id: B, p_rating: 5, p_tags: ['ON_TIME', 'RELIABLE'], p_client_request_id: K });
  });

  it('never drops a typed comment silently: it refuses without a request', async () => {
    const result = await service.submit(command({ comment: SECRET }));
    expect(result).toMatchObject({ ok: false, kod: 'REVIEW_COMMENT_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does not read the comments of a profile', async () => {
    expect(await service.list(P)).toMatchObject({ ok: false, kod: 'REVIEW_COMMENTS_UNAVAILABLE' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('flag ON: the capability test', () => {
  beforeEach(flagOn);

  it('reads the context through v2, once, and keeps the comment policy and the own comment', async () => {
    mockRpc.mockResolvedValue({ data: context2(), error: null });
    const result = await service.context(D);
    expect(calls()).toEqual(['rpc_get_my_agreement_review_v2']);
    expect(mockRpc).toHaveBeenCalledWith('rpc_get_my_agreement_review_v2', { p_agreement_id: D });
    expect(result).toEqual({ ok: true, podatak: { ...context(), commentPolicy: policy() } });
    expect(reviewCommentCapability()).toBe('supported');
    mockRpc.mockResolvedValue({ data: { ...context2(), eligible: false, review: { ...receipt(), comment: 'Odlicno.' } }, error: null });
    expect(await service.context(D)).toMatchObject({ ok: true, podatak: { eligible: false, review: { reviewId: R, comment: 'Odlicno.' } } });
    mockRpc.mockResolvedValue({ data: { ...context2(), eligible: false, review: { ...receipt(), comment: null } }, error: null });
    expect(await service.context(D)).toMatchObject({ ok: true, podatak: { review: { comment: null } } });
  });

  it('PGRST202 means no comments: it falls back to the legacy pair for the session, caches the verdict and never loops', async () => {
    mockRpc.mockImplementation(async (name: string) => name === 'rpc_get_my_agreement_review_v2' ? NOT_FOUND : { data: context(), error: null });
    const first = await service.context(D);
    expect(first).toEqual({ ok: true, podatak: context() });
    expect(calls()).toEqual(['rpc_get_my_agreement_review_v2', 'rpc_get_my_agreement_review']);
    expect(reviewCommentCapability()).toBe('unsupported');
    await service.context(D); await service.context(D);
    expect(calls()).toEqual(['rpc_get_my_agreement_review_v2', 'rpc_get_my_agreement_review', 'rpc_get_my_agreement_review', 'rpc_get_my_agreement_review']);
  });

  it('a legacy failure after the fallback is the normal error path, with no third request', async () => {
    mockRpc.mockImplementation(async (name: string) => name === 'rpc_get_my_agreement_review_v2' ? NOT_FOUND : { data: null, error: { message: 'NETWORK' } });
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE' });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('only the code PGRST202 is the capability verdict: its wording alone, or any other error, is the normal error path and caches nothing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.rpc_get_my_agreement_review_v2' } });
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE' });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } });
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE' });
    mockRpc.mockRejectedValue(new Error('Network request failed'));
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE' });
    expect(calls()).toEqual(['rpc_get_my_agreement_review_v2', 'rpc_get_my_agreement_review_v2', 'rpc_get_my_agreement_review_v2']);
    expect(reviewCommentCapability()).toBe('unknown');
  });

  it.each([
    ['no comment policy', () => { const { commentPolicy, ...rest } = context2(); void commentPolicy; return rest; }],
    ['a policy that says unsupported', () => ({ ...context2(), commentPolicy: { ...policy(), supported: false } })],
    ['another policy version', () => ({ ...context2(), commentPolicy: { ...policy(), version: 'REVIEW_COMMENT_V2' } })],
    ['a limit that is not the one the server states', () => ({ ...context2(), commentPolicy: { ...policy(), maxLength: 5000 } })],
    ['a limit of zero', () => ({ ...context2(), commentPolicy: { ...policy(), maxLength: 0 } })],
    ['a policy that is not an object', () => ({ ...context2(), commentPolicy: 'yes' })],
    ['an own comment that is not text', () => ({ ...context2(), eligible: false, review: { ...receipt(), comment: 7 } })],
    ['an own comment that is empty', () => ({ ...context2(), eligible: false, review: { ...receipt(), comment: '' } })],
    ['an own review without the comment field', () => ({ ...context2(), eligible: false, review: receipt() })],
    ['a foreign account', () => ({ ...context2(), accountId: B })],
  ])('an unknown shape is a typed error, never a crash: %s', async (_name, data) => {
    mockRpc.mockResolvedValue({ data: data(), error: null });
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'REVIEW_INVALID_RECEIPT' });
  });

  it('keeps the legacy refusals of the legacy context: not a participant, signed out, no session', async () => {
    expect(await service.context('not-a-uuid')).toMatchObject({ ok: false, kod: 'REVIEW_NOT_ALLOWED' });
    mockSession = { user: null, accountRevision: 2 };
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('flag ON: the review is sent through v2', () => {
  beforeEach(flagOn);

  it('with a comment: the body carries p_comment, once, and the echoed comment is the receipt', async () => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), comment: 'Sve pohvale.' }, error: null });
    const result = await service.submit(command({ comment: 'Sve pohvale.' }));
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_submit_agreement_review_v2', { p_agreement_id: D, p_target_account_id: B, p_rating: 5,
      p_tags: ['ON_TIME', 'RELIABLE'], p_client_request_id: K, p_comment: 'Sve pohvale.' });
    expect(result).toMatchObject({ ok: true, podatak: { reviewId: R, rating: 5, comment: 'Sve pohvale.' } });
  });

  it('without a comment: the body has no p_comment at all, and the receipt says there is none', async () => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), comment: null }, error: null });
    const result = await service.submit(command());
    const body = mockRpc.mock.calls[0][1];
    expect(mockRpc.mock.calls[0][0]).toBe('rpc_submit_agreement_review_v2');
    expect(Object.keys(body).sort()).toEqual(['p_agreement_id', 'p_client_request_id', 'p_rating', 'p_tags', 'p_target_account_id']);
    expect(result).toMatchObject({ ok: true, podatak: { comment: null } });
  });

  it.each([[''], ['   '], ['\n\n'], [null], [undefined], [ch(0x200C)]])('a comment that is nothing (%j) is not sent', async value => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), comment: null }, error: null });
    expect(await service.submit(command({ comment: value as never }))).toMatchObject({ ok: true });
    expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_comment');
  });

  it('trims and composes the text to NFC before it is sent, and the echo is compared with what was sent', async () => {
    const sent = `${ch(0xE9)} dobro\nkraj`;
    mockRpc.mockResolvedValue({ data: { ...receipt(), comment: sent }, error: null });
    const result = await service.submit(command({ comment: `  e${ch(0x301)} dobro\r\nkraj \n` }));
    expect(mockRpc.mock.calls[0][1].p_comment).toBe(sent);
    expect(result).toMatchObject({ ok: true, podatak: { comment: sent } });
  });

  it('keeps the same idempotency discipline as the legacy command: the same request id, an immutable replay accepted, no automatic replay', async () => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), idempotentReplay: true, comment: 'Isto.' }, error: null });
    expect(await service.submit(command({ comment: 'Isto.' }))).toMatchObject({ ok: true, podatak: { idempotentReplay: true, comment: 'Isto.' } });
    expect(mockRpc.mock.calls[0][1].p_client_request_id).toBe(K);
    mockRpc.mockReset(); mockRpc.mockResolvedValue({ data: null, error: { message: 'SOMETHING_ELSE' } });
    expect(await service.submit(command({ comment: 'Isto.' }))).toMatchObject({ ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['another text came back', 'Sent text', { comment: 'Another text' }],
    ['nothing came back for a comment that was sent', 'Sent text', { comment: null }],
    ['a comment came back for a review sent without one', undefined, { comment: 'Unasked text' }],
    ['the text came back changed by a space', 'Sent text', { comment: 'Sent text ' }],
  ])('an echo that differs is an error state, never a success: %s', async (_name, sent, echo) => {
    mockRpc.mockResolvedValue({ data: { ...receipt(), ...echo }, error: null });
    const result = await service.submit(command({ comment: sent }));
    expect(result).toEqual({ ok: false, kod: 'REVIEW_COMMENT_MISMATCH', poruka: REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_MISMATCH });
  });

  it('a receipt without the comment field, or with one that is not text, is an invalid receipt', async () => {
    mockRpc.mockResolvedValue({ data: receipt(), error: null });
    expect(await service.submit(command())).toMatchObject({ ok: false, kod: 'REVIEW_INVALID_RECEIPT' });
    mockRpc.mockResolvedValue({ data: { ...receipt(), comment: 5 }, error: null });
    expect(await service.submit(command({ comment: 'x' }))).toMatchObject({ ok: false, kod: 'REVIEW_INVALID_RECEIPT' });
    mockRpc.mockResolvedValue({ data: { ...receipt(), rating: 4, comment: null }, error: null });
    expect(await service.submit(command())).toMatchObject({ ok: false, kod: 'REVIEW_INVALID_RECEIPT' });
  });

  it('refuses before any request what the server would refuse: too long, an invisible character, NUL, a lone surrogate', async () => {
    const lone = String.fromCharCode(0xD800);
    expect(await service.submit(command({ comment: 'a'.repeat(501) }))).toEqual({ ok: false, kod: 'REVIEW_COMMENT_TOO_LONG', poruka: REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_TOO_LONG });
    for (const text of [`a${ch(0x200B)}b`, `a${ch(0)}b`, `a${lone}b`, `a${ch(0x2028)}b`]) {
      expect(await service.submit(command({ comment: text }))).toEqual({ ok: false, kod: 'REVIEW_COMMENT_INVALID', poruka: REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_INVALID });
    }
    expect(await service.submit(command({ comment: 42 as never }))).toMatchObject({ ok: false, kod: 'REVIEW_COMMENT_INVALID' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('keeps the legacy input checks, before any request', async () => {
    for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { agreementId: 'bad' }, { targetAccountId: A }, { clientRequestId: 'bad' }]) {
      expect((await service.submit(command(patch as never))).ok).toBe(false);
    }
    expect(await service.submit(command({ tags: ['INVENTED'] as never }))).toMatchObject({ ok: false, kod: 'REVIEW_TAGS_INVALID' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('PGRST202 on the submit: without a comment the same command goes once through the legacy function; with a comment nothing is sent without it', async () => {
    mockRpc.mockImplementation(async (name: string) => name === 'rpc_submit_agreement_review_v2' ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
      : { data: receipt(), error: null });
    expect(await service.submit(command())).toMatchObject({ ok: true, podatak: { reviewId: R } });
    expect(calls()).toEqual(['rpc_submit_agreement_review_v2', 'rpc_submit_agreement_review']);
    expect(mockRpc.mock.calls[1][1]).toEqual({ p_agreement_id: D, p_target_account_id: B, p_rating: 5, p_tags: ['ON_TIME', 'RELIABLE'], p_client_request_id: K });
    expect(reviewCommentCapability()).toBe('unsupported');
    mockRpc.mockClear();
    const withComment = await service.submit(command({ comment: SECRET }));
    expect(withComment).toEqual({ ok: false, kod: 'REVIEW_COMMENT_UNAVAILABLE', poruka: REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_UNAVAILABLE });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(await service.submit(command())).toMatchObject({ ok: true });
    expect(calls()).toEqual(['rpc_submit_agreement_review']);
  });

  it('PGRST202 on a submit that carries a comment keeps the comment out of every other request', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await service.submit(command({ comment: SECRET }))).toMatchObject({ ok: false, kod: 'REVIEW_COMMENT_UNAVAILABLE' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(reviewCommentCapability()).toBe('unsupported');
  });

  it('fences a late answer after an account switch, and does not write for a signed-out session', async () => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
    const pending = service.submit(command({ comment: 'x' }), { accountId: A, accountRevision: 1 });
    mockSession = { user: { id: B }, accountRevision: 2 };
    resolve({ data: { ...receipt(), comment: 'x' }, error: null });
    expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    mockRpc.mockReset(); mockSession = { user: null, accountRevision: 3 };
    expect(await service.submit(command())).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('flag ON: every error the submit can meet becomes a plain sentence with a way on', () => {
  beforeEach(flagOn);
  const named: [string, string][] = [
    ['REVIEW_COMMENT_INVALID', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_INVALID],
    ['REVIEW_COMMENT_TOO_LONG', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_TOO_LONG],
    ['REVIEW_COMMENT_CONTACT_NOT_PUBLIC', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_CONTACT_NOT_PUBLIC],
    ['REQUEST_ID_REUSED', 'Ovaj zahtev je već iskorišćen za drugu ocenu ili komentar. Proveri sačuvanu ocenu.'],
    ['REVIEW_ALREADY_SUBMITTED', 'Ovaj Dogovor je već ocenjen, a ocena se ne menja. Proveri sačuvanu ocenu.'],
    ['REVIEW_NOT_COMPLETED', 'Ocena je dostupna tek kad se Dogovor završi. Vrati se kasnije.'],
    ['REVIEW_NOT_ALLOWED', 'Možeš oceniti samo drugu stranu svog Dogovora. Vrati se na Dogovor.'],
    ['AUTH_REQUIRED', 'Prijavi se da nastaviš.'],
  ];
  it.each(named)('%s', async (name, sentence) => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: name, details: SECRET, hint: SECRET } });
    const result = await service.submit(command({ comment: 'Sve pohvale.' }));
    expect(result).toEqual({ ok: false, kod: name, poruka: sentence });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it.each([['22P05', 'unsupported Unicode escape sequence'], ['22P02', 'invalid input syntax for type json']])(
    'the error that arrives before the function runs (%s) is an invalid character, and its text is never shown', async (code, message) => {
      mockRpc.mockResolvedValue({ data: null, error: { code, message, details: `Token "${SECRET}" is invalid.`, hint: null } });
      const result = await service.submit(command({ comment: 'Sve pohvale.' }));
      expect(result).toEqual({ ok: false, kod: 'REVIEW_COMMENT_INVALID', poruka: REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_INVALID });
      expect(JSON.stringify(result)).not.toContain(SECRET);
    });

  it('an error that is not named is the unknown outcome, in plain words, and carries none of the backend text', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: `SQL_DETAIL ${SECRET}`, details: SECRET } });
    const result = await service.submit(command({ comment: 'Sve pohvale.' }));
    expect(result).toMatchObject({ ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN' });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain('SQL_DETAIL');
  });
});

describe('the comment text is never written anywhere', () => {
  beforeEach(flagOn);
  const channels = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;

  it('no console call receives the comment on a failing submit, for any failure', async () => {
    const spies = channels.map(channel => jest.spyOn(console, channel).mockImplementation(() => {}));
    try {
      const failures: unknown[] = [
        { data: null, error: { code: '22023', message: 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', details: SECRET } },
        { data: null, error: { code: '22P05', message: SECRET, details: SECRET } },
        { data: null, error: { code: 'XX000', message: SECRET } },
        { data: { ...receipt(), comment: `${SECRET} changed` }, error: null },
        { data: { ...receipt(), comment: 5 }, error: null },
        { data: null, error: { code: 'PGRST202', message: SECRET } },
      ];
      for (const response of failures) {
        resetReviewCommentCapability(); mockRpc.mockReset(); mockRpc.mockResolvedValue(response);
        const result = await service.submit(command({ comment: SECRET }));
        expect(result.ok).toBe(false);
        expect(JSON.stringify(result)).not.toContain(SECRET);
      }
      // A failure that ends in "no comments here" caches that verdict for the session: reset it, so the next two cases reach the backend.
      resetReviewCommentCapability(); mockRpc.mockReset(); mockRpc.mockRejectedValue(new Error(SECRET));
      expect((await service.submit(command({ comment: SECRET }))).ok).toBe(false);
      mockRpc.mockReset(); mockRpc.mockResolvedValue({ data: { ...receipt(), comment: SECRET }, error: null });
      expect((await service.submit(command({ comment: SECRET }))).ok).toBe(true);
      // The same on the reads: a failing and a succeeding page, a failing and a succeeding context.
      mockRpc.mockReset(); mockRpc.mockRejectedValue(new Error(SECRET));
      expect((await service.list(P)).ok).toBe(false); expect((await service.context(D)).ok).toBe(false);
      mockRpc.mockReset(); mockRpc.mockResolvedValue({ data: { ...context2(), eligible: false, review: { ...receipt(), comment: SECRET } }, error: null });
      expect((await service.context(D)).ok).toBe(true);
      for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('Tajni');
    } finally { for (const spy of spies) spy.mockRestore(); }
  });
});

/**
 * A source file that could write the text somewhere is found by reading it, comments taken out (a comment may say what the file
 * must never do). Every file that can hold a comment is read: the data layer and the screens that draw it.
 */
const OUTPUT_CHANNELS = /\bconsole\b|AsyncStorage|localStorage|sessionStorage|SecureStore|FileSystem|analytics|Sentry|crashlytics|breadcrumb|Alert\.alert|Share\.share|Clipboard|expo-file-system|writeAsStringAsync|setItem\(/i;
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

describe('the source of everything that can hold a comment has no output channel', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path') as typeof import('path');
  const FILES = ['data/reviewCommentsClientService.ts', 'data/reviewCommentText.ts', 'data/reviewCommentGate.ts', 'ui/reviews/AgreementReviewScreen.tsx',
    'ui/reviews/AgreementReviewPresentation.tsx', 'ui/reviews/ReviewCommentField.tsx', 'ui/reviews/ReviewCommentText.tsx', 'ui/reviews/ReviewCommentsSection.tsx'];

  it('finds a channel when there is one, and ignores a comment that names it', () => {
    expect(withoutComments('console.log(text);').match(OUTPUT_CHANNELS)).not.toBeNull();
    expect(withoutComments('await AsyncStorage.setItem(key, text);').match(OUTPUT_CHANNELS)).not.toBeNull();
    expect(withoutComments('Sentry.addBreadcrumb({ message: text });').match(OUTPUT_CHANNELS)).not.toBeNull();
    expect(withoutComments('// never console.log the text\nconst a = 1; /* analytics */ const b = 2;').match(OUTPUT_CHANNELS)).toBeNull();
    expect(withoutComments("const url = 'https://example.org'; // console").match(OUTPUT_CHANNELS)).toBeNull();
  });

  it.each(FILES)('%s', file => {
    const source = withoutComments(readFileSync(join(__dirname, '..', '..', file), 'utf8'));
    expect([file, source.match(OUTPUT_CHANNELS)]).toEqual([file, null]);
  });
});

describe('the comments of a profile (rpc_list_review_comments_v1)', () => {
  beforeEach(flagOn);
  const item = (patch: Record<string, unknown> = {}) => ({ reviewId: R, rating: 4, comment: 'Sve je proteklo kako treba.', createdAt: '2026-10-02T06:49:50.123456+00:00',
    agreementId: null, author: { profileId: P2, role: 'REQUESTER', displayName: 'Ana Petrović', avatarPath: `${B}/v5/asset/photo.jpg` }, ...patch });
  const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({ profileId: P, items, hasMore: false, nextAfter: null, authoritative: true, ...extra });

  it('asks for the first page by profile with the default size and no cursor, and decodes it', async () => {
    mockRpc.mockResolvedValue({ data: page([item()]), error: null });
    const result = await service.list(P);
    expect(REVIEW_COMMENT_PAGE_SIZE).toBe(20);
    expect(mockRpc).toHaveBeenCalledWith('rpc_list_review_comments_v1', { p_profile_id: P, p_limit: 20 });
    expect(result).toEqual({ ok: true, podatak: { profileId: P, hasMore: false, nextAfter: null, items: [{ reviewId: R, rating: 4, comment: 'Sve je proteklo kako treba.',
      createdAt: '2026-10-02T06:49:50.123456+00:00', agreementId: null, author: { profileId: P2, role: 'REQUESTER', displayName: 'Ana Petrović',
        avatarPath: `${B}/v5/asset/photo.jpg` } }] } });
  });

  it('pages by keyset: the cursor the server returned goes back as p_after, unchanged, and a short page ends the list', async () => {
    const second = item({ reviewId: R2, createdAt: '2026-10-01T10:00:00+00:00' });
    const cursor = { createdAt: '2026-10-02T06:49:50.123456+00:00', reviewId: R };
    mockRpc.mockResolvedValueOnce({ data: page([item()], { hasMore: true, nextAfter: cursor }), error: null });
    const first = await service.list(P);
    expect(first).toMatchObject({ ok: true, podatak: { hasMore: true, nextAfter: cursor } });
    mockRpc.mockResolvedValueOnce({ data: page([second]), error: null });
    const next = await service.list(P, { after: cursor });
    expect(mockRpc).toHaveBeenLastCalledWith('rpc_list_review_comments_v1', { p_profile_id: P, p_limit: 20, p_after: cursor });
    expect(next).toMatchObject({ ok: true, podatak: { hasMore: false, nextAfter: null, items: [{ reviewId: R2 }] } });
  });

  it('clamps the page size to what the server allows and falls back to the default', async () => {
    mockRpc.mockResolvedValue({ data: page([]), error: null });
    await service.list(P, { limit: 500 }); await service.list(P, { limit: 0 }); await service.list(P, { limit: 1.5 }); await service.list(P, { limit: 7 });
    expect(REVIEW_COMMENT_PAGE_MAX).toBe(50);
    expect(mockRpc.mock.calls.map(call => call[1].p_limit)).toEqual([50, 20, 20, 7]);
  });

  it('the null the reader answers (a blocked pair, a closed account, another world) is "nothing here", not an error and not an empty list', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await service.list(P)).toEqual({ ok: true, podatak: null });
  });

  it('an empty list is a true empty list', async () => {
    mockRpc.mockResolvedValue({ data: page([]), error: null });
    expect(await service.list(P)).toEqual({ ok: true, podatak: { profileId: P, items: [], hasMore: false, nextAfter: null } });
  });

  it('shows the reviewer exactly as returned: no name stays no name, no avatar stays none, and the reviewed person gets the agreement id', async () => {
    mockRpc.mockResolvedValue({ data: page([item({ agreementId: D, author: { profileId: P2, role: 'WORKER', displayName: null, avatarPath: null } }),
      item({ reviewId: R2, author: { profileId: P2, role: 'WORKER', displayName: '', avatarPath: null } })]), error: null });
    const result = await service.list(P);
    expect(result).toMatchObject({ ok: true, podatak: { items: [
      { agreementId: D, author: { role: 'WORKER', displayName: null, avatarPath: null } },
      { agreementId: null, author: { displayName: null } }] } });
  });

  it('carries only what the contract names: an extra field of the reader is dropped, never passed on', async () => {
    mockRpc.mockResolvedValue({ data: { ...page([{ ...item(), authorAccountId: A, internal: 'x', author: { ...item().author, accountId: A } }]), cursorSecret: 'x' }, error: null });
    const result = await service.list(P);
    expect(result.ok && Object.keys(result.podatak!).sort()).toEqual(['hasMore', 'items', 'nextAfter', 'profileId']);
    expect(result.ok && Object.keys(result.podatak!.items[0]).sort()).toEqual(['agreementId', 'author', 'comment', 'createdAt', 'rating', 'reviewId']);
    expect(result.ok && Object.keys(result.podatak!.items[0].author).sort()).toEqual(['avatarPath', 'displayName', 'profileId', 'role']);
  });

  it.each([
    ['items that are not an array', () => page([]) && { ...page([]), items: 'x' }],
    ['another profile', () => page([item()], { profileId: P2 })],
    ['a page that is not authoritative', () => page([item()], { authoritative: false })],
    ['a missing hasMore', () => { const { hasMore, ...rest } = page([item()]); void hasMore; return rest; }],
    ['hasMore without a cursor', () => page([item()], { hasMore: true })],
    ['a cursor on the last page', () => page([item()], { nextAfter: { createdAt: item().createdAt, reviewId: R } })],
    ['a cursor that is not the last item', () => page([item()], { hasMore: true, nextAfter: { createdAt: item().createdAt, reviewId: R2 } })],
    ['a cursor with a bad time', () => page([item()], { hasMore: true, nextAfter: { createdAt: 'yesterday', reviewId: R } })],
    ['more items than the page size', () => page(Array.from({ length: 51 }, (_x, index) => item({ reviewId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` })))],
    ['the same review twice', () => page([item(), item()])],
    ['a rating of 0', () => page([item({ rating: 0 })])],
    ['a rating of 6', () => page([item({ rating: 6 })])],
    ['a fractional rating', () => page([item({ rating: 4.5 })])],
    ['a rating that is text', () => page([item({ rating: '4' })])],
    ['no comment text', () => page([item({ comment: '' })])],
    ['a comment that is not text', () => page([item({ comment: 5 })])],
    ['a comment far beyond the limit', () => page([item({ comment: 'a'.repeat(2001) })])],
    ['a review id that is not an id', () => page([item({ reviewId: 'nope' })])],
    ['a time that is not a time', () => page([item({ createdAt: 'nope' })])],
    ['an agreement id that is not an id', () => page([item({ agreementId: 'nope' })])],
    ['no author', () => page([item({ author: null })])],
    ['an author with a bad profile id', () => page([item({ author: { ...item().author, profileId: 'nope' } })])],
    ['an author role that does not exist', () => page([item({ author: { ...item().author, role: 'ADMIN' } })])],
    ['a display name that is not text', () => page([item({ author: { ...item().author, displayName: 5 } })])],
    ['an avatar path that is not text', () => page([item({ author: { ...item().author, avatarPath: 5 } })])],
    ['something that is not a page', () => 'a page'],
  ])('an unknown shape is a typed error, never a crash: %s', async (_name, data) => {
    mockRpc.mockResolvedValue({ data: data(), error: null });
    expect(await service.list(P)).toMatchObject({ ok: false, kod: 'REVIEW_COMMENTS_INVALID_RECEIPT' });
  });

  it('PGRST202 on the reader means there are no comments here: nothing, once, and the verdict is shared with the context read', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await service.list(P)).toEqual({ ok: true, podatak: null });
    expect(reviewCommentCapability()).toBe('unsupported');
    expect(await service.list(P)).toEqual({ ok: true, podatak: null });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('a failure is an error the caller can retry, in plain words and without backend text', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: `SQL ${SECRET}` } });
    const result = await service.list(P);
    expect(result).toMatchObject({ ok: false, kod: 'REVIEW_COMMENTS_READ_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'INVALID_PAGE' } });
    expect(await service.list(P)).toMatchObject({ ok: false, kod: 'INVALID_PAGE' });
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'AUTH_REQUIRED' } });
    expect(await service.list(P)).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavi se da nastaviš.' });
  });

  it('refuses an id or a cursor that is not one, before any request', async () => {
    expect(await service.list('nope')).toMatchObject({ ok: false, kod: 'REVIEW_COMMENTS_UNAVAILABLE' });
    expect(await service.list(P, { after: { createdAt: 'x', reviewId: R } })).toMatchObject({ ok: false, kod: 'REVIEW_COMMENTS_UNAVAILABLE' });
    expect(await service.list(P, { after: { createdAt: item().createdAt, reviewId: 'x' } })).toMatchObject({ ok: false, kod: 'REVIEW_COMMENTS_UNAVAILABLE' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fences a late page after an account switch, and does not read for a signed-out session', async () => {
    let resolve!: (value: unknown) => void;
    mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
    const pending = service.list(P, undefined, { accountId: A, accountRevision: 1 });
    mockSession = { user: { id: B }, accountRevision: 2 };
    resolve({ data: page([item()]), error: null });
    expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    mockRpc.mockReset(); mockSession = { user: null, accountRevision: 3 };
    expect(await service.list(P)).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('the verdict about the backend is one thing, shared by every call, and can only move to "unsupported"', () => {
  beforeEach(flagOn);

  it('a v2 context that worked and then meets a backend without the function falls back at once and stays on the legacy pair', async () => {
    mockRpc.mockResolvedValue({ data: context2(), error: null });
    expect(await service.context(D)).toMatchObject({ ok: true, podatak: { commentPolicy: policy() } });
    expect(reviewCommentCapability()).toBe('supported');
    mockRpc.mockImplementation(async (name: string) => name === 'rpc_get_my_agreement_review_v2' ? NOT_FOUND : { data: context(), error: null });
    expect(await service.context(D)).toEqual({ ok: true, podatak: context() });
    expect(reviewCommentCapability()).toBe('unsupported');
    mockRpc.mockClear();
    expect(await service.context(D)).toEqual({ ok: true, podatak: context() });
    expect(calls()).toEqual(['rpc_get_my_agreement_review']);
  });

  it('a page that was read marks the backend as supported, and the next review goes straight to v2 without a probe', async () => {
    mockRpc.mockResolvedValue({ data: { profileId: P, items: [], hasMore: false, nextAfter: null, authoritative: true }, error: null });
    expect((await service.list(P)).ok).toBe(true);
    expect(reviewCommentCapability()).toBe('supported');
    mockRpc.mockReset(); mockRpc.mockResolvedValue({ data: { ...receipt(), comment: 'Odlicno.' }, error: null });
    expect(await service.submit(command({ comment: 'Odlicno.' }))).toMatchObject({ ok: true, podatak: { comment: 'Odlicno.' } });
    expect(calls()).toEqual(['rpc_submit_agreement_review_v2']);
  });

  it('the PostgreSQL errors that arrive before the function runs are the comment\'s only when a comment was sent', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '22P02', message: 'invalid input syntax for type json', details: SECRET } });
    expect(await service.submit(command())).toMatchObject({ ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN' });
    mockRpc.mockResolvedValue({ data: null, error: { code: '22P05', message: 'unsupported Unicode escape sequence', details: SECRET } });
    expect(await service.submit(command())).toMatchObject({ ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN' });
    expect(await service.submit(command({ comment: 'Odlicno.' }))).toMatchObject({ ok: false, kod: 'REVIEW_COMMENT_INVALID' });
    // The same code on a read is a failed read, never a comment error.
    expect(await service.context(D)).toMatchObject({ ok: false, kod: 'REVIEW_READ_UNAVAILABLE' });
  });

  it('keeps every legacy sentence for what the legacy function raised before: input, tags and the closing of an account', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reviewInternals } = require('../reviewsClientService') as typeof import('../reviewsClientService');
    for (const name of ['REVIEW_INPUT_INVALID', 'REVIEW_TAGS_INVALID', 'ACCOUNT_CLOSING', 'ACCOUNT_CLOSURE_RESTRICTED']) {
      mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: name } });
      expect(await service.submit(command({ comment: 'Odlicno.' }))).toEqual({ ok: false, kod: name, poruka: reviewInternals.errors[name] });
    }
  });
});

/**
 * "Every name the five D12 functions raise maps somewhere": the names are READ from the generated function bodies, so a name the
 * server adds later is a red test until somebody decides what a person reads for it (or says it cannot reach this client).
 */
describe('every exception name of the D12 functions is mapped, or is said not to reach this client', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path') as typeof import('path');
  const body = (file: string) => readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'proofs', 'd12', 'sql', file), 'utf8');
  const raised = (file: string) => [...new Set([...body(file).matchAll(/raise exception '([A-Z_0-9]+)'/g)].map(match => match[1]))].sort();
  // What each of the three functions this client calls can answer (the submit also runs the input function and the legacy checks).
  const SUBMIT = ['AUTH_REQUIRED', 'REQUEST_ID_REUSED', 'REVIEW_ALREADY_SUBMITTED', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', 'REVIEW_COMMENT_INVALID',
    'REVIEW_COMMENT_TOO_LONG', 'REVIEW_INPUT_INVALID', 'REVIEW_NOT_ALLOWED', 'REVIEW_NOT_COMPLETED', 'REVIEW_TAGS_INVALID'];
  const CONTEXT = ['AUTH_REQUIRED', 'REVIEW_NOT_ALLOWED'];
  const LIST = ['AUTH_REQUIRED', 'INVALID_PAGE', 'PROFILE_ID_REQUIRED'];
  /** Raised by the immutability trigger and by the service-role moderation function, which no client call reaches. */
  const NOT_REACHABLE = ['REVIEW_COMMENT_IMMUTABLE', 'REVIEW_COMMENT_MODERATION_CONFLICT', 'REVIEW_COMMENT_MODERATION_INVALID', 'REVIEW_COMMENT_NOT_FOUND', 'SERVICE_ROLE_REQUIRED'];
  beforeEach(flagOn);

  it('the names in the function bodies are exactly the ones classified here', () => {
    expect([...new Set([...raised('fn_rpc_submit_agreement_review_v2.sql'), ...raised('fn_review_comment_input_v1.sql')])].sort()).toEqual([...SUBMIT].sort());
    expect(raised('fn_rpc_get_my_agreement_review_v2.sql')).toEqual(CONTEXT);
    expect(raised('fn_rpc_list_review_comments_v1.sql')).toEqual([...LIST].sort());
    expect([...raised('fn_guard_review_comment_mutation.sql'), ...raised('fn_rpc_moderate_review_comment_service_v1.sql')].sort()).toEqual([...NOT_REACHABLE].sort());
  });

  it.each(SUBMIT)('submit: %s becomes its own name and a sentence', async name => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: name } });
    const result = await service.submit(command({ comment: 'Odlicno.' }));
    expect(result).toMatchObject({ ok: false, kod: name });
    expect(!result.ok && result.poruka).toMatch(/\.$/);
    expect(!result.ok && result.poruka).not.toMatch(/[A-Z]{3,}_[A-Z]/);
  });

  it.each(CONTEXT)('context: %s becomes its own name and a sentence', async name => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: name } });
    const result = await service.context(D);
    expect(result).toMatchObject({ ok: false, kod: name });
    expect(!result.ok && result.poruka).toMatch(/\.$/);
  });

  it.each(LIST)('list: %s becomes its own name and a sentence', async name => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: name } });
    const result = await service.list(P);
    expect(result).toMatchObject({ ok: false, kod: name });
    expect(!result.ok && result.poruka).toMatch(/\.$/);
  });

  it.each(NOT_REACHABLE)('%s is not something a client call can raise, and an unexpected one is the unknown outcome with no word of the backend', async name => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: name, details: SECRET } });
    const result = await service.submit(command({ comment: 'Odlicno.' }));
    expect(result).toMatchObject({ ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN' });
    expect(JSON.stringify(result)).not.toContain(name);
  });
});
