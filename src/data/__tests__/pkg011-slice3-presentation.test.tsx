import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MojaPrijavaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent,
      props.data.length ? props.data.map((item: any) => React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item }))) : props.ListEmptyComponent);
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { MyApplicationsPresentation } from '../../ui/v2/MyApplicationsPresentation';
import { PublicNeedPresentation } from '../../ui/v2/PublicNeedPresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const brand = () => presses().filter(node => JSON.stringify(node.props.style).includes('#FF850F')).map(node => node.props.accessibilityLabel);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

const application = (id: string, stanje: MojaPrijavaProjekcija['stanje'], patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({
  prijavaId: id, potrebaId: 'need', potrebaRevizija: 2, prijavaRevizija: 2, prijavaVerzija: 1, stanje, naslov: `Unos ormara ${id}`, opis: 'Dvoje ljudi i trake.',
  cena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, pokrivaMesta: 2, napomena: '', podrucjeTekst: 'Novi Sad', vremeTekst: '20. septembar',
  dogovorId: stanje === 'SELECTED' ? 'agreement' : null, promenjenaPotreba: false, mozePovuci: stanje === 'SUBMITTED', traziPaznju: stanje === 'STALE_REVIEW_REQUIRED', ...patch });
const noop = () => {};
function Applications({ rows, loading = false }: { rows: MojaPrijavaProjekcija[]; loading?: boolean }) {
  return <MyApplicationsPresentation rows={rows} loading={loading} unavailable={false} message={null} notice={null} tab="all" onTab={noop}
    expanded={null} draft={null} busy={false} editingLoading={false} pending={false} canRetry={false} canReset={false}
    onRefresh={noop} onExplore={noop} onProfile={noop} onBack={noop} onReview={noop} onClose={noop} onEdit={noop} onChange={noop} onCancelEdit={noop}
    onKeep={noop} onUpdate={noop} onWithdraw={noop} onAgreement={noop} onTask={noop} onRetry={noop} onReset={noop} />;
}
test('Moje prijave names no app mode, offers tabs with counts as real tabs, and gives each application the actions its state allows', async () => {
  await act(async () => { tree = create(<Applications rows={[application('a', 'SUBMITTED'), application('b', 'SELECTED'), application('c', 'STALE_REVIEW_REQUIRED')]} />); });
  const copy = texts();
  expect(copy).toContain('Moje aktivnosti'); expect(copy).toContain('Moje prijave'); expect(copy).not.toMatch(/Ja mogu|Meni treba/);
  for (const tab of ['Sve', 'Čeka te', 'Aktivne', 'Završene']) expect(byLabel(tab).props.accessibilityRole).toBe('tab');
  expect(byLabel('Sve').props.accessibilityState).toEqual({ selected: true });
  expect(copy).toContain('Poslata'); expect(copy).toContain('Izabrana'); expect(copy).toContain('Potrebna nova provera'); expect(copy).toContain('6.000 RSD');
  expect(labels()).toContain('Otvori Dogovor: Unos ormara b'); expect(labels()).toContain('Povuci prijavu: Unos ormara a'); expect(labels()).toContain('Pregledaj izmene: Unos ormara c');
  expect(brand()).toEqual(['Pregledaj izmene: Unos ormara c']);
});
test('Prijave loading shows placeholders and a spoken status; the empty state has one brand action', async () => {
  await act(async () => { tree = create(<Applications rows={[application('a', 'SUBMITTED')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Povuci'))).toBe(false); expect(texts()).toContain('Učitavamo tvoje Prijave…');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Applications rows={[]} />); });
  expect(texts()).toContain('Tvoja sledeća prilika.'); expect(brand()).toEqual(['Istraži zadatke']);
});

const need: PrilikaProjekcija = { id: 'need', naslov: 'Selidba stana', statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Beograd, Vračar',
  vremeTekst: 'Sutra ujutru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: ['Kombi'], narucilacProfilId: 'profile-1', narucilacIme: 'Ana', narucilacOcena: '4,8',
  priblizno: { lat: 44.8, lng: 20.47 }, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 9000, valuta: 'RSD', prikaz: '9.000 RSD' }, opis: 'Dva sprata bez lifta.' };
const open = jest.fn(), close = jest.fn(), apply = jest.fn(), ownTask = jest.fn(), ownApplication = jest.fn();
function Detail({ canApply = true, profile = null, relation = { kind: 'NONE' } }: { canApply?: boolean; profile?: { loading: boolean; data: any } | null;
  relation?: import('../taskRelation').TaskRelation }) {
  return <PublicNeedPresentation need={need} loading={false} error={false} missing={false} stale={false} busy={false} canApply={canApply} canRetry
    relation={relation} onOwnTask={ownTask} onOwnApplication={ownApplication}
    back={noop} retry={noop} apply={apply} onRequesterProfile={open} requesterProfile={profile} onCloseRequesterProfile={close} />;
}
beforeEach(() => { for (const mock of [open, close, apply, ownTask, ownApplication]) mock.mockClear(); });
test('the public Task leads with status, title, price and people, offers the requester profile, and has exactly one brand action while applications are open', async () => {
  await act(async () => { tree = create(<Detail />); });
  const copy = texts();
  expect(copy).toContain('Traži ponude'); expect(copy).toContain('Selidba stana'); expect(copy).toContain('9.000 RSD'); expect(copy).toContain('Popunjeno 0 od 2 mesta');
  expect(copy).toContain('Dva sprata bez lifta.'); expect(copy).toContain('Ana'); expect(copy).toContain('Ocena 4,8');
  expect(brand()).toEqual(['Sastavi prijavu']);
  await act(async () => byLabel('Pogledaj javni profil').props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  await act(async () => byLabel('Sastavi prijavu').props.onPress()); expect(apply).toHaveBeenCalledTimes(1);
  expect(byLabel('Mesto izvršenja').props.accessibilityState).toEqual({ expanded: false });
});
test('closed applications remove the brand action and say so; the requester profile sheet shows loading, then only server facts, and closes', async () => {
  await act(async () => { tree = create(<Detail canApply={false} profile={{ loading: true, data: null }} />); });
  expect(brand()).toEqual([]); expect(texts()).toContain('Nove prijave trenutno nisu dostupne za ovaj zadatak.'); expect(texts()).toContain('Učitavamo javni profil…');
  await act(async () => tree.update(<Detail canApply={false} profile={{ loading: false, data: { profilId: 'profile-1', uloga: 'narucilac', ime: 'Ana Anić', avatarPutanja: null, grad: 'Beograd', naslov: null, biografija: 'Volim red.',
    poverenje: { ocenaProsek: 4.8, brojRecenzija: 3, zavrseniBroj: 5, identitetVerifikovan: false, ocenaDostupna: true, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } } }} />));
  const copy = texts();
  expect(copy).toContain('Ana Anić'); expect(copy).toContain('Beograd'); expect(copy).toContain('4.8'); expect(copy).toContain('3 recenzije'); expect(copy).toContain('Volim red.');
  expect(copy).not.toContain('Identitet je potvrđen');
  await act(async () => byLabel('Zatvori javni profil').props.onPress()); expect(close).toHaveBeenCalledTimes(1);
});

// Owner decision 1 (2026-09-19): the one action on a task somebody else can see is chosen by what I
// am to that task. It used to be chosen by the mode of the app, and an open task told a person
// standing in the other mode to go and change it in Profil.
test('my own task offers my view of it, never an application to myself', async () => {
  await act(async () => { tree = create(<Detail relation={{ kind: 'OWNER' }} />); });
  expect(texts()).toContain('Ovo je tvoj zadatak.'); expect(labels()).not.toContain('Sastavi prijavu');
  await act(async () => byLabel('Otvori svoj zadatak').props.onPress()); expect(ownTask).toHaveBeenCalledTimes(1); expect(apply).not.toHaveBeenCalled();
});
test('a task I applied to offers my application, and my Dogovor once I am chosen', async () => {
  await act(async () => { tree = create(<Detail relation={{ kind: 'APPLIED', applicationId: 'a1', agreementId: null }} />); });
  expect(texts()).toContain('Već si se prijavio na ovaj zadatak.'); expect(labels()).not.toContain('Sastavi prijavu');
  await act(async () => byLabel('Pogledaj svoju prijavu').props.onPress()); expect(ownApplication).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Detail relation={{ kind: 'APPLIED', applicationId: 'a1', agreementId: 'g1' }} />); });
  expect(labels()).toContain('Otvori Dogovor');
});
test('a relation that could not be read is never treated as not applied: no application is offered, only the check again', async () => {
  await act(async () => { tree = create(<Detail relation={{ kind: 'UNKNOWN' }} />); });
  expect(labels()).not.toContain('Sastavi prijavu'); expect(labels()).toContain('Proveri ponovo');
  expect(texts()).not.toMatch(/JA MOGU|MENI TREBA|Profilu/);
});
