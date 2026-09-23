import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ...props }: any) => React.createElement('List', props,
      data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';
import { Segmented } from '../../ui/system/Segmented';
const agreement = (id: string, state: DogovorProjekcija['stanje'], requester = true): DogovorProjekcija => ({
  id, verzija: 3, naslov: `Posao ${id}`, stanje: state, cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' },
  vremeTekst: '11. septembar · 10:00:00.000001–10:00:00.000009', putanjaTekst: 'Novi Sad',
  pokrivenost: { ukupno: 5, popunjeno: 3, preostalo: 2, udeo: .6 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ja', inicijali: 'JA', uloga: requester ? 'narucilac' : 'uskocer', mesta: requester ? null : 3, viSte: true, telefon: null },
    { id: 'other', profilId: null, ime: 'Druga osoba', inicijali: 'DO', uloga: requester ? 'uskocer' : 'narucilac', mesta: requester ? 3 : null, viSte: false, telefon: 'PRIVATE_PHONE' }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: 'PRIVATE_PHONE', lokacijaPostoji: true, tacnaLokacija: 'PRIVATE_ADDRESS', emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null },
});
let rows: DogovorProjekcija[], loading: boolean, error: boolean, tree: ReactTestRenderer;
const open = jest.fn(), refresh = jest.fn(), tasks = jest.fn();
function Screen() {
  const [section, setSection] = useState<AgreementCollectionSection>('active'), [confirmationOnly, setConfirmationOnly] = useState(false);
  return <AgreementCollectionPresentation items={rows} loading={loading} error={error}
    section={section} confirmationOnly={confirmationOnly} onSection={setSection} onConfirmationOnly={setConfirmationOnly}
    onOpen={open} onRefresh={refresh} onHome={tasks} onCalendar={() => {}} onProfile={() => {}} />;
}
const render = async () => act(async () => { tree = create(<Screen />); });
const tap = async (label: string) => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
const titles = () => tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel).filter(label => label?.startsWith('Otvori Dogovor'));
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {}); loading = error = false;
  rows = [agreement('confirmed', 'CONFIRMED'), agreement('waiting-mine', 'AWAITING_REQUESTER'), agreement('waiting-other', 'AWAITING_REQUESTER', false), agreement('done', 'COMPLETED'), agreement('cancelled', 'CANCELLED')];
  open.mockClear(); refresh.mockClear(); tasks.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });
test('active and history preserve both actual participant roles; attention means my requester confirmation', async () => {
  await render(); expect(titles()).toHaveLength(3); // One list holds both sides of one account, and each row says which side from its own participants.
  // The row carries the other person's photo and name, so the sentence beside it is about THEM,
  // third person — the same words the Dogovor itself uses in AgreementPeople. It used to read
  // "Milos SLJIVIC   Uskočio si": their name, then a sentence about me, with nothing to mark that
  // the subject had changed. Početna keeps the first person because it puts the relation first.
  expect(texts()).toContain('Objavio zadatak'); expect(texts()).toContain('Uskočio na tvoj zadatak');
  expect(texts()).not.toContain('Uskočio si'); expect(texts()).not.toContain('Objavio si');
  await tap('Čeka moju potvrdu'); expect(titles()).toEqual(['Otvori Dogovor Posao waiting-mine']);
  await tap('Čeka moju potvrdu'); await tap('Istorija'); expect(titles()).toEqual(['Otvori Dogovor Posao done', 'Otvori Dogovor Posao cancelled']);
  await tap('Svi'); expect(titles()).toHaveLength(5);
});
test('reuses full accepted amount, precise interval and coverage, without exposing contact or exact address', async () => {
  rows = [agreement('remote', 'CONFIRMED')]; rows[0].rezim = 'DALJINSKI'; rows[0].putanjaTekst = 'REMOTE_MUST_HIDE_LOCATION';
  // V41 anatomy: the accepted term is the day with the time under it, split where the term itself says " · ",
  // and the interval keeps every microsecond it was agreed with.
  await render(); const text = texts(); expect(text).toContain('11. septembar 10:00:00.000001–10:00:00.000009'); expect(text).toContain('2.500 RSD'); expect(text).toContain('3'); expect(text).toContain('osobe');
  expect(text).toContain('dogovoreno ukupno');
  expect(text).toContain('Na daljinu'); expect(text).not.toMatch(/PRIVATE_|REMOTE_MUST_HIDE_LOCATION/);
  await tap('Otvori Dogovor Posao remote'); expect(open).toHaveBeenCalledWith(rows[0]);
});
test.each(['loading', 'error'])('%s hides stale private rows and error retry uses actual callback', async state => {
  loading = state === 'loading'; error = state === 'error'; await render(); expect(titles()).toEqual([]);
  if (error) { await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo' }).props.onPress()); expect(refresh).toHaveBeenCalledTimes(1); }
});
test('empty history still offers a real task route, with no invented review or unread controls', async () => {
  rows = []; await render(); await tap('Istorija'); expect(texts()).toContain('Još nemaš Dogovor');
  await act(async () => tree.root.findByProps({ label: 'Idi na Početnu' }).props.onPress()); expect(tasks).toHaveBeenCalledTimes(1);
  expect(texts()).not.toMatch(/Oceni|nepročitan/);
});

// Owner, 2026-09-23: right after a completion the default tab said "Nema Dogovora u ovom prikazu" while the
// Dogovor waited for the person's rating one tab away.
test('a finished Dogovor that still waits for my rating stays among the active ones and says so; a rated one is history', async () => {
  rows = [{ ...agreement('done-unrated', 'COMPLETED'), ocenaMoguca: true }, agreement('done', 'COMPLETED')];
  await render(); expect(titles()).toEqual(['Otvori Dogovor Posao done-unrated']); expect(texts()).toContain('Čeka tvoju ocenu');
  expect(texts()).toContain('Oceni saradnju');
  await tap('Istorija'); expect(titles()).toEqual(['Otvori Dogovor Posao done']); expect(texts()).not.toContain('Čeka tvoju ocenu');
});

// V41 (owner, 2026-09-23): the underlined tabs carry their counts, one row counts what is shown, and a warm strip
// across a card's foot appears only when that Dogovor waits for me.
const card = (title: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === `Otvori Dogovor ${title}`)!;
const cardTexts = (title: string) => card(title).findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
test('each set carries its count once the read settles, an empty one none, and the row counts what is shown', async () => {
  await render();
  expect(tree.root.findByType(Segmented).props.appearance).toBe('underline');
  expect(tree.root.findByType(Segmented).props.options.map((option: { key: string; badge?: number }) => [option.key, option.badge]))
    .toEqual([['active', 3], ['history', 2], ['all', 5]]);
  expect(texts()).toContain('3 Dogovora');
  rows = rows.filter(row => row.stanje !== 'COMPLETED' && row.stanje !== 'CANCELLED');
  await act(async () => tree.update(<Screen />));
  expect(tree.root.findByType(Segmented).props.options.map((option: { badge?: number }) => option.badge)).toEqual([3, undefined, 3]);
  await act(async () => tree.unmount()); loading = true; await render();
  expect(tree.root.findByType(Segmented).props.options.every((option: { badge?: number }) => option.badge === undefined)).toBe(true);
});
test('only a Dogovor that waits for me carries the strip, in the order the Dogovor itself leads with', async () => {
  rows = [{ ...agreement('change', 'CONFIRMED'), izmenaCeka: { predlogId: 'p1', mojPredlog: false } },
    { ...agreement('mine', 'CONFIRMED'), izmenaCeka: { predlogId: 'p2', mojPredlog: true } },
    agreement('confirm', 'AWAITING_REQUESTER'), { ...agreement('blocked', 'AWAITING_REQUESTER'), izmenaCeka: { predlogId: 'p3', mojPredlog: true } },
    agreement('worker-waits', 'AWAITING_REQUESTER', false), agreement('plain', 'CONFIRMED')];
  await render();
  expect(cardTexts('Posao change')).toContain('Odgovori na predlog izmene'); expect(card('Posao change').props.accessibilityHint).toBe('Odgovori na predlog izmene. Prihvaćeni uslovi važe dok ne odgovoriš.');
  // My own proposal waits for the other side: said quietly, never as my task.
  expect(cardTexts('Posao mine')).toContain('Tvoja izmena čeka odgovor'); expect(card('Posao mine').props.accessibilityHint).toBeUndefined();
  expect(cardTexts('Posao confirm')).toContain('Potvrdi završetak'); expect(cardTexts('Posao confirm')).toContain('Čeka se potvrda završetka');
  // A pending change blocks completion, so no strip asks for a confirmation the server would refuse.
  expect(cardTexts('Posao blocked')).not.toContain('Potvrdi završetak');
  expect(cardTexts('Posao worker-waits')).toContain('Čeka se potvrda završetka'); expect(card('Posao worker-waits').props.accessibilityHint).toBeUndefined();
  expect(card('Posao plain').props.accessibilityHint).toBeUndefined(); expect(cardTexts('Posao plain')).not.toMatch(/Potvrdi|Odgovori|Oceni|Čeka/);
});
test('a term that is missing stays one sentence and a missing place or amount is said in words, never as a value', async () => {
  rows = [{ ...agreement('bare', 'CONFIRMED'), vremeTekst: 'Termin nije potvrđen', putanjaTekst: '', cena: { iznos: Number.NaN, valuta: 'RSD', prikaz: '' } }];
  await render(); const text = cardTexts('Posao bare');
  expect(text).toContain('Termin nije potvrđen'); expect(text).toContain('Mesto nije navedeno'); expect(text).toContain('Iznos nije sačuvan');
  expect(text).not.toContain('dogovoreno ukupno');
});
