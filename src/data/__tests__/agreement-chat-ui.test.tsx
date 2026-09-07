import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OutboxSnapshot } from '../agreementOutbox';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('phosphor-react-native', () => ({ PaperPlaneTilt: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { AgreementChat } from '../../ui/AgreementChat';

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
    await render(); expect(texts()).toContain('Još nema poruka.');
    await act(async () => tree.update(<AgreementChat {...props} error />));
    expect(texts()).toContain('Poruke nisu učitane'); expect(texts()).not.toContain('Još nema poruka.');
    await act(async () => button('Ponovo učitaj poruke').props.onPress());
    expect(props.refresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AgreementChat {...props} loading />));
    expect(texts()).not.toContain('Još nema poruka.');
  });
  it('preserves composer text in offline/error state and keeps it outside the history scroller', async () => {
    await render({ error: true });
    expect(button('Napišite poruku').props.value).toBe('Nova poruka');
    const scroll = tree.root.findByType('ScrollView' as any);
    expect(scroll.findAllByProps({ accessibilityLabel: 'Napišite poruku' })).toHaveLength(0);
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
    expect(button('Napišite poruku').props.editable).toBe(false);
    expect(button('Pošalji poruku').props.disabled).toBe(true);
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
    expect(button('Napišite poruku').props.value).toBe('😀'.repeat(2001));
    expect(texts()).toContain('skratite poruku');
  });
  it('shows actionable storage failure and retains the draft', async () => {
    await render({ state: { ...state, phase: 'error', error: 'STORAGE_UNAVAILABLE' } });
    expect(button('Pošalji poruku').props.disabled).toBe(true);
    expect(button('Napišite poruku').props.value).toBe('Nova poruka');
    await act(async () => button('Ponovo učitaj sačuvane poruke').props.onPress());
    expect(outbox.start).toHaveBeenCalledTimes(1);
  });
});
