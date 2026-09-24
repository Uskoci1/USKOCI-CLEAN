import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * Incoming applications and choosing a candidate (owner's step 7, 2026-09-24). An offer is chosen as a person first, so
 * its card leads with the person — their picture, name and the rating with the count it stands on — beside the total it
 * asks; nothing on it is invented. Two offers are compared side by side only while two columns fit (a 360 dp phone and a
 * text size under Large, read rounded because Android hands Large over as 1.2999999523). The offer and the public
 * profile are sheets of the one sheet engine, and the profile keeps its report-or-block entry.
 */
let mockWidth = 390, mockFontScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const FlatList = (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent,
    ...(props.data.length ? props.data.map((item: any, index: number) =>
      React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))) : [props.ListEmptyComponent]),
    props.ListFooterComponent);
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    if (key === 'FlatList') return FlatList;
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 800, scale: 2, fontScale: mockFontScale });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
import { CandidateListPresentation, CandidateSelectionPresentation } from '../../ui/v2/ApplicationSelectionPresentation';
import { candidateTrust, candidateValue } from '../../ui/v2/CandidateFace';
import { PublicProfileSheet } from '../../ui/system/PublicProfileSheet';

const need = { id: 'need-1', revizija: 3, naslov: 'Unos ormara', podrucjeTekst: 'Liman 2, Novi Sad', vremeTekst: '20. sep · 10:00–11:00', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0, udeo: 0 }, rezimCene: 'OFFERS', taskTimezone: 'Europe/Belgrade' } as unknown as PotrebaProjekcija;
const k = (patch: Partial<KandidatProjekcija> = {}): KandidatProjekcija => ({ prijavaId: 'application-1', radnikProfilId: 'profile-1', potrebaRevizija: 3,
  verzija: 2, hash: 'a'.repeat(64), ime: 'Milan Petrović', inicijali: 'MP', ocenaTekst: '4,8', recenzijeTekst: '11 recenzija',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3, dolazakTekst: '', prevozTekst: '',
  napomena: 'Dolazimo sa trakama i kombijem.', stanje: 'SELECTABLE', mozeIzabrati: true, predlozeniPocetak: null, predlozeniKraj: null,
  dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 2, vestine: [], alati: ['Trake'], vozila: ['Kombi'], licence: [] }, razlogPreporuke: null, ...patch });

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); mockWidth = 390; mockFontScale = 1; });
const noop = () => {};
const list = (candidates: KandidatProjekcija[]) => <CandidateListPresentation need={need} candidates={candidates} open={noop} back={noop} refresh={noop} />;
const texts = (root: ReactTestInstance = tree.root) => root.findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const pressNamed = (label: string) => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType) && node.props.accessibilityLabel === label)[0];
const flat = (style: unknown) => Object.assign({}, ...[style].flat(4).filter(Boolean));
const stars = (root: ReactTestInstance) => root.findAll(node => node.type === ('FactArt' as unknown as React.ElementType) && node.props.kind === 'star');

describe('the candidate row', () => {
  it('leads with the person: picture, name and rating, then the total with what it covers, one line of the message and one press', async () => {
    const opened: string[] = [];
    await act(async () => { tree = create(<CandidateListPresentation need={need} candidates={[k()]} open={candidate => opened.push(candidate.prijavaId)}
      back={noop} refresh={noop} />); });
    const row = pressNamed('Pogledaj ponudu: Milan Petrović');
    // Tree order is reading order: the Avatar, the name, the rating, then the amount and its basis.
    const order = row.findAll(node => node.type === ('Avatar' as unknown as React.ElementType)
      || (node.type === ('T' as unknown as React.ElementType) && typeof node.props.children === 'string'))
      .map(node => node.type === ('Avatar' as unknown as React.ElementType) ? `avatar:${node.props.initials}` : node.props.children);
    // The rating line keeps its count whole when it wraps: no-break spaces inside the count and before the dot.
    expect(order).toEqual(['avatar:MP', 'Milan Petrović', '4,8 · 11 recenzija', '4.500 RSD', 'ukupno · 2 osobe', 'Dolazimo sa trakama i kombijem.']);
    const amount = row.findAll(node => node.props.children === '4.500 RSD')[0];
    expect(flat(amount.props.style).color).toBe(sys.color.money);
    expect(row.findAll(node => node.props.children === 'Dolazimo sa trakama i kombijem.')[0].props.numberOfLines).toBe(1);
    // No proposed interval: no time line (the task's own time would repeat on every card).
    expect(row.findAll(node => node.type === ('FactArt' as unknown as React.ElementType) && node.props.kind === 'calendar')).toHaveLength(0);
    expect(row.props.accessibilityHint).toMatch(/^Ocena 4,8, 11 recenzija\. Ukupno 4\.500 RSD; 2 osobe; termin Zadatka\./);
    // One target: nothing inside the card is a press of its own.
    expect(row.findAll(node => node.type === ('Press' as unknown as React.ElementType))).toHaveLength(1);
    await act(async () => row.props.onPress()); expect(opened).toEqual(['application-1']);
  });

  it('shows a proposed interval in Serbian time and says the state of an offer that cannot simply be chosen', async () => {
    await render(list([k({ predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z', stanje: 'STALE', mozeIzabrati: false })]));
    const row = pressNamed('Pogledaj ponudu: Milan Petrović');
    expect(texts(row)).toMatch(/20\. sep( 2026)? · 10:00–11:00/);
    const status = row.findAll(node => node.props.children === 'Potrebna nova provera')[0];
    expect(flat(status.props.style).color).toBe(sys.color.warn);
    expect(row.props.accessibilityHint).toContain('Potrebna nova provera.');
  });

  it('never invents a rating or a count: a star only beside a figure, and a missing rating says it is missing', async () => {
    expect(candidateTrust({ ocenaTekst: '—', recenzijeTekst: '' })).toEqual({ star: false, text: 'Ocena nije dostupna', spoken: 'ocena nije dostupna' });
    expect(candidateTrust({ ocenaTekst: '—', recenzijeTekst: '3 završena posla' }).text).toBe('Ocena nije dostupna · 3 završena posla');
    expect(candidateTrust({ ocenaTekst: '4,8', recenzijeTekst: '' })).toEqual({ star: true, text: '4,8', spoken: 'ocena 4,8' });
    // A word where a figure should be ("Novo") is not a rating and gets no star.
    expect(candidateTrust({ ocenaTekst: 'Novo', recenzijeTekst: 'Nema ocena' }).star).toBe(false);
    await render(list([k({ prijavaId: 'a', ime: 'Ana', ocenaTekst: '—', recenzijeTekst: '' }), k({ prijavaId: 'b', ime: 'Bojan', ocenaTekst: '4,8', recenzijeTekst: '' })]));
    const ana = pressNamed('Pogledaj ponudu: Ana'), bojan = pressNamed('Pogledaj ponudu: Bojan');
    expect(stars(ana)).toHaveLength(0);
    expect(texts(ana)).toContain('Ocena nije dostupna'); expect(texts(ana)).not.toMatch(/recenzij|završen|\(\d+\)/);
    expect(stars(bojan)).toHaveLength(1);
    expect(bojan.findAll(node => node.props.children === '4,8')).toHaveLength(1); expect(texts(bojan)).not.toMatch(/recenzij|\(\d+\)/);
  });

  it('keeps the currency on an amount and never dresses a missing price as money', () => {
    expect(candidateValue({ cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500' }, pokrivaMesta: 1 }))
      .toEqual({ kind: 'amount', amount: '4.500 RSD', basis: 'ukupno · 1 osoba' });
    expect(candidateValue({ cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, pokrivaMesta: 1 })).toEqual({ kind: 'unpriced' });
  });

  it('draws the empty list as the one empty state, saying what happens next without promising anyone will apply', async () => {
    await render(list([]));
    expect(texts()).toContain('Još nema prijava');
    expect(texts()).toContain('Kad neko pošalje ponudu za ovaj zadatak, videćeš je ovde i moći ćeš da je uporediš pre izbora.');
    expect(pressNamed('Osveži prijave')).toBeDefined();
  });
});

describe('the comparison', () => {
  const columns = () => tree.root.findAll(node => node.type === ('FlatList' as unknown as React.ElementType))[0].props.numColumns;
  const compare = async () => { await act(async () => pressNamed('Uporedi').props.onPress()); };
  const two = [k(), k({ prijavaId: 'application-2', ime: 'Ana Jovanović', inicijali: 'AJ', cena: { iznos: 3900, valuta: 'RSD', prikaz: '3.900 RSD' } })];

  it.each([
    ['a 390 dp phone at normal text', 390, 1, 2],
    ['just under Large', 390, 1.29, 2],
    ['Android Large as it arrives (1.2999999523)', 390, 1.2999999523, 1],
    ['a 359 dp phone', 359, 1, 1],
  ])('follows the rounded text scale and the width: %s', async (_name, width, fontScale, expected) => {
    mockWidth = width; mockFontScale = fontScale;
    await render(list(two));
    await compare();
    expect(columns()).toBe(expected);
    expect(pressNamed('Otvori prijavu: Ana Jovanović')).toBeDefined();
  });

  it('gives a lone last offer the width of one column, not the whole row', async () => {
    await render(list([...two, k({ prijavaId: 'application-3', ime: 'Nikola Ilić', inicijali: 'NI' })]));
    await compare();
    // (390 − 2 × 20 side padding − 12 gap) / 2 = 169, for every column including the third offer alone on its row.
    const widths = tree.root.findAll(node => node.type === ('View' as unknown as React.ElementType) && flat(node.props.style).width === 169);
    expect(widths).toHaveLength(3);
  });

  it.each([
    ['at Large', 390, 1.2999999523, 'left'],
    ['on a 320 dp phone', 320, 1, 'left'],
    ['beside the person on a 390 dp phone at normal text', 390, 1, 'right'],
  ])('places the total %s', async (_name, width, fontScale, align) => {
    mockWidth = width; mockFontScale = fontScale;
    await render(list([k()]));
    const row = pressNamed('Pogledaj ponudu: Milan Petrović');
    const amount = row.findAll(node => node.props.children === '4.500 RSD')[0];
    expect(flat(amount.props.style).textAlign).toBe(align);
  });
});

describe('the offer sheet', () => {
  const offer = (patch: Partial<React.ComponentProps<typeof CandidateSelectionPresentation>> = {}) =>
    <CandidateSelectionPresentation need={need} candidate={k()} back={noop} publicProfile={async () => null} choose={noop} busy={false}
      pending={false} uncertain={false} refresh={noop} error={null} confirmed={false} openAgreement={noop}
      readAgreement={async () => ({ ok: true, podatak: { dogovorId: null } })} openLinkedAgreement={noop} {...patch} />;
  const green = () => tree.root.findAll(node => node.type === ('Press' as unknown as React.ElementType)
    && flat(node.props.style).backgroundColor === sys.color.green).map(node => node.props.accessibilityLabel);

  it('is a sheet of the one engine with one green action that asks before it chooses', async () => {
    const choose = jest.fn();
    await render(offer({ choose }));
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1);
    expect(green()).toEqual(['Izaberi ovu ponudu']);
    await act(async () => pressNamed('Izaberi ovu ponudu').props.onPress());
    expect(choose).not.toHaveBeenCalled(); expect(texts()).toContain('Jedan izbor sklapa Dogovor.');
    await act(async () => pressNamed('Izaberi ovu Prijavu').props.onPress());
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it('has no green action for an offer that cannot be chosen, and says why beside the one thing to do', async () => {
    const refresh = jest.fn();
    await render(offer({ candidate: k({ stanje: 'OVERFILL', mozeIzabrati: false }), refresh }));
    expect(green()).toEqual([]);
    expect(texts()).toContain('Više ljudi nego što je preostalo');
    await act(async () => pressNamed('Osveži prijave').props.onPress()); expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('the public profile sheet', () => {
  const profile = (): JavniProfilProjekcija => ({ profilId: 'profile-1', uloga: 'radnik', ime: 'Marko Marković', avatarPutanja: null, grad: 'Novi Sad',
    naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: 0, zavrseniBroj: 2, identitetVerifikovan: false,
      ocenaDostupna: false, recenzijeDostupne: true, verifikacijaIdentitetaDostupna: false } } as unknown as JavniProfilProjekcija);

  it('is a sheet of the one engine titled with the name, and keeps its report-or-block entry with its states', async () => {
    const onPress = jest.fn(), onClose = jest.fn();
    await render(<PublicProfileSheet state={{ loading: false, data: profile() }} onClose={onClose} onRetry={noop} safety={{ onPress, busy: false, error: null }} />);
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(1);
    expect(texts()).toContain('Marko Marković'); expect(texts()).toContain('Još nema ocena'); expect(texts()).not.toContain('Javni profil');
    const entry = pressNamed('Prijavi ili blokiraj osobu: Marko Marković');
    expect(texts(entry)).toContain('Prijavi ili blokiraj osobu');
    await act(async () => entry.props.onPress()); expect(onPress).toHaveBeenCalledTimes(1);
    await act(async () => pressNamed('Zatvori javni profil').props.onPress()); expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: profile() }} onClose={onClose} onRetry={noop}
      safety={{ onPress, busy: true, error: 'Korisnik trenutno nije dostupan.' }} />));
    const busy = pressNamed('Prijavi ili blokiraj osobu: Marko Marković');
    expect(busy.props.disabled).toBe(true); expect(texts(busy)).toContain('Otvaramo…');
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'alert' && node.props.children === 'Korisnik trenutno nije dostupan.')).toHaveLength(1);
  });

  it('loads and fails the one way every screen does', async () => {
    const onRetry = jest.fn();
    await render(<PublicProfileSheet state={{ loading: true, data: null }} onClose={noop} onRetry={onRetry} />);
    expect(texts()).toContain('Učitavamo javni profil…');
    await act(async () => tree.update(<PublicProfileSheet state={{ loading: false, data: null }} onClose={noop} onRetry={onRetry} />));
    expect(texts()).toContain('Javni profil trenutno nije dostupan.');
    await act(async () => pressNamed('Pokušaj ponovo').props.onPress()); expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
