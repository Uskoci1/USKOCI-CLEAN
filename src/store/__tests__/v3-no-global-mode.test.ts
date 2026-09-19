import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import * as store from '../uloga';

/**
 * Owner decision 1 (2026-09-19): the app has no global mode. Until then a per-account preference,
 * "uloga" (MENI TREBA / JA MOGU), chose the tab shell, stood in the staleness identity of every
 * screen, gated owner actions and had to be switched before a notification of "the other side"
 * could open. This file replaces the unit tests of that preference. What they protected — that a
 * restored mode could not leak across accounts — has nothing left to protect; what needs
 * protecting now is that the mode does not come back under another name.
 */
const SRC = resolve(__dirname, '../..');
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}
const files = sources(SRC).map(path => ({ path: relative(SRC, path).replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }));

it('the store exposes the data source and nothing that reads, sets or binds a mode', () => {
  expect(Object.keys(store).sort()).toEqual(['izvorSada', 'postaviIzvor', 'useIzvor']);
});

it('no module reads or sets an app-wide mode', () => {
  const offenders = files.filter(file => /\b(useUloga|ulogaSada|postaviUlogu|promeniProstor|vezujUloguZaNalog|intentReady)\b/.test(file.text)).map(file => file.path);
  expect(offenders).toEqual([]);
});

it('nothing offers to switch the app into another mode, and no screen names one', () => {
  const offenders = files.filter(file => file.path !== 'store/uloga.ts'
    && /IntentTransition|CrossIntentNotice|MENI TREBA|JA MOGU|Meni treba|Ja mogu/.test(file.text)).map(file => file.path);
  expect(offenders).toEqual([]);
});

it('the navigator is not keyed on anything, so nothing can remount every screen beneath it', () => {
  const layout = files.find(file => file.path === 'app/(app)/_layout.tsx')!.text;
  expect(layout).not.toMatch(/<Tabs\s+key=/);
});

it('the staleness guards still fence on the account and its revision', () => {
  // Removing the mode from the guards must not have removed the guards.
  for (const path of ['hooks/useFocusedResource.ts', 'hooks/useOwnedEditor.ts', 'hooks/useAgreementOutbox.ts', 'hooks/useAgreementPhotos.ts']) {
    const text = files.find(file => file.path === path)!.text;
    expect(text).toMatch(/sesijaSada\(\)\.user\?\.id === accountId/);
    expect(text).toMatch(/sesijaSada\(\)\.accountRevision === accountRevision/);
  }
});
