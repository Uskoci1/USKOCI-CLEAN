import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OutboxSnapshot } from '../agreementOutbox';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementChat, messageSpoken } from '../../ui/AgreementChat';

const account = '10000000-0000-4000-8000-000000000001';
const agreement = '20000000-0000-4000-8000-000000000001';
const command = { accountId: account, agreementId: agreement, clientMessageId: 'poruka_retry_123', body: 'Stižem uskoro.' };
const outbox = { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined) } as any;
let state: OutboxSnapshot;
let tree: ReactTestRenderer;
let props: React.ComponentProps<typeof AgreementChat>;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
// Review r4 rd item 2: a bubble is heard as the message itself ("Ti: <tekst>, Danas, 12:00"); it was "Poruka: <ime>", which
// hid the text and the time. A bubble is found by who wrote it, the start of that label.
const held = (who: string) => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string'
  && node.props.accessibilityLabel.startsWith(`${who}: `))[0];
const scrollToEnd = jest.fn();
async function render(overrides: Partial<typeof props> = {}) {
  await act(async () => { tree = create(<AgreementChat {...props} {...overrides} />, {
    createNodeMock: element => element.type === ('ScrollView' as any) ? { scrollToEnd } : null,
  }); });
}
beforeEach(() => {
  jest.clearAllMocks();
  state = { phase: 'ready', draft: 'Nova poruka', capturing: false, entries: [], error: null };
  props = { messages: [], loading: false, error: false, writable: true, terminal: false,
    refresh: jest.fn().mockResolvedValue(undefined), refreshWorkspace: jest.fn().mockResolvedValue(undefined), outbox, state };
});
afterEach(async () => { await act(async () => tree?.unmount()); });
describe('D03 actual message component', () => {
  it('sends one explicit photo-only command and preserves a pending selection instead of silently sending text alone', async () => {
    const attachments = { agreementVersion: 3, assetIds: ['40000000-0000-4000-8000-000000000001'] };
    const photos = { loaded: true, busy: false, ready: true, hasSelection: true, agreementId: agreement,
      canSubmit: jest.fn(() => true), capture: jest.fn(() => attachments), refresh: jest.fn().mockResolvedValue(undefined) } as any;
    await render({ state: { ...state, draft: '' }, photos });
    expect(button('Pošalji poruku').props.disabled).toBe(false); expect(outbox.sendDraft).not.toHaveBeenCalled();
    await act(async () => button('Pošalji poruku').props.onPress()); expect(outbox.sendDraft).toHaveBeenCalledWith(attachments);
    expect(photos.refresh).toHaveBeenCalledTimes(1);
    const retained = button('Pošalji poruku').props.onPress;
    photos.canSubmit.mockReturnValue(false);
    await act(async () => retained()); expect(outbox.sendDraft).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, ready: false }} />));
    expect(button('Pošalji poruku').props.disabled).toBe(true);
  });
  it('reads historical photographs under exact Agreement/message IDs and refuses false local reconciliation on attachment mismatch', async () => {
    const photo = { assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const };
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 3, clientMessageId: command.clientMessageId,
      posiljalacAccountId: account, telo: command.body, moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null, fotografije: [photo] };
    const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, canSubmit: () => false } as any;
    const pending = { command: { ...command, photos: { agreementVersion: 2, assetIds: [photo.assetId] } }, state: 'unknown' as const, persisted: true, attempt: 1 };
    await render({ messages: [read], terminal: true, writable: false, photos, state: { ...state, entries: [pending] } });
    const images = tree.root.findAllByType('AuthorizedPhoto' as React.ElementType);
    expect(images[0].props).toMatchObject({ assetId: photo.assetId, agreementId: agreement, messageId: read.id });
    expect(texts()).toContain('Slanje nije potvrđeno');
    await act(async () => tree.update(<AgreementChat {...props} photos={photos} messages={[read]} state={{ ...state,
      entries: [{ ...pending, command: { ...pending.command, photos: { ...pending.command.photos, agreementVersion: 3 } } }] }} />));
    expect(texts()).not.toContain('Slanje nije potvrđeno');
  });
  it('permits explicit support selection of a photo-only message without changing its canonical empty body', async () => {
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 3, clientMessageId: 'photo_message_key',
      posiljalacAccountId: account, telo: '', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null,
      fotografije: [{ assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const }] };
    await render({ messages: [read], support: { canAct: () => true, navigate: jest.fn() } });
    // A photo-only message is heard as its photos, with its day and clock.
    expect(held('Ti').props.accessibilityLabel).toBe('Ti: 1 fotografija, Danas, 12:00');
    // The support entry no longer stands under every message; it belongs to the one being held.
    await act(async () => held('Ti').props.onLongPress());
    const entry = tree.root.findByType('SupportContextEntry' as React.ElementType).props;
    expect(entry.previewText).toContain('Privatne fotografije uz ovu poruku: 1');
    expect(entry.reference).toEqual({ kind: 'AGREEMENT_MESSAGE', id: read.id, revision: 3 }); expect(read.telo).toBe('');
    expect(outbox.sendDraft).not.toHaveBeenCalled();
  });
  // Verify r4b rd item 2: the bubble's press hides its children, so a message with text AND photos names its photos too.
  it('hears a message with text and photos as both, and a message with neither as a message without text', async () => {
    const photo = { assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const };
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 3, clientMessageId: 'photo_message_key',
      posiljalacAccountId: account, telo: 'Evo kako izgleda', moja: false, posiljalacIme: 'Milan', vremeTekst: '24. sep · 12:00', procitano: null,
      fotografije: [photo, { ...photo, assetId: '40000000-0000-4000-8000-000000000002' }] };
    await render({ messages: [read] });
    expect(held('Milan').props.accessibilityLabel).toBe('Milan: Evo kako izgleda, 2 fotografije, 24. sep, 12:00');
    expect(messageSpoken({ moja: true, posiljalacIme: 'Ja', telo: '', fotografije: [] }, { day: null, clock: '12:00' })).toBe('Ti: poruka bez teksta, 12:00');
  });
  it('shows latest history initially, preserves an older reading position, and follows an explicit outgoing message', async () => {
    await render();
    const scroll = tree.root.findByType('ScrollView' as any);
    await act(async () => scroll.props.onContentSizeChange(300, 3000));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    scrollToEnd.mockClear();
    await act(async () => scroll.props.onScroll({ nativeEvent: {
      contentOffset: { y: 400 }, layoutMeasurement: { height: 600 }, contentSize: { height: 3000 },
    } }));
    await act(async () => scroll.props.onContentSizeChange(300, 3200));
    expect(scrollToEnd).not.toHaveBeenCalled();
    const sending: OutboxSnapshot = { ...state, entries: [{ command, state: 'sending', persisted: true, attempt: 1 }] };
    await act(async () => tree.update(<AgreementChat {...props} state={sending} />));
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    scrollToEnd.mockClear();
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...sending,
      entries: [{ ...sending.entries[0], state: 'unknown' }] }} />));
    expect(scrollToEnd).not.toHaveBeenCalled();
    await act(async () => scroll.props.onLayout());
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    expect(outbox.sendDraft).not.toHaveBeenCalled();
    expect(outbox.retry).not.toHaveBeenCalled();
  });
  it('distinguishes successful empty, loading and failed reads', async () => {
    await render(); expect(texts()).toContain('Napiši prvu poruku');
    await act(async () => tree.update(<AgreementChat {...props} error />));
    expect(texts()).toContain('Poruke nisu učitane'); expect(texts()).not.toContain('Napiši prvu poruku');
    await act(async () => button('Ponovo učitaj poruke').props.onPress());
    expect(props.refresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AgreementChat {...props} loading />));
    expect(texts()).not.toContain('Napiši prvu poruku');
  });
  it('preserves composer text in offline/error state and keeps it outside the history scroller', async () => {
    await render({ error: true });
    expect(button('Napiši poruku').props.value).toBe('Nova poruka');
    const scroll = tree.root.findByType('ScrollView' as any);
    expect(scroll.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
    // The screen owns the one KAV; a nested KAV loses the header origin on Android.
    expect(tree.root.findAllByType('KeyboardAvoidingView' as any)).toHaveLength(0);
    expect(button('Pošalji poruku')).toBeTruthy();
  });
  it('returns to the photo controls when explicitly opening them from older history', async () => {
    const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, items: [], message: null,
      versionConflict: false, canSubmit: () => false, capture: () => null } as any;
    await render({ photos });
    const scroll = tree.root.findByProps({ testID: 'agreement-chat-history' });
    await act(async () => scroll.props.onContentSizeChange(300, 3000));
    await act(async () => scroll.props.onScroll({ nativeEvent: {
      contentOffset: { y: 400 }, layoutMeasurement: { height: 300 }, contentSize: { height: 3000 },
    } }));
    scrollToEnd.mockClear();
    await act(async () => button('Fotografije uz poruku').props.onPress());
    expect(scroll.findByType('AgreementPhotoComposer' as any).props.photos).toBe(photos);
    await act(async () => scroll.props.onContentSizeChange(300, 3600));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(outbox.sendDraft).not.toHaveBeenCalled();
  });
  it('unknown delivery has exact-command retry and no invented sent/read state', async () => {
    state = { ...state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] };
    await render({ state });
    expect(texts()).toContain('Slanje nije potvrđeno'); expect(texts()).not.toContain('Poslato');
    expect(texts()).not.toContain('Pročitano'); expect(texts()).not.toContain('Isporučeno');
    await act(async () => button(`Ponovi slanje poruke ${command.body}`).props.onPress());
    expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
  });
  it('an in-flight message does not block composing another message', async () => {
    await render({ state: { ...state, entries: [{ command, state: 'sending', persisted: true, attempt: 1 }] } });
    expect(button('Pošalji poruku').props.disabled).toBe(false);
    await act(async () => button('Pošalji poruku').props.onPress());
    expect(outbox.sendDraft).toHaveBeenCalledTimes(1);
  });
  it('terminal state blocks new text/send but leaves unknown-intent retry', async () => {
    await render({ terminal: true, writable: false, state: { ...state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] } });
    // A finished Dogovor draws no field and no send at all (owner, 2026-09-23); the one line says it is read-only.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji poruku' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži status Dogovora' })).toHaveLength(0);
    expect(texts()).toContain('samo za čitanje');
    await act(async () => button(`Ponovi slanje poruke ${command.body}`).props.onPress());
    expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
  });
  it('server reconciliation suppresses the local duplicate only for matching sender/key/body', async () => {
    const pending = { command, state: 'unknown' as const, persisted: true, attempt: 1 };
    const read = { id: 'message-1', clientMessageId: command.clientMessageId, posiljalacAccountId: account,
      telo: command.body, moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null };
    await render({ state: { ...state, entries: [pending] }, messages: [read] });
    expect(texts().split(command.body)).toHaveLength(2);
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, entries: [pending] }} messages={[{ ...read, posiljalacAccountId: 'another-account' }]} />));
    expect(texts().split(command.body)).toHaveLength(3);
  });
  it('uses Unicode code points for the 2,000-character limit and preserves over-limit text', async () => {
    await render({ state: { ...state, draft: '😀'.repeat(2000) } });
    expect(button('Pošalji poruku').props.disabled).toBe(false);
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, draft: '😀'.repeat(2001) }} />));
    expect(button('Pošalji poruku').props.disabled).toBe(true);
    expect(button('Napiši poruku').props.value).toBe('😀'.repeat(2001));
    expect(texts()).toContain('skrati poruku');
  });
  it('shows actionable storage failure and retains the draft', async () => {
    await render({ state: { ...state, phase: 'error', error: 'STORAGE_UNAVAILABLE' } });
    expect(button('Pošalji poruku').props.disabled).toBe(true);
    expect(button('Napiši poruku').props.value).toBe('Nova poruka');
    await act(async () => button('Ponovo učitaj sačuvane poruke').props.onPress());
    expect(outbox.start).toHaveBeenCalledTimes(1);
  });
  it('offers only a canonical selected historical message, with its persisted version independent of current writable state', async () => {
    const support = { canAct: jest.fn(() => true), navigate: jest.fn() };
    const read = { id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 2, clientMessageId: null,
      posiljalacAccountId: account, telo: 'Samo ova stara poruka.', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null };
    await render({ messages: [read], terminal: true, writable: false, support });
    // The support entry no longer stands under every message; it belongs to the one being held.
    await act(async () => held('Ti').props.onLongPress());
    // It stands under the bubble as a sibling, never inside the bubble's press, so a screen reader reaches its buttons.
    const supportNode = tree.root.findByType('SupportContextEntry' as React.ElementType);
    expect(held('Ti').findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
    expect(supportNode.props.label).toBe('Izaberi ovu poruku za podršku');
    const entry = supportNode.props;
    expect(entry.reference).toEqual({ kind: 'AGREEMENT_MESSAGE', id: read.id, revision: 2 });
    expect(entry.previewText).toBe(read.telo); expect(entry.canAct()).toBe(true);
    expect(outbox.sendDraft).not.toHaveBeenCalled(); expect(support.navigate).not.toHaveBeenCalled();
    await act(async () => tree.update(<AgreementChat {...props} messages={[{ ...read, dogovorVerzija: 5 }]} support={support} />));
    expect(entry.canAct()).toBe(false);
    expect(tree.root.findByType('SupportContextEntry' as React.ElementType).props.reference.revision).toBe(5);
  });
  // Owner step 8: a calm, modern conversation. The other person on the left on the wash, mine on the right on pale green,
  // the clock small and muted, a day named once above its messages, and a floating pill composer.
  describe('the look of the conversation', () => {
    const { sys } = require('../../ui/system/tokens');
    const { messageMoment } = require('../../ui/AgreementChat');
    const flat = (style: unknown): Record<string, unknown> => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : (style as Record<string, unknown>) ?? {};
    const other = '10000000-0000-4000-8000-000000000002';
    const message = (id: string, moja: boolean, telo: string, vremeTekst: string) => ({ id: `30000000-0000-4000-8000-00000000000${id}`, dogovorVerzija: 1,
      clientMessageId: null, posiljalacAccountId: moja ? account : other, posiljalacIme: moja ? 'Ja' : 'Marko', moja, telo, vremeTekst, procitano: null });
    const bubble = (sender: string) => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string'
      && node.props.accessibilityLabel.startsWith(`${sender}: `));
    const lines = () => tree.root.findAll(node => String(node.type) === 'T').map(node => node.children.filter(child => typeof child === 'string').join(''));
    it('reads the day and the clock from the words the read wrote, and invents no day', () => {
      expect(messageMoment('23. sep · 14:05')).toEqual({ day: '23. sep', clock: '14:05' });
      expect(messageMoment('23. sep 2025 · 09:00')).toEqual({ day: '23. sep 2025', clock: '09:00' });
      expect(messageMoment('14:05')).toEqual({ day: 'Danas', clock: '14:05' });
      expect(messageMoment('sada')).toEqual({ day: null, clock: 'sada' });
    });
    it('names each day once above its messages and puts only the clock in a bubble', async () => {
      await render({ messages: [message('1', false, 'Stižem u 10.', '23. sep · 09:40'), message('2', true, 'Važi.', '23. sep · 09:41'),
        message('3', false, 'Evo me.', '10:02'), message('4', false, 'Kod ulaza sam.', '10:03')] });
      const days = tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
      expect(days).toEqual(['23. sep', 'Danas']);
      expect(lines()).toEqual(expect.arrayContaining(['09:40', '09:41', '10:02', '10:03']));
      expect(lines().some(line => line.includes('23. sep ·'))).toBe(false);
    });
    it('distinguishes speakers with readable white and forest surfaces while keeping names and times in the spoken message', async () => {
      await render({ messages: [message('1', false, 'Zdravo', '10:00'), message('2', true, 'Ćao', '10:01')] });
      expect(flat(bubble('Marko')[0].props.style)).toMatchObject({ alignSelf: 'flex-start', backgroundColor: sys.conversation.surface,
        borderWidth: 1, borderColor: sys.conversation.edge });
      expect(flat(bubble('Ti')[0].props.style)).toMatchObject({ alignSelf: 'flex-end', backgroundColor: sys.conversation.user });
      // The name is heard with the bubble, not drawn in it: the bar above already names the person. Review r4 rd item 2:
      // what the bubble says and when is heard with it too.
      expect(bubble('Marko')[0].props.accessibilityLabel).toBe('Marko: Zdravo, Danas, 10:00');
      expect(bubble('Ti')[0].props.accessibilityLabel).toBe('Ti: Ćao, Danas, 10:01');
      expect(lines()).not.toContain('Marko');
      const clock = tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('10:00'))[0];
      expect(flat(clock.props.style)).toMatchObject({ fontSize: 12, color: sys.color.muted });
      const mine = bubble('Ti')[0].findAll(node => String(node.type) === 'T');
      expect(mine.map(node => flat(node.props.style).color)).toEqual([sys.conversation.onUser, sys.conversation.onUser]);
      expect(texts()).not.toContain('Povuci naniže');
    });
    it('gives the multiline draft a full row above the toolbar while keeping the send state and target intact', async () => {
      await render();
      const send = button('Pošalji poruku');
      expect(flat(send.props.style)).toMatchObject({ width: 48, height: 48 });
      const circle = (node: typeof send) => flat(node.findAll(child => String(child.type) === 'View')[0].props.style);
      expect(circle(send).backgroundColor).toBe(sys.color.green); expect(flat(send.props.style).opacity).toBeUndefined();
      const toolbar = send.parent!;
      const pill = toolbar.parent!;
      expect(flat(toolbar.props.style)).toMatchObject({ minHeight: 48, flexDirection: 'row' });
      expect(flat(pill.props.style)).toMatchObject({ backgroundColor: sys.conversation.surface, borderRadius: sys.radius.sheet });
      const input = pill.findByProps({ accessibilityLabel: 'Napiši poruku' });
      expect(input.props.multiline).toBe(true);
      expect(input.parent).toBe(pill);
      expect(pill.children.indexOf(input)).toBeLessThan(pill.children.indexOf(toolbar));
      expect(toolbar.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} state={{ ...state, draft: '' }} />));
      expect(button('Pošalji poruku').props.disabled).toBe(true);
      expect(circle(button('Pošalji poruku')).backgroundColor).toBe(sys.color.control);
    });
    it('keeps the photo tools behind the pill\'s "+" and never hides a chosen photo', async () => {
      const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, items: [], message: null,
        versionConflict: false, canSubmit: () => false, capture: () => null, refresh: jest.fn() } as any;
      await render({ photos });
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      // Review r4 rd item 6: the state also says whether the control can fold the panel ("disabled" while a photo holds it).
      expect(button('Fotografije uz poruku').props.accessibilityState).toEqual({ expanded: false, disabled: false });
      await act(async () => button('Fotografije uz poruku').props.onPress());
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(1);
      expect(button('Fotografije uz poruku').props.accessibilityState).toEqual({ expanded: true, disabled: false });
      await act(async () => button('Fotografije uz poruku').props.onPress());
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, hasSelection: true }} />));
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(1);
      // A closed Dogovor draws no photo tools at all.
      await act(async () => tree.update(<AgreementChat {...props} terminal writable={false} photos={{ ...photos, hasSelection: true }} />));
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Fotografije uz poruku' })).toHaveLength(0);
    });
    // Review r4 rd item 6: while a photo is chosen the panel cannot fold away, so the control says so (a disabled X)
    // instead of swapping its icon for nothing; after a send the tools fold back behind the "+".
    it('never offers a "+" that does nothing, and folds the photo tools away after a send', async () => {
      const photos = { loaded: true, busy: false, ready: true, hasSelection: false, agreementId: agreement, items: [], message: null,
        versionConflict: false, canSubmit: () => true, capture: () => null, refresh: jest.fn().mockResolvedValue(undefined) } as any;
      await render({ photos });
      await act(async () => button('Fotografije uz poruku').props.onPress());
      expect(button('Fotografije uz poruku').props.accessibilityState).toEqual({ expanded: true, disabled: false });
      await act(async () => button('Pošalji poruku').props.onPress());
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(0);
      expect(button('Fotografije uz poruku').props.accessibilityState).toEqual({ expanded: false, disabled: false });
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, hasSelection: true }} />));
      expect(button('Fotografije uz poruku').props).toMatchObject({ disabled: true, accessibilityState: { expanded: true, disabled: true } });
      expect(tree.root.findAllByType('AgreementPhotoComposer' as React.ElementType)).toHaveLength(1);
      // Verify r4b rd item 6: the disabled X says what holds the panel open, by its real cause.
      expect(button('Fotografije uz poruku').props.accessibilityHint).toBe('Ostaje otvoreno dok fotografije čekaju slanje.');
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, message: 'Dozvoli pristup kameri.' }} />));
      expect(button('Fotografije uz poruku').props.accessibilityHint).toBe('Ostaje otvoreno dok je prikazana poruka o fotografijama.');
      await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, versionConflict: true, items: [{}] }} />));
      expect(button('Fotografije uz poruku').props.accessibilityHint).toBe('Ostaje otvoreno dok ne ukloniš fotografije pripremljene za raniju verziju Dogovora.');
      await act(async () => tree.update(<AgreementChat {...props} photos={photos} />));
      expect(button('Fotografije uz poruku').props.accessibilityHint).toBeUndefined();
    });
    // Review r4 rd item 4: with no live update and a pull a screen reader cannot easily make, the refresh is an action.
    // Verify r4b rd item 4 (was: no action in the empty thread, and one on a closed Dogovor): the empty thread is where
    // someone waits for the other side's first message, so it has the action; a closed Dogovor takes no new message, a
    // failed read has its own retry, and the first read's spinner stands alone.
    it('offers a quiet refresh at the head of the thread and in the empty thread, and none where nothing new can come', async () => {
      await render({ messages: [message('1', false, 'Zdravo', '10:00')] });
      await act(async () => button('Osveži poruke').props.onPress());
      expect(props.refresh).toHaveBeenCalledTimes(1);
      await act(async () => tree.update(<AgreementChat {...props} messages={[]} />));
      expect(texts()).toContain('Napiši prvu poruku');
      // Verify r4c item 2: in the empty thread the action stands under the empty state's words, never above its drawing.
      expect(texts().indexOf('Osveži poruke')).toBeGreaterThan(texts().indexOf('Poruke vide samo učesnici ovog Dogovora.'));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' }).filter(node => String(node.type) === 'Press')).toHaveLength(1);
      await act(async () => button('Osveži poruke').props.onPress());
      expect(props.refresh).toHaveBeenCalledTimes(2);
      await act(async () => tree.update(<AgreementChat {...props} terminal writable={false} messages={[message('1', false, 'Zdravo', '10:00')]} />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' })).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} error />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' })).toHaveLength(0);
      await act(async () => tree.update(<AgreementChat {...props} loading messages={[]} />));
      expect(tree.root.findAllByProps({ accessibilityLabel: 'Osveži poruke' })).toHaveLength(0);
    });
    // Review r4 rd item 8: the first read's spinner stands in the middle, like every other state.
    it('centres the first read and sits a read thread on the composer', async () => {
      const container = () => flat(tree.root.findAll(node => String(node.type) === 'ScrollView')[0].props.contentContainerStyle);
      await render({ loading: true });
      expect(container().justifyContent).toBe('center');
      await act(async () => tree.update(<AgreementChat {...props} messages={[message('1', false, 'Zdravo', '10:00')]} />));
      expect(container().justifyContent).toBe('flex-end');
    });
    it('keeps a failed send in place with its reason and the retry of that exact message', async () => {
      await render({ messages: [message('1', false, 'Zdravo', '10:00')],
        state: { ...state, entries: [{ command, state: 'failed', error: 'UNAVAILABLE', persisted: true, attempt: 2 }] } });
      expect(texts()).toContain('Nije poslato'); expect(texts()).toContain('Veza je prekinuta. Slanje još nije potvrđeno.');
      await act(async () => button(`Ponovi slanje poruke ${command.body}`).props.onPress());
      expect(outbox.retry).toHaveBeenCalledWith(command.clientMessageId); expect(props.refresh).toHaveBeenCalledTimes(1);
    });
    it('says a closed Dogovor is closed, true of a finished and of a cancelled one', async () => {
      await render({ terminal: true, writable: false });
      expect(texts()).toContain('Dogovor je zatvoren · poruke su samo za čitanje.'); expect(texts()).not.toContain('završen');
    });
  });
  it('does not select an unconfirmed local outbox item, failed read, or missing message version', async () => {
    const support = { canAct: () => true, navigate: jest.fn() };
    await render({ support, state: { ...state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] },
      messages: [{ id: '30000000-0000-4000-8000-000000000001', telo: 'Legacy display', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null }] });
    expect(tree.root.findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
    await act(async () => tree.update(<AgreementChat {...props} support={support} error messages={[{ id: '30000000-0000-4000-8000-000000000001', dogovorVerzija: 2,
      telo: 'Stale read', moja: true, posiljalacIme: 'Ja', vremeTekst: '12:00', procitano: null }]} />));
    expect(tree.root.findAllByType('SupportContextEntry' as React.ElementType)).toHaveLength(0);
  });
});
