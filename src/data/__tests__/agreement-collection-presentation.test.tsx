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
import { AgreementPeople, AgreementPersonBar } from '../../ui/v2/AgreementPresentation';
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
  expect(texts()).toContain('Traži pomoć'); expect(texts()).toContain('Uskače na tvoj zadatak');
  expect(texts()).not.toContain('Uskočio si'); expect(texts()).not.toContain('Objavio si');
  await tap('Čeka moju potvrdu'); expect(titles()).toEqual(['Otvori Dogovor Posao waiting-mine']);
  await tap('Čeka moju potvrdu'); await tap('Istorija'); expect(titles()).toEqual(['Otvori Dogovor Posao done', 'Otvori Dogovor Posao cancelled']);
  await tap('Svi'); expect(titles()).toHaveLength(5);
});
// Round 2c (verifier vf, must 2): since 2026-09-24 a missing name reaches the screens as an empty string. The card wrote
// `inicijali ?? '—'` (which lets '' through) and the Dogovor printed it bare, so both drew an empty green disc. The one
// Avatar draws the person instead, on the card, in the Dogovor's bar and in its people rows.
test('a person without a name gets the drawn person, never an empty disc, on the card, the bar and the people rows', async () => {
  const nameless = agreement('nameless', 'CONFIRMED');
  nameless.ucesnici = nameless.ucesnici.map(person => ({ ...person, inicijali: '' }));
  const discs = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.initials !== undefined && node.props.size !== undefined);
  const people = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.kind === 'person');
  const emptyLetters = () => tree.root.findAllByType('T' as React.ElementType).filter(node => node.children.length === 0 || node.children.every(child => child === ''));
  rows = [nameless]; await render();
  expect(discs().map(node => [node.props.initials, node.props.size])).toEqual([['', 40]]);
  expect(people()).toHaveLength(1); expect(emptyLetters()).toHaveLength(0);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<AgreementPersonBar person={nameless.ucesnici[1]} state="CONFIRMED" back={() => {}} />); });
  expect(discs().map(node => [node.props.initials, node.props.size])).toEqual([['', 40]]); expect(people()).toHaveLength(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<AgreementPeople agreement={nameless} />); });
  expect(discs().map(node => [node.props.initials, node.props.size])).toEqual([['', 56], ['', 56]]); expect(people()).toHaveLength(2);
  expect(emptyLetters()).toHaveLength(0);
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

// Round-1 critique A12: the header is profile · mark · bell on all three tabs; the calendar is a view of these Dogovori,
// so it ends the Aktivni/Istorija tab row as a quiet icon with the same spoken label.
test('the header is profile, mark and bell only, and the calendar ends the tab row under the same label', async () => {
  const calendar = jest.fn();
  await act(async () => { tree = create(<AgreementCollectionPresentation items={rows} loading={false} error={false} section="active"
    confirmationOnly={false} onSection={() => {}} onConfirmationOnly={() => {}} onOpen={open} onRefresh={refresh} onHome={tasks}
    onCalendar={calendar} onProfile={() => {}} />); });
  const { ScreenChrome } = require('../../ui/system/ScreenChrome');
  const bar = tree.root.findByType(ScreenChrome);
  expect(bar.props).toMatchObject({ variant: 'root', title: 'Dogovori' });
  expect(bar.props.right).toBeUndefined();
  expect(bar.findAll(node => node.props.accessibilityLabel === 'Kalendar obaveza')).toHaveLength(0);
  // The calendar stands in the same row as the underlined tabs, after them; the tabs may slide sideways beside it on a
  // narrow screen, so they sit in their own horizontal scroller.
  const scroller = tree.root.findByType(Segmented).parent!;
  expect(scroller.type).toBe('ScrollView');
  expect(scroller.props.horizontal).toBe(true);
  const tabRow = scroller.parent!;
  const entry = tabRow.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === 'Kalendar obaveza');
  expect(entry).toHaveLength(1);
  expect(tabRow.children.map(child => typeof child === 'string' ? child : child === scroller ? 'tabs' : child.props.label))
    .toEqual(['tabs', 'Kalendar obaveza']);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Kalendar obaveza' }).filter(node => node.type === ('Press' as React.ElementType))).toHaveLength(1);
  await act(async () => entry[0].props.onPress());
  expect(calendar).toHaveBeenCalledTimes(1);
});

// Review r3 item 7: the filtered-empty view's one way forward must clear BOTH the set and the confirmation filter,
// or "Prikaži sve Dogovore" could land on another empty view.
test('"Prikaži sve Dogovore" shows every set and turns the confirmation filter off', async () => {
  const onSection = jest.fn(), onConfirmationOnly = jest.fn();
  rows = [agreement('done', 'COMPLETED')];
  await act(async () => { tree = create(<AgreementCollectionPresentation items={rows} loading={false} error={false} section="active"
    confirmationOnly onSection={onSection} onConfirmationOnly={onConfirmationOnly} onOpen={open} onRefresh={refresh} onHome={tasks}
    onCalendar={() => {}} onProfile={() => {}} />); });
  expect(texts()).toContain('Nema Dogovora u ovom prikazu');
  await act(async () => tree.root.findByProps({ label: 'Prikaži sve Dogovore' }).props.onPress());
  expect(onSection).toHaveBeenCalledTimes(1); expect(onSection).toHaveBeenCalledWith('all');
  expect(onConfirmationOnly).toHaveBeenCalledTimes(1); expect(onConfirmationOnly).toHaveBeenCalledWith(false);
  expect(refresh).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  // Through the real screen state the same press leaves a list, not another empty view.
  await act(async () => tree.unmount());
  await render();
  await act(async () => tree.root.findByProps({ label: 'Prikaži sve Dogovore' }).props.onPress());
  expect(titles()).toEqual(['Otvori Dogovor Posao done']);
});
