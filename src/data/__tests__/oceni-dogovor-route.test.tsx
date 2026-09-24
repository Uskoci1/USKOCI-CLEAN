import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Verify r4c (zaštite item 2): the rating route's fallback, shown when the id or the session is missing, names the same
// way back as the rating screen does. It always said "Nazad na Dogovore" and always went to the Dogovori list.
let mockParams: Record<string, string | undefined> = {};
let mockUser: { id: string } | null = null;
const mockBackFromReview = jest.fn(), mockBackFromReviewToHome = jest.fn(), mockBackFromReviewToAgreement = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: mockUser, accountRevision: 1 }) }));
jest.mock('../../data/serverReceipt', () => ({ uuid: (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) ? value : null }));
jest.mock('../../ui/reviews/AgreementReviewScreen', () => ({
  AgreementReviewScreen: 'AgreementReviewScreen',
  backFromReview: () => mockBackFromReview(), backFromReviewToHome: () => mockBackFromReviewToHome(),
  backFromReviewToAgreement: (id: string) => mockBackFromReviewToAgreement(id),
}));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));
jest.mock('../../ui/system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto' }));
const mockAgreement = jest.fn(async () => null);
jest.mock('../../store/uloga', () => ({ useIzvor: () => ({ dogovor: mockAgreement }) }));
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
    // The fallback (no session here) has no Dogovor it could open, so "Nazad na Dogovor" goes back, or to the list.
    mockParams = { agreementId, from };
    await render();
    const action = tree.root.findByType('V2Action' as unknown as React.ElementType);
    expect(action.props.label).toBe(label);
    // The fallback has the screen's own bar, whose arrow names the same way back.
    const bar = tree.root.findByType('DetailTopBar' as unknown as React.ElementType);
    expect(bar.props.title).toBe('Ocena saradnje'); expect(bar.props.backLabel).toBe(label);
    await act(async () => action.props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
  });
});

it('from a Dogovor, the way back opens that Dogovor even without history', async () => {
  mockUser = { id: 'account-1' }; mockParams = { agreementId };
  await render();
  const screen = tree.root.findByType('AgreementReviewScreen' as unknown as React.ElementType);
  expect(screen.props.backLabel).toBe('Nazad na Dogovor');
  screen.props.onBack();
  expect(mockBackFromReviewToAgreement).toHaveBeenCalledWith(agreementId); expect(mockBackFromReview).not.toHaveBeenCalled();
  expect(screen.props.roleOf({ uloga: 'narucilac' })).toBe('Traži pomoć');
});

it('hands the screen the same label and way back', async () => {
  mockUser = { id: 'account-1' }; mockParams = { agreementId, from: 'pocetna' };
  await render();
  const screen = tree.root.findByType('AgreementReviewScreen' as unknown as React.ElementType);
  expect(screen.props.backLabel).toBe('Nazad na Početnu');
  expect(typeof screen.props.readAgreement).toBe('function'); expect(typeof screen.props.photo).toBe('function');
  await screen.props.readAgreement(); expect(mockAgreement).toHaveBeenCalledWith(agreementId);
  screen.props.onBack();
  expect(mockBackFromReviewToHome).toHaveBeenCalledTimes(1);
});
