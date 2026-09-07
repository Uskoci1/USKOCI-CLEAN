import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockRevision = 0;
const mockAccount = '10000000-0000-4000-8000-000000000001';
const mockAgreement = '20000000-0000-4000-8000-000000000001';
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockSend = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: (...args: unknown[]) => mockGet(...args), setItem: (...args: unknown[]) => mockSet(...args) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => 'narucilac', ulogaSada: () => 'narucilac' }));
jest.mock('../agreementMessageClientService', () => ({ agreementMessageClientService: { send: (...args: unknown[]) => mockSend(...args) } }));
import { useAgreementOutbox } from '../../hooks/useAgreementOutbox';
let current: ReturnType<typeof useAgreementOutbox>;
function Harness() { current = useAgreementOutbox(mockAccount, mockAgreement, true); return null; }
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
it('hook-bound monotonic ownership rejects dispatch after batched A→B→A while durable capture waits', async () => {
  mockRevision = 0; mockGet.mockResolvedValue(null); mockSend.mockReset();
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  mockSet.mockImplementation(() => waiting);
  await act(async () => { tree = create(<Harness />); });
  let sending!: Promise<void>;
  await act(async () => { current.model.setDraft('Sačuvaj ovaj tekst.'); sending = current.model.sendDraft(); });
  expect(mockSet).toHaveBeenCalledTimes(1);
  mockRevision += 2;
  await act(async () => { release(); await sending; });
  expect(mockSend).not.toHaveBeenCalled();
});
