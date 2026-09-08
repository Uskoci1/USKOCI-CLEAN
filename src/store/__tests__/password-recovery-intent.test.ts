import fs from 'node:fs';
import path from 'node:path';
import { passwordRecoveryIntent } from '../passwordRecoveryIntent';
import { captureInitialWebRecovery } from '../../bootstrap/passwordRecoveryBootstrap';
import { redirectSystemPath } from '../../app/+native-intent';

const mockClearInitial = jest.fn();
jest.mock('expo-linking', () => ({ clearInitialURL: () => mockClearInitial() }));
const link = 'uskociapp://oporavak#access_token=synthetic&refresh_token=synthetic&type=recovery';
const cleanups: (() => void)[] = [];
function subscribe(listener: () => void = jest.fn()) {
  const cleanup = passwordRecoveryIntent.subscribe(listener);
  cleanups.push(cleanup);
  return cleanup;
}
async function settle() { await new Promise<void>(done => queueMicrotask(done)); }
beforeEach(() => {
  jest.clearAllMocks();
  const existing = passwordRecoveryIntent.snapshot();
  if (existing) passwordRecoveryIntent.clear(existing.id);
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  await settle();
  const existing = passwordRecoveryIntent.snapshot();
  if (existing) passwordRecoveryIntent.clear(existing.id);
});

it('keeps only a bounded, transient snapshot and exposes nothing during server rendering', () => {
  const changed = jest.fn(); subscribe(changed);
  passwordRecoveryIntent.publish(link);
  const first = passwordRecoveryIntent.snapshot();
  expect(first?.link).toBe(link);
  expect(passwordRecoveryIntent.snapshot()).toBe(first);
  expect(passwordRecoveryIntent.serverSnapshot()).toBeNull();
  passwordRecoveryIntent.publish('x'.repeat(24_577));
  expect(passwordRecoveryIntent.snapshot()).toMatchObject({ link: '' });
  expect(changed).toHaveBeenCalledTimes(2);
});
it('cannot clear a newer callback with an old owner id', () => {
  passwordRecoveryIntent.publish(link);
  const old = passwordRecoveryIntent.snapshot()!;
  passwordRecoveryIntent.publish(link + '&new=1');
  const newer = passwordRecoveryIntent.snapshot();
  passwordRecoveryIntent.clear(old.id);
  expect(passwordRecoveryIntent.snapshot()).toBe(newer);
  passwordRecoveryIntent.clear(newer!.id);
  expect(passwordRecoveryIntent.snapshot()).toBeNull();
});
it('retains the callback across the same-turn Strict Mode unsubscribe/resubscribe', async () => {
  passwordRecoveryIntent.publish(link);
  const remove = subscribe();
  const original = passwordRecoveryIntent.snapshot();
  remove();
  subscribe();
  await settle();
  expect(passwordRecoveryIntent.snapshot()).toBe(original);
});
it('disposes only after the last actual consumer leaves', async () => {
  passwordRecoveryIntent.publish(link);
  const first = subscribe(); const last = subscribe();
  first(); await settle();
  expect(passwordRecoveryIntent.snapshot()?.link).toBe(link);
  last(); await settle();
  expect(passwordRecoveryIntent.snapshot()).toBeNull();
});
it('does not erase a newly arriving OS link during an older screen cleanup', async () => {
  passwordRecoveryIntent.publish(link);
  const remove = subscribe(); remove();
  passwordRecoveryIntent.publish(link + '&new=1');
  const newer = passwordRecoveryIntent.snapshot();
  await settle();
  expect(passwordRecoveryIntent.snapshot()).toBe(newer);
});

function browser(pathname = '/oporavak', hash = '#access_token=synthetic') {
  return {
    location: { pathname, hash, search: '', href: 'https://app.example.test' + pathname + hash, replace: jest.fn() },
    history: { state: { stalePrivatePath: 'synthetic-secret' }, replaceState: jest.fn() },
  };
}
it('removes the raw callback and stale history before exposing it to the screen, ahead of router startup', () => {
  const target = browser();
  const seen: string[] = [];
  target.history.replaceState.mockImplementation(() => { seen.push('scrub'); });
  subscribe(() => { seen.push('publish'); });
  captureInitialWebRecovery(target);
  expect(target.history.replaceState.mock.calls).toEqual([[null, '', '/oporavak']]);
  expect(seen).toEqual(['scrub', 'publish']);
  expect(passwordRecoveryIntent.snapshot()?.link).toBe(target.location.href);
  expect(target.location.replace).not.toHaveBeenCalled();
});
it.each([['/other', '#access_token=synthetic'], ['/oporavak/extra', '#secret'], ['/oporavak', '']])(
  'does not intercept an unrelated or already clean web location %s %s', (pathname, hash) => {
    const target = browser(pathname, hash); captureInitialWebRecovery(target);
    expect(target.history.replaceState).not.toHaveBeenCalled();
    expect(passwordRecoveryIntent.snapshot()).toBeNull();
  },
);
it('keeps rejected query-form callbacks out of navigation without treating them as valid recovery', () => {
  const target = browser('/oporavak', ''); target.location.search = '?error=synthetic';
  target.location.href += target.location.search;
  captureInitialWebRecovery(target);
  expect(target.history.replaceState).toHaveBeenCalledWith(null, '', '/oporavak');
  expect(passwordRecoveryIntent.snapshot()?.link).toContain('?error=synthetic');
});
it('does not retain a credential when history scrubbing fails', () => {
  const target = browser(); target.history.replaceState.mockImplementation(() => { throw new Error('blocked history'); });
  captureInitialWebRecovery(target);
  expect(target.location.replace).toHaveBeenCalledWith('/oporavak');
  expect(passwordRecoveryIntent.snapshot()).toBeNull();
});
it.each([true, false])('captures cold/warm native OS callbacks before router params exist: initial=%s', initial => {
  expect(redirectSystemPath({ path: link, initial })).toBe('/oporavak');
  expect(passwordRecoveryIntent.snapshot()?.link).toBe(link);
  expect(mockClearInitial).toHaveBeenCalledTimes(1);
});
it('normalizes an app-relative recovery callback but leaves validation to the recovery service', () => {
  const relative = '/oporavak#type=recovery&access_token=synthetic';
  expect(redirectSystemPath({ path: relative, initial: true })).toBe('/oporavak');
  expect(passwordRecoveryIntent.snapshot()?.link).toBe('uskociapp:/' + relative);
});
it.each(['uskociapp://dogovor/123', 'https://other.example/oporavak#secret', '/potrebe', 'not a URL'])('preserves unrelated app navigation: %s', value => {
  expect(redirectSystemPath({ path: value, initial: true })).toBe(value);
  expect(passwordRecoveryIntent.snapshot()).toBeNull();
  expect(mockClearInitial).not.toHaveBeenCalled();
});
it('does not reintroduce raw native URL params if clearing the initial OS link fails', () => {
  mockClearInitial.mockImplementationOnce(() => { throw new Error('native unavailable'); });
  expect(redirectSystemPath({ path: link, initial: false })).toBe('/oporavak');
  expect(passwordRecoveryIntent.snapshot()?.link).toBe(link);
});
it('registers the pre-navigation capture before the existing Expo Router entry', () => {
  const root = path.resolve(__dirname, '../../..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const entry = fs.readFileSync(path.join(root, pkg.main), 'utf8');
  expect(pkg.main).toBe('index.js');
  expect(entry.indexOf("import './src/bootstrap/passwordRecoveryBootstrap'")).toBeLessThan(entry.indexOf("import 'expo-router/entry'"));
});
