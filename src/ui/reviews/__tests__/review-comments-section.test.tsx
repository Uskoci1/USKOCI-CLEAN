import React, { type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockList = jest.fn();
const mockAccount = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let mockRevision = 1;
jest.mock('../../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../../../data/reviewCommentsClientService', () => ({ reviewCommentsClientService: { list: (...args: unknown[]) => mockList(...args) } }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
import { ReviewCommentsSection } from '../ReviewCommentsSection';
import { vreme } from '../../../lib/vreme';

/**
 * The "Komentari" section of a profile (D12): what the reader returns, drawn as true states. Loading is a still bar, no comments
 * yet says that nobody wrote one, an error offers a retry and is never an empty list, the reader's null (a blocked pair, a
 * closed account, another world) is nothing at all, and a comment is plain, bounded text under the reviewer exactly as returned.
 */
const P = '99999999-9999-4999-8999-999999999999', P2 = '88888888-8888-4888-8888-888888888888', R1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const R2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff', R3 = '77777777-7777-4777-8777-777777777777', AUTHOR = '66666666-6666-4666-8666-666666666666';
const SECRET = 'Tajni komentar 12345 qwertz';
const item = (patch: Record<string, unknown> = {}) => ({ reviewId: R1, rating: 4, comment: 'Sve je proteklo kako treba.', createdAt: '2026-10-02T06:49:50.123456+00:00', agreementId: null,
  author: { profileId: AUTHOR, role: 'REQUESTER', displayName: 'Ana Petrović', avatarPath: null }, ...patch });
const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({ ok: true, podatak: { profileId: P, items, hasMore: false, nextAfter: null, ...extra } });
const unavailable = { ok: false, kod: 'REVIEW_COMMENTS_READ_UNAVAILABLE', poruka: 'Podaci trenutno nisu dostupni. Proveri vezu i pokušaj ponovo.' };
const cursor = (id: string) => ({ createdAt: '2026-10-01T10:00:00+00:00', reviewId: id });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const byLabel = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const labels = () => tree.root.findAll(node => typeof node.props?.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel as string);
const photo = (profileId: string, size: number, fallback: ReactNode) => React.createElement('Photo', { profileId, size }, fallback);
const draw = async (profileId = P, withPhoto = true) => {
  await act(async () => { tree = create(<ReviewCommentsSection profileId={profileId} photo={withPhoto ? photo : undefined} />); });
};
const settle = async () => { await act(async () => {}); };

beforeEach(() => { mockList.mockReset(); mockRevision = 1; });
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the true states of the section', () => {
  it('loading is a still bar under the title, never a spinner, and never "nobody wrote one"', async () => {
    let finish!: (value: unknown) => void;
    mockList.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await draw();
    expect(texts()).toContain('Komentari');
    expect(byLabel('Učitavamo komentare').props.accessibilityRole).toBe('progressbar');
    expect(texts()).not.toContain('Još niko nije napisao komentar.');
    expect(tree.root.findAll(node => String(node.type) === 'ActivityIndicator')).toHaveLength(0);
    await act(async () => finish(page([item()])));
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Učitavamo komentare' })).toHaveLength(0);
  });

  it('no comments yet says that nobody wrote one', async () => {
    mockList.mockResolvedValue(page([]));
    await draw();
    expect(texts()).toContain('Komentari'); expect(texts()).toContain('Još niko nije napisao komentar.');
    expect(labels()).not.toContain('Prikaži još');
  });

  it('the reader\'s null is nothing: no title, no error, no empty text', async () => {
    mockList.mockResolvedValue({ ok: true, podatak: null });
    await draw();
    expect(tree.toJSON()).toBeNull();
  });

  it('an error says so, is not an empty list, and a retry reads again', async () => {
    mockList.mockResolvedValueOnce(unavailable).mockResolvedValueOnce(page([item()]));
    await draw();
    expect(texts()).toContain('Komentari trenutno nisu dostupni.');
    expect(texts()).not.toContain('Još niko nije napisao komentar.');
    // The one action of the app (V2Action), quiet: the section adds no control of its own to read the page again.
    const retry = tree.root.findByProps({ label: 'Pokušaj ponovo' });
    expect(retry.props.kind).toBe('quiet');
    await act(async () => retry.props.onPress());
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(texts()).toContain('Sve je proteklo kako treba.');
    expect(texts()).not.toContain('Komentari trenutno nisu dostupni.');
  });

  it('an exception is the same error, not a crash', async () => {
    mockList.mockRejectedValue(new Error('Network request failed'));
    await draw();
    expect(texts()).toContain('Komentari trenutno nisu dostupni.');
  });
});

describe('a comment', () => {
  it('shows the stars, the text, the date in the one format and the reviewer\'s name, exactly as returned', async () => {
    mockList.mockResolvedValue(page([item()]));
    await draw();
    expect(texts()).toContain('Ana Petrović');
    expect(texts()).toContain('Sve je proteklo kako treba.');
    expect(texts()).toContain(vreme('2026-10-02T06:49:50.123456+00:00'));
    expect(texts()).toContain('4 od 5');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ocena 4 od 5' }).length).toBeGreaterThan(0);
    expect(tree.root.findAll(node => node.props?.kind === 'star').length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ accessibilityRole: 'header' }).map(node => node.children[0])).toContain('Komentari');
  });

  it('a reviewer with no name has no invented name and no invented letters', async () => {
    mockList.mockResolvedValue(page([item({ author: { profileId: AUTHOR, role: 'WORKER', displayName: null, avatarPath: null } })]));
    await draw();
    expect(texts()).toContain('Ime nije dostupno');
    expect(tree.root.findAll(node => node.props?.kind === 'person').length).toBeGreaterThan(0);
    expect(texts().filter(text => /^[A-ZŠĐČĆŽ]{1,2}$/.test(text))).toEqual([]);
  });

  it('a reviewer with a name gets the letters of that name, and nothing else', async () => {
    mockList.mockResolvedValue(page([item()]));
    await draw(P, false);
    expect(texts()).toContain('AP');
  });

  it('draws the reviewer\'s photo only when the reader returned an avatar path, with the reviewer\'s profile and the letters as the stand-in', async () => {
    mockList.mockResolvedValue(page([
      item({ author: { profileId: AUTHOR, role: 'REQUESTER', displayName: 'Ana Petrović', avatarPath: `${mockAccount}/v5/asset/photo.jpg` } }),
      item({ reviewId: R2, author: { profileId: P2, role: 'WORKER', displayName: 'Marko Jović', avatarPath: null } })]));
    await draw();
    const photos = tree.root.findAll(node => String(node.type) === 'Photo');
    expect(photos).toHaveLength(1);
    expect(photos[0].props).toMatchObject({ profileId: AUTHOR, size: 40 });
    // The path itself is never handed on (its first segment is an account id): only the profile, the size and the stand-in are. The stand-in is an element (circular for JSON), so it is taken out.
    const { children, ...handedOn } = photos[0].props;
    expect(children).toBeDefined();
    expect(Object.keys(handedOn).sort()).toEqual(['profileId', 'size']);
    expect(JSON.stringify(handedOn)).not.toContain('v5/asset');
  });

  it('keeps the order the reader returned', async () => {
    mockList.mockResolvedValue(page([item({ comment: 'Prvi.' }), item({ reviewId: R2, comment: 'Drugi.' }), item({ reviewId: R3, comment: 'Treći.' })]));
    await draw();
    expect(texts().filter(text => ['Prvi.', 'Drugi.', 'Treći.'].includes(text))).toEqual(['Prvi.', 'Drugi.', 'Treći.']);
  });

  it('is drawn as plain text: clipped when long with a control to open it, never interpreted', async () => {
    const raw = `${'Dugačak komentar sa https://primer.rs i **zvezdicama**. '.repeat(8)}`;
    mockList.mockResolvedValue(page([item({ comment: raw })]));
    await draw();
    const node = tree.root.findAll(candidate => String(candidate.type) === 'T' && candidate.children[0] === raw)[0];
    expect(node.props).toMatchObject({ numberOfLines: 5, selectable: false, dataDetectorType: 'none' });
    await act(async () => byLabel('Prikaži ceo komentar').props.onPress());
    expect(node.props.numberOfLines).toBeUndefined();
  });

  it('offers no report, block or moderation control (there is no existing entry point for a review to join)', async () => {
    mockList.mockResolvedValue(page([item({ agreementId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })], { hasMore: true, nextAfter: cursor(R1) }));
    await draw();
    expect(labels().filter(label => /prijav|blokir|report|zloupotreb|moderi|ukloni/i.test(label))).toEqual([]);
    expect(texts().filter(text => /prijav|blokir|report|zloupotreb|moderi/i.test(text))).toEqual([]);
  });
});

describe('paging by keyset', () => {
  it('asks for the first page with the page size of 20, offers "Prikaži još" only while there is more, and appends the next page by the cursor', async () => {
    mockList.mockResolvedValueOnce(page([item()], { hasMore: true, nextAfter: cursor(R1) }))
      .mockResolvedValueOnce(page([item({ reviewId: R2, comment: 'Drugi.' })]));
    await draw();
    expect(mockList.mock.calls[0][0]).toBe(P);
    expect(mockList.mock.calls[0][1]).toEqual({ limit: 20 });
    expect(mockList.mock.calls[0][2]).toEqual({ accountId: mockAccount, accountRevision: 1 });
    const more = tree.root.findByProps({ label: 'Prikaži još' });
    expect(more.props.loading).toBeFalsy();
    await act(async () => more.props.onPress());
    expect(mockList.mock.calls[1][1]).toEqual({ after: cursor(R1), limit: 20 });
    expect(texts()).toEqual(expect.arrayContaining(['Sve je proteklo kako treba.', 'Drugi.']));
    expect(tree.root.findAllByProps({ label: 'Prikaži još' })).toHaveLength(0);
  });

  it('one press asks once, even when it is pressed twice while it reads', async () => {
    let finish!: (value: unknown) => void;
    mockList.mockResolvedValueOnce(page([item()], { hasMore: true, nextAfter: cursor(R1) })).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await draw();
    const press = tree.root.findByProps({ label: 'Prikaži još' }).props.onPress;
    await act(async () => { press(); press(); });
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(tree.root.findByProps({ label: 'Prikaži još' }).props.loading).toBe(true);
    await act(async () => finish(page([item({ reviewId: R2, comment: 'Drugi.' })])));
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it('a failed next page keeps what is shown, says so, and retries the same page without a duplicate', async () => {
    mockList.mockResolvedValueOnce(page([item()], { hasMore: true, nextAfter: cursor(R1) })).mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(page([item({ reviewId: R2, comment: 'Drugi.' })]));
    await draw();
    await act(async () => tree.root.findByProps({ label: 'Prikaži još' }).props.onPress());
    expect(texts()).toContain('Sve je proteklo kako treba.');
    expect(texts()).toContain('Još komentara trenutno nije učitano.');
    expect(tree.root.findByProps({ label: 'Pokušaj ponovo' })).toBeDefined();
    await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo' }).props.onPress());
    expect(mockList.mock.calls[2][1]).toEqual({ after: cursor(R1), limit: 20 });
    expect(texts().filter(text => text === 'Sve je proteklo kako treba.')).toHaveLength(1);
    expect(texts()).toContain('Drugi.');
    expect(texts()).not.toContain('Još komentara trenutno nije učitano.');
  });

  it('a review that came twice is shown once', async () => {
    mockList.mockResolvedValueOnce(page([item()], { hasMore: true, nextAfter: cursor(R1) })).mockResolvedValueOnce(page([item(), item({ reviewId: R2, comment: 'Drugi.' })]));
    await draw();
    await act(async () => tree.root.findByProps({ label: 'Prikaži još' }).props.onPress());
    expect(texts().filter(text => text === 'Sve je proteklo kako treba.')).toHaveLength(1);
  });

  it('a later authoritative null withdraws earlier comments and offers no more', async () => {
    mockList.mockResolvedValueOnce(page([item()], { hasMore: true, nextAfter: cursor(R1) })).mockResolvedValueOnce({ ok: true, podatak: null });
    await draw();
    expect(texts()).toContain('Sve je proteklo kako treba.');
    await act(async () => tree.root.findByProps({ label: 'Prikaži još' }).props.onPress());
    expect(texts()).not.toContain('Sve je proteklo kako treba.');
    expect(tree.root.findAllByProps({ label: 'Prikaži još' })).toHaveLength(0);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('a profile and an account of its own', () => {
  it('another profile reads again, and a late answer for the first one is not shown', async () => {
    let late!: (value: unknown) => void;
    mockList.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })).mockResolvedValueOnce(page([item({ comment: 'Drugi profil.' })], { profileId: P2 }));
    await draw(P);
    await act(async () => tree.update(<ReviewCommentsSection profileId={P2} />));
    expect(mockList.mock.calls[1][0]).toBe(P2);
    await act(async () => late(page([item({ comment: 'Prvi profil.' })])));
    expect(texts()).toContain('Drugi profil.');
    expect(texts()).not.toContain('Prvi profil.');
  });

  it('a late answer after the section is gone changes nothing and warns about nothing', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let late!: (value: unknown) => void;
      mockList.mockImplementation(() => new Promise(resolve => { late = resolve; }));
      await draw();
      await act(async () => tree.unmount());
      await act(async () => late(page([item()])));
      expect(errors).not.toHaveBeenCalled();
    } finally { errors.mockRestore(); }
  });

  it('what was read for another account or profile is never drawn for this one, not even while the new read is pending', async () => {
    mockList.mockResolvedValueOnce(page([item({ comment: 'Samo za prvi nalog.' })]));
    await draw();
    expect(texts()).toContain('Samo za prvi nalog.');
    mockList.mockImplementation(() => new Promise(() => {}));
    mockRevision = 2;
    await act(async () => tree.update(<ReviewCommentsSection profileId={P} />));
    expect(texts()).not.toContain('Samo za prvi nalog.');
    expect(byLabel('Učitavamo komentare').props.accessibilityRole).toBe('progressbar');
    await act(async () => tree.update(<ReviewCommentsSection profileId={P2} />));
    expect(texts()).not.toContain('Samo za prvi nalog.');
  });

  it('another account reads again as that account', async () => {
    mockList.mockResolvedValue(page([item()]));
    await draw();
    mockRevision = 2;
    await act(async () => tree.update(<ReviewCommentsSection profileId={P} />));
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList.mock.calls[1][2]).toEqual({ accountId: mockAccount, accountRevision: 2 });
  });
});

describe('the comment text goes nowhere but the screen', () => {
  it('no console call receives it, on success or on failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(channel => jest.spyOn(console, channel).mockImplementation(() => {}));
    try {
      mockList.mockResolvedValueOnce(page([item({ comment: SECRET })], { hasMore: true, nextAfter: cursor(R1) })).mockResolvedValueOnce(unavailable);
      await draw(); await settle();
      await act(async () => tree.root.findByProps({ label: 'Prikaži još' }).props.onPress());
      mockList.mockRejectedValueOnce(new Error(SECRET));
      await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo' }).props.onPress());
      for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('Tajni');
    } finally { for (const spy of spies) spy.mockRestore(); }
  });
});
