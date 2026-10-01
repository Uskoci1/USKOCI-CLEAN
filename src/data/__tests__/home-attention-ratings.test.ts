import type { DogovorProjekcija } from '../../contracts/projections';
import { decodeHomeAttention } from '../homeAttentionClientService';
import { composeHome, type HomeAttentionPreview, type HomeReads, type HomeSection } from '../homeSnapshot';

/**
 * EX-04 S3 (RC-03, A01): Početna's number of Dogovori that wait for my rating is the server's own aggregate in the existing `rpc_home_attention` answer (`ratings.due`, and the id
 * when exactly one waits). It does not depend on how many Dogovori there are, or on any list being read, so a failed Dogovori read withholds the Dogovori and never the number.
 * An older server has no aggregate, and then Početna counts from the Dogovori read exactly as before.
 */
const ID = (n: number) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, '0')}`;
const wire = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, asOf: '2026-10-01T08:00:00.123456+00:00', items: [],
  counts: { attention: 0, attentionMore: 0, activeAgreements: 0, agreementsMore: 0, ownActiveTasks: 0, activeApplications: 0, activities: 0, activitiesMore: 0 }, ...extra });

describe('the rating aggregate of rpc_home_attention', () => {
  it('is exact when it is there: a count, and the id exactly when the count is one', () => {
    expect(decodeHomeAttention(wire({ ratings: { due: 0, dueAgreementId: null } }))?.ratings).toEqual({ due: 0, agreementId: null });
    expect(decodeHomeAttention(wire({ ratings: { due: 1, dueAgreementId: ID(7) } }))?.ratings).toEqual({ due: 1, agreementId: ID(7) });
    expect(decodeHomeAttention(wire({ ratings: { due: 12, dueAgreementId: null } }))?.ratings).toEqual({ due: 12, agreementId: null });
  });
  it('is absent from an older server: the preview is the same as ever and carries no aggregate', () => {
    const preview = decodeHomeAttention(wire());
    expect(preview).not.toBeNull(); expect(preview).not.toHaveProperty('ratings'); expect(preview).toMatchObject({ rows: [], more: 0 });
  });
  it.each([
    ['a missing count', { dueAgreementId: null }], ['a negative count', { due: -1, dueAgreementId: null }], ['a fractional count', { due: 1.5, dueAgreementId: null }],
    ['a string count', { due: '2', dueAgreementId: null }], ['one due without its id', { due: 1, dueAgreementId: null }], ['one due with a malformed id', { due: 1, dueAgreementId: 'x' }],
    ['several due with an id', { due: 2, dueAgreementId: ID(1) }], ['none due with an id', { due: 0, dueAgreementId: ID(1) }], ['an id that was left out', { due: 0 }],
  ])('refuses %s: an aggregate that does not add up is unavailable, never a guess', (_name, ratings) => {
    expect(decodeHomeAttention(wire({ ratings }))).toBeNull();
  });
  it.each([['null', null], ['an array', []], ['a string', 'x']])('refuses an aggregate that is %s', (_name, ratings) => { expect(decodeHomeAttention(wire({ ratings }))).toBeNull(); });
  it('does not change anything else the preview says: the same reasons, the same counts', () => {
    expect(decodeHomeAttention(wire({ ratings: { due: 2, dueAgreementId: null } }))).toMatchObject({ rows: [], more: 0, asOf: '2026-10-01T08:00:00.123456+00:00' });
  });
});

describe('Početna composes the number from the aggregate when the server gives it', () => {
  const agreement = (n: number, patch: Partial<DogovorProjekcija> = {}) => ({ id: ID(n), naslov: `Posao ${n}`, stanje: 'COMPLETED', vremeTekst: '', ucesnici: [],
    ocenaMoguca: false, stanjeProvereOcene: 'NOT_DUE', ...patch }) as unknown as DogovorProjekcija;
  const known = <T,>(value: T): HomeSection<T> => ({ kind: 'known', value });
  const reads = (agreements: HomeSection<DogovorProjekcija[]>): HomeReads => ({ needs: known([]), applications: known([]), agreements });
  const attention = (ratings?: HomeAttentionPreview['ratings']): HomeSection<HomeAttentionPreview> => known({ rows: [], more: 0, asOf: '2026-10-01T08:00:00+00:00', ...(ratings ? { ratings } : {}) });

  it('the server\'s count and id win, whatever the Dogovori read says', () => {
    const home = composeHome(reads(known([agreement(1, { ocenaMoguca: true, stanjeProvereOcene: 'DUE' })])), attention({ due: 3, agreementId: null }));
    expect(home).toMatchObject({ ratingsDue: 3, ratingDueAgreementId: null });
    expect(composeHome(reads(known([])), attention({ due: 1, agreementId: ID(9) }))).toMatchObject({ ratingsDue: 1, ratingDueAgreementId: ID(9) });
    expect(composeHome(reads(known([agreement(1, { ocenaMoguca: true, stanjeProvereOcene: 'DUE' })])), attention({ due: 0, agreementId: null }))).toMatchObject({ ratingsDue: 0, ratingDueAgreementId: null });
  });
  it('a Dogovori read that failed withholds the Dogovori, never the number of ratings', () => {
    const home = composeHome(reads({ kind: 'unavailable' }), attention({ due: 2, agreementId: null }));
    expect(home.ratingsDue).toBe(2); expect(home.agreements).toEqual({ kind: 'unavailable' }); expect(home.partial).toBe(true);
  });
  it('rows whose own check is unavailable no longer make the number unknown when the server has said it', () => {
    const rows = [agreement(1, { ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' })];
    expect(composeHome(reads(known(rows)), attention({ due: 1, agreementId: ID(1) }))).toMatchObject({ ratingsDue: 1, ratingDueAgreementId: ID(1), partial: false });
  });
  it('an older server (no aggregate) is counted from the Dogovori read exactly as before, and an unavailable check is unknown, never zero', () => {
    const due = [agreement(1, { ocenaMoguca: true, stanjeProvereOcene: 'DUE' }), agreement(2)];
    expect(composeHome(reads(known(due)), attention())).toMatchObject({ ratingsDue: 1, ratingDueAgreementId: ID(1) });
    expect(composeHome(reads(known([agreement(1, { stanjeProvereOcene: 'UNAVAILABLE' })])), attention())).toMatchObject({ ratingsDue: null, ratingDueAgreementId: null, partial: true });
  });
  it('an attention read that failed leaves the number to the Dogovori read, and no read at all is unknown', () => {
    expect(composeHome(reads(known([agreement(1, { ocenaMoguca: true, stanjeProvereOcene: 'DUE' })])), { kind: 'unavailable' })).toMatchObject({ ratingsDue: 1 });
    expect(composeHome(reads({ kind: 'unavailable' }), { kind: 'unavailable' })).toMatchObject({ ratingsDue: null, ratingDueAgreementId: null });
  });
  it('without any server attention (the test-source adapter) the number is the list\'s, as before', () => {
    expect(composeHome(reads(known([agreement(1, { ocenaMoguca: true, stanjeProvereOcene: 'DUE' })])))).toMatchObject({ ratingsDue: 1, ratingDueAgreementId: ID(1) });
  });
});
