// Voice messages B2-a (2026-09-30): the voice outbox hook binds the SAME outbox model to the voice journal namespace and the same message port.
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockRevision = 0;
const mockAccount = '10000000-0000-4000-8000-000000000001';
const mockAgreement = '20000000-0000-4000-8000-000000000001';
const mockAsset = '40000000-0000-4000-8000-0000000000aa';
const mockGet = jest.fn(), mockSet = jest.fn(), mockSend = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: (...args: unknown[]) => mockGet(...args), setItem: (...args: unknown[]) => mockSet(...args) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../agreementMessageClientService', () => ({ agreementMessageClientService: { send: (...args: unknown[]) => mockSend(...args) } }));
import { useAgreementOutbox, useAgreementVoiceOutbox } from '../../hooks/useAgreementOutbox';
let voice: ReturnType<typeof useAgreementVoiceOutbox>, text: ReturnType<typeof useAgreementOutbox>;
function Harness({ writable = true }: { writable?: boolean }) { voice = useAgreementVoiceOutbox(mockAccount, mockAgreement, writable); text = useAgreementOutbox(mockAccount, mockAgreement, writable); return null; }
let tree: ReactTestRenderer;
beforeEach(() => {
  mockRevision = 0; mockGet.mockReset(); mockSet.mockReset(); mockSend.mockReset();
  const store = new Map<string, string>(); // a real durable store: the outbox reads its own record back before every later write
  mockGet.mockImplementation(async (key: string) => store.get(key) ?? null);
  mockSet.mockImplementation(async (key: string, value: string) => { store.set(key, value); });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('sends a voice intent from its own journal key with the exact command, never touching the text journal', async () => {
  mockSend.mockResolvedValue({ messageId: '30000000-0000-4000-8000-000000000001' });
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { await voice.model.sendVoice({ agreementVersion: 2, assetId: mockAsset }); });
  const keys = mockSet.mock.calls.map(call => call[0] as string);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(key => key === `uskoci:agreement-voice-outbox:v1:${mockAccount}:${mockAgreement}`)).toBe(true);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][0]).toMatchObject({ accountId: mockAccount, agreementId: mockAgreement, body: '', voice: { agreementVersion: 2, assetId: mockAsset } });
  expect(mockSend.mock.calls[0][0].clientMessageId).toMatch(/^glas_/);
  expect(voice.model.getSnapshot().entries).toHaveLength(1); expect(voice.model.getSnapshot().entries[0].state).toBe('confirmed');
  expect(text.model.getSnapshot().entries).toHaveLength(0);
});
it('the text hook refuses a voice intent and keeps its own exact keys', async () => {
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { await text.model.sendVoice({ agreementVersion: 2, assetId: mockAsset }); });
  expect(mockSend).not.toHaveBeenCalled(); expect(text.model.getSnapshot().error).toBe('INVALID_MESSAGE');
  await act(async () => { text.model.setDraft('Zdravo'); await Promise.resolve(); });
  await act(async () => { await text.model.sendDraft(); });
  const keys = mockSet.mock.calls.map(call => call[0] as string);
  expect(keys.some(key => key.startsWith('uskoci:agreement-outbox:v1:'))).toBe(true);
  expect(keys.some(key => key.includes('voice'))).toBe(false);
});
it('a read-only Agreement refuses a voice intent without persisting it', async () => {
  await act(async () => { tree = create(<Harness writable={false} />); });
  await act(async () => { await voice.model.sendVoice({ agreementVersion: 2, assetId: mockAsset }); });
  expect(mockSend).not.toHaveBeenCalled(); expect(voice.model.getSnapshot().error).toBe('READ_ONLY');
  expect(mockSet.mock.calls.filter(call => String(call[0]).includes('voice-outbox'))).toHaveLength(0);
});
it('a changed account incarnation drops the voice model, so an old intent can never be dispatched by the new one', async () => {
  let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
  mockSet.mockImplementation(() => waiting);
  await act(async () => { tree = create(<Harness />); });
  let sending!: Promise<void>;
  await act(async () => { sending = voice.model.sendVoice({ agreementVersion: 2, assetId: mockAsset }); });
  mockRevision += 2;
  await act(async () => { release(); await sending; });
  expect(mockSend).not.toHaveBeenCalled();
});
