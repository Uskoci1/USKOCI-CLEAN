import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Verify r4c (zaštite item 2): the rating route's fallback, shown when the id or the session is missing, names the same
// way back as the rating screen does. It always said "Nazad na Dogovore" and always went to the Dogovori list.
let mockParams: Record<string, string | undefined> = {};
let mockUser: { id: string } | null = null;
const mockBackFromReview = jest.fn(), mockBackFromReviewToHome = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: mockUser, accountRevision: 1 }) }));
jest.mock('../../data/serverReceipt', () => ({ uuid: (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) ? value : null }));
jest.mock('../../ui/reviews/AgreementReviewScreen', () => ({
  AgreementReviewScreen: 'AgreementReviewScreen',
  backFromReview: () => mockBackFromReview(), backFromReviewToHome: () => mockBackFromReviewToHome(),
}));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));
import OceniDogovor from '../../app/(app)/oceni-dogovor';

const agreementId = '11111111-1111-4111-8111-111111111111';
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<OceniDogovor />); }); };
beforeEach(() => { jest.clearAllMocks(); mockUser = null; });
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the fallback names the way back it takes', () => {
  it.each([
    ['pocetna', 'Nazad na Početnu', mockBackFromReviewToHome],
    ['dogovori', 'Nazad na Dogovore', mockBackFromReview],
    [undefined, 'Nazad na Dogovor', mockBackFromReview],
  ])('from %s', async (from, label, back) => {
    mockParams = { agreementId, from };
    await render();
    const action = tree.root.findByType('V2Action' as unknown as React.ElementType);
    expect(action.props.label).toBe(label);
    await act(async () => action.props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
  });
});

it('hands the screen the same label and way back', async () => {
  mockUser = { id: 'account-1' }; mockParams = { agreementId, from: 'pocetna' };
  await render();
  const screen = tree.root.findByType('AgreementReviewScreen' as unknown as React.ElementType);
  expect(screen.props.backLabel).toBe('Nazad na Početnu');
  screen.props.onBack();
  expect(mockBackFromReviewToHome).toHaveBeenCalledTimes(1);
});
