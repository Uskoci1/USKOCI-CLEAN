import { readFileSync } from 'node:fs';

const source = readFileSync(require.resolve('../../app/(app)/prilike.tsx'), 'utf8');

/** Owner decision 2 (2026-09-16): no silent MENI TREBA ↔ JA MOGU switch from "+" or "Moji". */
test('public discovery keeps the explicit new-task and owned-tasks entries in both intents, but a worker is asked before any intent switch', () => {
  expect(source).toContain("import { izvorSada, postaviUlogu, ulogaSada, useIzvor, useUloga } from '../../store/uloga';");
  expect(source).toContain("import { IntentTransition, type IntentTransitionRequest } from '../../ui/system/IntentTransition';");
  expect(source).toContain("if (intent === 'narucilac') navigate(() => router.navigate('/potrebe'));");
  expect(source).toContain("if (intent === 'narucilac') navigate(() => router.navigate('/nova'));");
  expect(source).toContain("else ask({ target: 'narucilac', confirmLabel: 'Pređi na moje Zadatke', go: () => router.replace('/potrebe'),");
  expect(source).toContain("else ask({ target: 'narucilac', confirmLabel: 'Pređi i napravi Zadatak', go: () => router.replace('/nova'),");
  // The one store writer runs only inside the confirmed transition, guarded by the same ownership check as navigation.
  expect(source.match(/postaviUlogu\(/g)).toHaveLength(1);
  expect(source).toContain("if (pending) navigate(() => { postaviUlogu(pending.target); pending.go(); });");
  expect(source).toContain('<IntentTransition request={transition} current={intent} onConfirm={confirmTransition} onCancel={() => setTransition(null)} />');
  expect(source).not.toContain("onNew={intent === 'narucilac'");
  expect(source).not.toContain("else { postaviUlogu('narucilac');");
});
