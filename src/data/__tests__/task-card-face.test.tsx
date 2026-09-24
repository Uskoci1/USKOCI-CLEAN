import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { NeedDetailProjection } from '../../contracts/projections';
import type { MarketplaceItem } from '../marketplaceView';
import { sys } from '../../ui/system/tokens';

/**
 * One task card (owner's step 5a, 2026-09-24; emulator critique A8, A9, A10, B13, B14). The card is one face with fixed
 * lines: status when it says something, title with a value slot that is never empty, place, time, at most one
 * requirement a worker decides on (never a skill), and a foot with the places and the person. My own task's next step
 * is a target of its own beside the body, never inside it.
 */
let mockScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('../../ui/system/Pictogram', () => ({ ...jest.requireActual('../../ui/system/Pictogram'), Pictogram: 'Pictogram' }));
jest.mock('../../ui/system/textScale', () => ({ useTextScale: () => mockScale }));
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight', Lightning: 'Lightning' }));
import { TaskCard } from '../../ui/v2/TaskCard';

const needs = (patch: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection['zahtevi'] => ({ vestine: [], alati: [], vozila: [], dozvole: [],
  bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch });
const detail = (patch: Partial<NeedDetailProjection> = {}, zahtevi: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection =>
  ({ kategorija: 'Krečenje', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: needs(zahtevi), ...patch });
/** A stranger's task as the discovery read maps it: skills stay in `uslovi` and in `vestine`, conditions in `bitniUslovi`. */
const task = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'need-1', naslov: 'Farbanje dnevne sobe', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '24. sep · 17:00', statusTekst: 'Otvoren', uslovi: ['Krečenje', 'Valjak'], pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: null, narucilacProfilId: 'profile-1', narucilacIme: 'Nikola Petrović', narucilacOcena: '4,8', narucilacBrojOcena: 12,
  rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
  detalji: detail({}, { vestine: ['Krečenje'] }), ...patch }) as MarketplaceItem;
/** My own task as the owned read maps it. */
const mine = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'mine-1', revizija: 1, naslov: 'Montaža dve police', opis: '', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: '25. sep · 10:00', podrucjeTekst: 'Grbavica, Novi Sad', uslovi: ['Montaža'],
  brojPrijava: 4, brojPrijavaZaIzbor: 3, rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  detalji: detail({}, { vestine: ['Montaža'] }), ...patch }) as MarketplaceItem;

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const textNode = (value: string) => tree.root.find(node => node.type === ('T' as React.ElementType) && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const pictograms = () => tree.root.findAll(node => node.type === ('Pictogram' as React.ElementType)).map(node => node.props.kind);
const facts = () => tree.root.findAll(node => node.type === ('FactArt' as React.ElementType)).map(node => node.props.kind);
beforeEach(() => { mockScale = 1; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the requirement line', () => {
  it('never shows a skill, the category or the mixed `uslovi` list: without a condition, vehicle or tool there is no line', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts().join(' ')).not.toMatch(/Krečenje|Valjak/);
    expect(facts()).not.toContain('info'); expect(pictograms()).toEqual([]);
  });

  it('shows the task\'s own conditions first, as one plain line of at most two lines with the info art, and nothing else', async () => {
    await render(<TaskCard item={task({ detalji: detail({}, { vestine: ['Krečenje'], vozila: ['Kombi'], alati: ['Bušilica'],
      bitniUslovi: ['Zgrada bez lifta', 'Orman je već rasklopljen'] }) })} onOpen={jest.fn()} />);
    const line = textNode('Zgrada bez lifta · Orman je već rasklopljen');
    expect(line.props.numberOfLines).toBe(2);
    expect(facts()).toContain('info');
    expect(texts().join(' ')).not.toMatch(/Kombi|Bušilica|Krečenje/);
    expect(pictograms()).toEqual([]);
  });

  it('then the vehicles with the vehicle drawing, then the tools with the tool drawing', async () => {
    await render(<TaskCard item={task({ detalji: detail({}, { vestine: ['Selidbe'], vozila: ['Kombi'], alati: ['Bušilica'] }) })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Kombi'); expect(texts()).not.toContain('Bušilica'); expect(pictograms()).toEqual(['kombi']);
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { vozila: ['Automobil', 'Prikolica'] }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Automobil · Prikolica'); expect(pictograms()).toEqual(['automobil']);
    // A vehicle the picker does not name still draws a vehicle, never a guessed kind of work.
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { vozila: ['Kamionet sa ceradom'] }) })} onOpen={jest.fn()} />));
    expect(pictograms()).toEqual(['kombi']);
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({}, { alati: ['Bušilica'] }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Bušilica'); expect(pictograms()).toEqual(['busilica']);
  });
});

describe('the value slot', () => {
  const amountOf = (item: MarketplaceItem) => item.rezimCene !== 'OFFERS' && item.ponudjenaCena?.prikaz ? item.ponudjenaCena.prikaz : null;
  const cases: [string, MarketplaceItem, string][] = [
    ['amount', task(), '5.500 RSD'],
    ['offers', task({ rezimCene: 'OFFERS', ponudjenaCena: { iznos: 9000, valuta: 'RSD', prikaz: '9.000 RSD' } }), 'Tražim ponude'],
    ['no price', task({ rezimCene: 'MY_PRICE', ponudjenaCena: undefined, osnovaCene: null }), 'Cena nije navedena'],
  ];

  it.each([1, 1.3])('is always filled, and a word is never money-styled (text scale %s)', async scale => {
    mockScale = scale;
    for (const [, item, shown] of cases) {
      await render(<TaskCard item={item} onOpen={jest.fn()} />);
      const value = textNode(shown);
      if (amountOf(item)) {
        expect(style(value)).toMatchObject({ color: sys.color.money, fontWeight: '700', fontVariant: ['tabular-nums'] });
      } else {
        // A label: 15/20 medium, quiet, never the amount's colour or weight.
        expect(style(value)).toMatchObject({ fontSize: 15, lineHeight: 20, fontWeight: '500', color: sys.color.muted });
      }
      // Nothing but an amount ever wears the money colour on a card.
      const money = tree.root.findAll(node => node.type === ('T' as React.ElementType) && style(node).color === sys.color.money);
      expect(money.map(node => node.props.children)).toEqual(amountOf(item) ? [amountOf(item)] : []);
      // "Tražim ponude" means offers even when an old amount is still stored beside it.
      if (shown === 'Tražim ponude') expect(texts()).not.toContain('9.000 RSD');
      await act(async () => tree.unmount());
    }
  });

  it('says what the amount buys in one or two words under it, and nothing when the basis is not named', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(texts()).toContain('ukupno'); expect(texts().join(' ')).not.toContain('ukupno za ceo zadatak');
    await act(async () => tree.update(<TaskCard item={task({ osnovaCene: 'PER_PERSON' })} onOpen={jest.fn()} />));
    expect(texts()).toContain('po osobi');
    await act(async () => tree.update(<TaskCard item={task({ osnovaCene: null })} onOpen={jest.fn()} />));
    expect(texts()).not.toContain('ukupno'); expect(texts()).not.toContain('po osobi');
  });

  it('stands beside a two-line title at normal text, and under a three-line title at large text', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    let title = textNode('Farbanje dnevne sobe');
    expect(title.props.numberOfLines).toBe(2);
    expect(style(title.parent!)).toMatchObject({ flexDirection: 'row' });
    expect(title.parent!.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === '5.500 RSD')).toHaveLength(1);
    await act(async () => tree.unmount());
    mockScale = 1.3;
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    title = textNode('Farbanje dnevne sobe');
    expect(title.props.numberOfLines).toBe(3);
    expect(style(title.parent!).flexDirection).not.toBe('row');
  });
});

describe('the places and the person', () => {
  it('tell a worker how many people are wanted or how many places are left', async () => {
    const places = (ukupno: number, popunjeno: number) => task({ pokrivenost: { ukupno, popunjeno, preostalo: ukupno - popunjeno, udeo: popunjeno / ukupno } });
    await render(<TaskCard item={places(2, 0)} onOpen={jest.fn()} />); expect(texts()).toContain('Traži 2 osobe');
    await act(async () => tree.update(<TaskCard item={places(1, 0)} onOpen={jest.fn()} />)); expect(texts()).toContain('Traži 1 osobu');
    await act(async () => tree.update(<TaskCard item={places(5, 0)} onOpen={jest.fn()} />)); expect(texts()).toContain('Traži 5 osoba');
    await act(async () => tree.update(<TaskCard item={places(2, 1)} onOpen={jest.fn()} />)); expect(texts()).toContain('Još 1 od 2 mesta');
    expect(texts().join(' ')).not.toMatch(/popunjeno/);
  });

  it('show the owner the progress, on the own list and on a task of mine met in discovery, with no person', async () => {
    await render(<TaskCard item={mine()} onOpen={jest.fn()} />);
    expect(texts()).toContain('0/2 popunjeno'); expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
    await act(async () => tree.update(<TaskCard item={task()} relation="OWNED" onOpen={jest.fn()} />));
    expect(texts()).toContain('Tvoj zadatak'); expect(texts()).toContain('0/2 popunjeno');
    expect(texts()).not.toContain('Nikola Petrović'); expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0);
  });

  it('put the person bottom right with the one initials rule and a rating that says how many reviews it stands on', async () => {
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(tree.root.findByType('Avatar' as React.ElementType).props).toMatchObject({ initials: 'NP' });
    expect(texts()).toContain('Nikola Petrović'); expect(texts()).toContain('4,8 (12)'); expect(facts()).toContain('star');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Nikola Petrović, ocena 4,8, 12 ocena')).not.toHaveLength(0);
    // The person closes the foot row on the right, after the places.
    const [foot] = tree.root.findAll(node => node.type === ('View' as React.ElementType) && style(node).justifyContent === 'space-between'
      && node.findAllByType('Avatar' as React.ElementType).length > 0);
    expect(style(foot)).toMatchObject({ flexDirection: 'row' });
    const order = foot.findAll(node => node.type === ('Avatar' as React.ElementType) || (node.type === ('T' as React.ElementType) && node.props.children === 'Traži 2 osobe'));
    expect(order.map(node => node.type)).toEqual(['T', 'Avatar']);
  });

  it.each([
    ['no reviews yet', { narucilacOcena: null, narucilacBrojOcena: 0 }, 'Još nema ocena', false],
    ['one review', { narucilacOcena: '5,0', narucilacBrojOcena: 1 }, '5,0 (1)', true],
    ['an unknown count', { narucilacOcena: '4,6', narucilacBrojOcena: null }, '4,6', true],
    ['an old read without the field', { narucilacOcena: '4,6', narucilacBrojOcena: undefined }, '4,6', true],
  ])('rate honestly with %s', async (_name, patch, shown, star) => {
    await render(<TaskCard item={task(patch)} onOpen={jest.fn()} />);
    expect(texts()).toContain(shown);
    expect(facts().includes('star')).toBe(star);
    if (patch.narucilacBrojOcena !== 1) expect(texts().join(' ')).not.toMatch(/\(\d+\)/);
  });

  it('draw no rating when none is known, and no person without a name', async () => {
    await render(<TaskCard item={task({ narucilacOcena: null, narucilacBrojOcena: null })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Nikola Petrović'); expect(facts()).not.toContain('star'); expect(texts()).not.toContain('Još nema ocena');
    await act(async () => tree.update(<TaskCard item={task({ narucilacIme: '  ' })} onOpen={jest.fn()} />));
    expect(tree.root.findAllByType('Avatar' as React.ElementType)).toHaveLength(0); expect(texts()).not.toContain('4,8 (12)');
  });

  it('read a route as start → end from the public area or city, never the private label', async () => {
    const geografija = { mode: 'POINT_TO_POINT', start: { label: 'Bulevar oslobođenja 12', area: 'Liman', city: 'Novi Sad' },
      end: { label: 'Kisačka 5', city: 'Novi Sad' } };
    await render(<TaskCard item={task({ detalji: detail({ geografija, rezimLokacije: 'POINT_TO_POINT' } as Partial<NeedDetailProjection>) })} onOpen={jest.fn()} />);
    expect(texts()).toContain('Liman → Novi Sad');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/Bulevar|Kisačka/);
    await act(async () => tree.update(<TaskCard item={task({ detalji: detail({ rezimLokacije: 'REMOTE' }) })} onOpen={jest.fn()} />));
    expect(texts()).toContain('Na daljinu'); expect(facts()).toContain('remote');
  });
});

describe('my own task\'s next step', () => {
  const foot = (text: string) => presses().find(node => String(node.props.accessibilityLabel).startsWith(text));

  it('goes straight to the applications through its own target, a sibling of the body and never inside it', async () => {
    const open = jest.fn(), applications = jest.fn();
    await render(<TaskCard item={mine()} onOpen={open} onApplications={applications} />);
    expect(presses()).toHaveLength(2);
    const [body, next] = [presses()[0], foot('3 prijave čekaju izbor')!];
    expect(next.props.accessibilityLabel).toBe('3 prijave čekaju izbor, Montaža dve police');
    expect(body.props.accessibilityLabel).toBe('Otvori Zadatak Montaža dve police');
    expect(body.findAll(node => node === next)).toHaveLength(0);
    expect(style(next)).toMatchObject({ minHeight: 48, backgroundColor: sys.color.orangeSoft });
    // No hairline over the foot.
    expect(style(next).borderTopWidth ?? 0).toBe(0);
    await act(async () => next.props.onPress());
    expect(applications).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  });

  it('counts in Serbian', async () => {
    await render(<TaskCard item={mine({ brojPrijavaZaIzbor: 1 })} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(foot('1 prijava čeka izbor')).toBeTruthy();
    await act(async () => tree.update(<TaskCard item={mine({ brojPrijavaZaIzbor: 5 })} onOpen={jest.fn()} onApplications={jest.fn()} />));
    expect(foot('5 prijava čeka izbor')).toBeTruthy();
  });

  it.each([
    ['none to choose', { brojPrijavaZaIzbor: 0 }, 'Još nema prijava za izbor'],
    ['an unknown count', { brojPrijavaZaIzbor: null }, null],
    ['an old read without the count', { brojPrijavaZaIzbor: undefined }, null],
    ['a closed task', { stanje: 'ZATVORENA' }, null],
    ['a full task', { stanje: 'POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }, null],
  ])('has no foot target with %s', async (_name, patch, note) => {
    await render(<TaskCard item={mine(patch)} onOpen={jest.fn()} onApplications={jest.fn()} />);
    expect(presses()).toHaveLength(1);
    expect(texts().join(' ')).not.toMatch(/čeka(ju)? izbor/);
    if (note) expect(style(textNode(note))).toMatchObject({ color: sys.color.muted });
    else expect(texts()).not.toContain('Još nema prijava za izbor');
  });

  it('continues a draft through the card itself, with the draft status and no places', async () => {
    const open = jest.fn();
    await render(<TaskCard item={mine({ stanje: 'NACRT' })} onOpen={open} onApplications={jest.fn()} />);
    expect(presses()).toHaveLength(1); expect(texts()).toContain('Nacrt'); expect(texts()).toContain('Nastavi uređivanje');
    expect(texts().join(' ')).not.toMatch(/popunjeno|prijav/);
    await act(async () => presses()[0].props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  });

  it('says the states of my own task and nothing for an open one', async () => {
    const status = async (stanje: string, word: string | null) => {
      await render(<TaskCard item={mine({ stanje, brojPrijavaZaIzbor: null })} onOpen={jest.fn()} />);
      for (const other of ['Nacrt', 'Delimično popunjen', 'Popunjen', 'Zatvoren']) expect(texts().includes(other)).toBe(other === word);
      await act(async () => tree.unmount());
    };
    await status('OBJAVLJENA', null); await status('CEKA_PRIJAVE', null); await status('DELIMICNO_POPUNJENA', 'Delimično popunjen');
    await status('POPUNJENA', 'Popunjen'); await status('ZATVORENA', 'Zatvoren');
  });

  it('still says what waits when no route to it was handed over, inside the one body target', async () => {
    await render(<TaskCard item={mine()} onOpen={jest.fn()} />);
    expect(presses()).toHaveLength(1); expect(texts()).toContain('3 prijave čekaju izbor');
  });
});

describe('the card', () => {
  it.each([1, 1.3])('keeps its facts on fixed lines (no wrapping row) and is a hairline card without a shadow (text scale %s)', async scale => {
    mockScale = scale;
    await render(<TaskCard item={task({ detalji: detail({}, { bitniUslovi: ['Zgrada bez lifta'] }) })} onOpen={jest.fn()} />);
    for (const node of tree.root.findAll(candidate => typeof candidate.type === 'string')) expect(style(node).flexWrap).not.toBe('wrap');
    const card = tree.root.findAll(node => node.type === ('View' as React.ElementType))[0];
    expect(style(card)).toMatchObject({ borderWidth: 1, backgroundColor: sys.color.surface });
    for (const key of ['boxShadow', 'elevation', 'shadowColor', 'shadowOpacity']) expect(style(card)).not.toHaveProperty(key);
    // One body press that gives a little under the finger.
    expect(presses()).toHaveLength(1); expect(presses()[0].props.scaleTo).toBe(0.986);
  });
});
