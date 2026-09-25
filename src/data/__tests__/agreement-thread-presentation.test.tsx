import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../contracts/projections';

let mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto', NeedPhotos: 'NeedPhotos' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementThreadPresentation } from '../../ui/v2/AgreementThreadPresentation';
import { AgreementPersonBar } from '../../ui/v2/AgreementPresentation';

const agreement = {
  id: 'dogovor', naslov: 'Prenos troseda i dve fotelje sa trećeg sprata', verzija: 2, stanje: 'CONFIRMED',
  cena: { prikaz: '5.500 RSD' }, vremeTekst: '26. sep · 17:00–19:00 (po vremenu u Srbiji)', putanjaTekst: 'Liman, Novi Sad',
  pokrivenost: { ukupno: 2, popunjeno: 2 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'druga', ime: 'Aleksandra Konstantinović-Radovanović', inicijali: 'AK', uloga: 'uskocer', profilId: null }],
} as DogovorProjekcija;
const command = { accountId: 'ja', agreementId: agreement.id, clientMessageId: 'poruka_retry_123', body: 'Stižem uskoro.' };
type Props = React.ComponentProps<typeof AgreementThreadPresentation>;
let tree: ReactTestRenderer;
let props: Props;
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const flat = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style ?? {};
const text = (node = tree.root) => node.findAll(child => String(child.type) === 'T').flatMap(child => child.children.filter(value => typeof value === 'string')).join(' ');
const history = () => tree.root.findByProps({ testID: 'agreement-chat-history' });
const measure = async (height: number) => act(async () => tree.root.findByProps({ testID: 'agreement-thread-frame' })
  .props.onLayout({ nativeEvent: { layout: { height } } }));
async function render() { await act(async () => { tree = create(<AgreementThreadPresentation {...props} />); }); }

beforeEach(() => {
  mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
  props = { agreement, person: agreement.ucesnici[0], back: jest.fn(), onOverview: jest.fn(), waiting: 'Potvrdi završetak',
    chat: { messages: [], loading: false, error: false, writable: true, terminal: false, refresh: jest.fn().mockResolvedValue(undefined),
      refreshWorkspace: jest.fn().mockResolvedValue(undefined),
      outbox: { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), retry: jest.fn().mockResolvedValue(undefined), start: jest.fn() } as any,
      state: { phase: 'ready', draft: 'Moj sačuvani nacrt', capturing: false, entries: [], error: null },
      photos: { agreementId: agreement.id, loaded: true, busy: false, ready: false, hasSelection: false, items: [],
        message: null, versionConflict: false, canSubmit: () => false, capture: () => null } as any } };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('gives 320 dp / font scale 2 history the full identity and accepted terms while keeping overview outside the scroll', async () => {
  mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
  await render();
  expect(tree.root.findAllByType(AgreementPersonBar)).toHaveLength(0);
  const context = history().findByProps({ testID: 'agreement-thread-context' });
  expect(text(context)).toContain(agreement.ucesnici[0].ime);
  expect(text(context)).toContain('Uskače na tvoj zadatak');
  expect(text(context)).toContain(agreement.naslov);
  expect(text(context)).toContain('5.500 RSD');
  expect(text(context)).toContain('26. sep · 17:00–19:00');
  expect(text(context)).toContain('Po vremenu u Srbiji');
  expect(text(context)).toContain('Potvrdi završetak');
  const name = context.findAll(node => String(node.type) === 'T' && node.children.includes(agreement.ucesnici[0].ime))[0];
  expect(name.props.numberOfLines).toBeUndefined();
  const overview = `Uslovi Dogovora: ${agreement.naslov}. Potvrdi završetak`;
  expect(history().findAllByProps({ accessibilityLabel: overview })).toHaveLength(0);
  await act(async () => button(overview).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  await act(async () => button('Nazad').props.onPress());
  expect(props.back).toHaveBeenCalledTimes(1);
  const composer = tree.root.findByProps({ testID: 'agreement-chat-composer' });
  expect(history().findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
  expect(flat(composer.props.style).flexShrink).toBe(0);
  expect(button('Napiši poruku').props).toMatchObject({ value: 'Moj sačuvani nacrt', multiline: true, scrollEnabled: true });
  expect(flat(button('Napiši poruku').props.style).maxHeight).toBeLessThan(90);
  expect(flat(button('Pošalji poruku').props.style)).toMatchObject({ width: 48, height: 48 });
});

it('responds to the measured keyboard space without remounting the draft or losing an open photo tray', async () => {
  await render();
  expect(tree.root.findAllByType(AgreementPersonBar)).toHaveLength(1);
  const input = button('Napiši poruku');
  await act(async () => button('Fotografije uz poruku').props.onPress());
  const tray = tree.root.findByType('AgreementPhotoComposer' as any);
  await measure(410);
  expect(tree.root.findAllByType(AgreementPersonBar)).toHaveLength(0);
  expect(button('Napiši poruku')).toBe(input);
  expect(tree.root.findByType('AgreementPhotoComposer' as any)).toBe(tray);
  expect(tray.props.photos).toBe(props.chat.photos);
  expect(history().findByType('AgreementPhotoComposer' as any)).toBe(tray);
  await measure(790);
  expect(tree.root.findAllByType(AgreementPersonBar)).toHaveLength(1);
  expect(button('Napiši poruku')).toBe(input);
  expect(button('Fotografije uz poruku').props.accessibilityState.expanded).toBe(true);
  expect(props.chat.outbox.sendDraft).not.toHaveBeenCalled();
  expect(props.chat.refresh).not.toHaveBeenCalled();
});

it('keeps storage recovery and a forced pending-photo tray in the scroll, with the writing actions outside it', async () => {
  mockWindow = { width: 320, height: 430, fontScale: 2, scale: 3 };
  props.chat.state = { ...props.chat.state, phase: 'error', error: 'STORAGE_UNAVAILABLE' };
  props.chat.photos = { ...props.chat.photos!, hasSelection: true, versionConflict: true };
  await render();
  expect(history().findByType('AgreementPhotoComposer' as any).props.photos).toBe(props.chat.photos);
  expect(button('Fotografije uz poruku').props).toMatchObject({ disabled: true, accessibilityState: { expanded: true, disabled: true } });
  expect(text(history())).toContain('Poruka nije sačuvana na telefonu.');
  await act(async () => history().findByProps({ accessibilityLabel: 'Ponovo učitaj sačuvane poruke' }).props.onPress());
  expect(props.chat.outbox.start).toHaveBeenCalledTimes(1);
  expect(button('Pošalji poruku').props.disabled).toBe(true);
  expect(button('Napiši poruku').props.value).toBe('Moj sačuvani nacrt');
  expect(history().findAllByProps({ accessibilityLabel: 'Pošalji poruku' })).toHaveLength(0);
});

it('leaves a closed thread read-only while retaining exact unknown-outcome retry and accepted terms access', async () => {
  mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
  props.agreement = { ...agreement, stanje: 'COMPLETED' };
  props.waiting = null;
  props.chat = { ...props.chat, terminal: true, writable: false,
    state: { ...props.chat.state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] } };
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji poruku' })).toHaveLength(0);
  expect(tree.root.findAllByType('AgreementPhotoComposer' as any)).toHaveLength(0);
  expect(text(history())).toContain('Slanje nije potvrđeno');
  expect(text(history())).toContain('Dogovor je zatvoren · poruke su samo za čitanje.');
  await act(async () => button(`Ponovi slanje poruke ${command.body}`).props.onPress());
  expect(props.chat.outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
  await act(async () => button(`Uslovi Dogovora: ${agreement.naslov}`).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
});
