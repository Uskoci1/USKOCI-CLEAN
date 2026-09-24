import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The round 5 device-check gallery (owner step 11b): every scene renders the real presentation components from fixtures
// without throwing, returns to the scene list, and reaches no data service or navigation.
const mockBack = jest.fn(), mockPush = jest.fn(), mockReplace = jest.fn(), mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a),
  navigate: (...a: unknown[]) => mockNavigate(...a), canGoBack: () => true }, useFocusEffect: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/data/supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('unexpected transport'); } }));
jest.mock('../src/data/supportCaseClientService', () => ({ supportCaseClientService: new Proxy({}, { get: () => () => { throw new Error('unexpected support read'); } }) }));
jest.mock('../src/data/agreementClientService', () => ({ agreementClientService: { mojiDogovori: () => { throw new Error('unexpected agreement read'); } } }));
import Gallery from '../src/app/dizajn-privatnost';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const scenes = () => tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityRole === 'button'
  && /^[A-ZŠĐČĆŽ][^:]+: /.test(node.props.accessibilityLabel) && typeof node.type !== 'string').map(node => node.props.accessibilityLabel as string);

it('reaches every scene by its visible label and comes back to the list with "Nazad"', async () => {
  await act(async () => { tree = create(<Gallery />); });
  const labels = [...new Set(scenes())];
  expect(labels.length).toBeGreaterThanOrEqual(45);
  for (const label of labels) {
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress());
    const back = tree.root.findAll(node => node.props.accessibilityLabel === 'Nazad' && typeof node.props.onPress === 'function');
    expect(back.length).toBeGreaterThan(0);
    await act(async () => back[back.length - 1].props.onPress());
    expect(scenes()).toContain(label);
  }
  expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
// It walks all 45 scenes in one test: a longer budget than a single-screen test, so a loaded machine does not fail it.
}, 60_000);

it('the closure start in the gallery asks its real question and starts nothing', async () => {
  await act(async () => { tree = create(<Gallery />); });
  await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Zatvaranje: Pregled spreman' && typeof node.props.onPress === 'function')[0].props.onPress());
  await act(async () => tree.root.findAll(node => node.props.label === 'Pokreni zatvaranje naloga')[0].props.onPress());
  const confirm = tree.root.findByProps({ testID: 'confirm-sheet-confirm' });
  expect(confirm.props.accessibilityLabel).toBe('Da, trajno zatvori nalog');
  await act(async () => confirm.props.onPress());
  expect(mockPush).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
});
