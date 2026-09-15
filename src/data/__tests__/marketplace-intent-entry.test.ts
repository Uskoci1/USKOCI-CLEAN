import { readFileSync } from 'node:fs';

const source = readFileSync(require.resolve('../../app/(app)/prilike.tsx'), 'utf8');

test('public discovery exposes explicit new-task action in both intents and switches worker intent before replacing route', () => {
  expect(source).toContain("postaviUlogu, ulogaSada");
  expect(source).toContain("onSwitch={() => navigate(() => {");
  expect(source).toContain("if (intent === 'narucilac') router.navigate('/potrebe');");
  expect(source).toContain("else { postaviUlogu('narucilac'); router.replace('/potrebe'); }");
  expect(source).toContain("onNew={() => navigate(() => {");
  expect(source).toContain("if (intent === 'narucilac') router.navigate('/nova');");
  expect(source).toContain("else { postaviUlogu('narucilac'); router.replace('/nova'); }");
  expect(source).not.toContain("onNew={intent === 'narucilac'");
});
