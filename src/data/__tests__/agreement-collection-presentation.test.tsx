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
jest.mock('phosphor-react-native', () => ({ CalendarBlank: 'Icon', Check: 'Icon', User: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';
const agreement = (id: string, state: DogovorProjekcija['stanje'], requester = true): DogovorProjekcija => ({
  id, verzija: 3, naslov: `Posao ${id}`, stanje: state, cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' },
  vremeTekst: '11. septembar · 10:00:00.000001–10:00:00.000009', putanjaTekst: 'Novi Sad',
  pokrivenost: { ukupno: 5, popunjeno: 3, preostalo: 2, udeo: .6 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'me', ime: 'Ja', inicijali: 'JA', uloga: requester ? 'narucilac' : 'uskocer', mesta: requester ? null : 3, viSte: true, telefon: null },
    { id: 'other', ime: 'Druga osoba', inicijali: 'DO', uloga: requester ? 'uskocer' : 'narucilac', mesta: requester ? 3 : null, viSte: false, telefon: 'PRIVATE_PHONE' }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: 'PRIVATE_PHONE', lokacijaPostoji: true, tacnaLokacija: 'PRIVATE_ADDRESS', emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [],
});
let rows: DogovorProjekcija[], loading: boolean, error: boolean, requester: boolean, tree: ReactTestRenderer;
const open = jest.fn(), refresh = jest.fn(), tasks = jest.fn();
function Screen() {
  const [section, setSection] = useState<AgreementCollectionSection>('active'), [confirmationOnly, setConfirmationOnly] = useState(false);
  return <AgreementCollectionPresentation items={rows} loading={loading} error={error} requester={requester}
    section={section} confirmationOnly={confirmationOnly} onSection={setSection} onConfirmationOnly={setConfirmationOnly}
    onOpen={open} onRefresh={refresh} onTasks={tasks} onCalendar={() => {}} onProfile={() => {}} />;
}
const render = async () => act(async () => { tree = create(<Screen />); });
const tap = async (label: string) => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
const titles = () => tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel).filter(label => label?.startsWith('Otvorite Dogovor'));
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {}); loading = error = false; requester = false;
  rows = [agreement('confirmed', 'CONFIRMED'), agreement('waiting-mine', 'AWAITING_REQUESTER'), agreement('waiting-other', 'AWAITING_REQUESTER', false), agreement('done', 'COMPLETED'), agreement('cancelled', 'CANCELLED')];
  open.mockClear(); refresh.mockClear(); tasks.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });
test('active and history preserve both actual participant roles; attention means my requester confirmation', async () => {
  await render(); expect(titles()).toHaveLength(3); expect(texts()).toContain('Ti naručuješ'); expect(texts()).toContain('Ti radiš');
  await tap('Čeka moju potvrdu'); expect(titles()).toEqual(['Otvorite Dogovor Posao waiting-mine']);
  await tap('Čeka moju potvrdu'); await tap('Istorija'); expect(titles()).toEqual(['Otvorite Dogovor Posao done', 'Otvorite Dogovor Posao cancelled']);
  await tap('Svi'); expect(titles()).toHaveLength(5);
});
test('reuses full accepted amount, precise interval and coverage, without exposing contact or exact address', async () => {
  rows = [agreement('remote', 'CONFIRMED')]; rows[0].rezim = 'DALJINSKI'; rows[0].putanjaTekst = 'REMOTE_MUST_HIDE_LOCATION';
  await render(); const text = texts(); expect(text).toContain(rows[0].vremeTekst); expect(text).toContain('2.500 RSD'); expect(text).toContain('3'); expect(text).toContain('osobe');
  expect(text).toContain('Na daljinu'); expect(text).not.toMatch(/PRIVATE_|REMOTE_MUST_HIDE_LOCATION/);
  await tap('Otvorite Dogovor Posao remote'); expect(open).toHaveBeenCalledWith(rows[0]);
});
test.each(['loading', 'error'])('%s hides stale private rows and error retry uses actual callback', async state => {
  loading = state === 'loading'; error = state === 'error'; await render(); expect(titles()).toEqual([]);
  if (error) { await act(async () => tree.root.findByProps({ label: 'Pokušajte ponovo' }).props.onPress()); expect(refresh).toHaveBeenCalledTimes(1); }
});
test('empty history still offers a real task route, with no invented review or unread controls', async () => {
  rows = []; await render(); await tap('Istorija'); expect(texts()).toContain('Još nemate Dogovor');
  await act(async () => tree.root.findByProps({ label: 'Pogledajte Zadatke' }).props.onPress()); expect(tasks).toHaveBeenCalledTimes(1);
  expect(texts()).not.toMatch(/Oceni|nepročitan/);
});
