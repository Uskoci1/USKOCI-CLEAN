import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PKG-004 owner lifecycle wiring invariants', () => {
  const route = readFileSync(join(__dirname, '..', '..', 'app', '(app)', 'potrebe', '[id]', 'pregled.tsx'), 'utf8');
  const presentation = readFileSync(join(__dirname, '..', '..', 'ui', 'v2', 'NeedPresentation.tsx'), 'utf8');

  it('mounts lifecycle recovery from route identity instead of requiring a successful Need row', () => {
    expect(route).toContain('need={potreba} needId={id}');
    expect(route).toContain("intent === 'narucilac' && uuid(id)");
    expect(route).not.toContain('lifecycleActions={potreba && intent');
  });

  it('keeps lifecycle recovery visible while the Need read is loading or unavailable', () => {
    const loading = presentation.indexOf('Učitavamo Zadatak…');
    const unavailable = presentation.indexOf('Zadatak nije dostupan');
    const firstRecovery = presentation.indexOf('{props.lifecycleActions}', loading);
    const secondRecovery = presentation.indexOf('{props.lifecycleActions}', unavailable);
    expect(loading).toBeGreaterThan(-1);
    expect(unavailable).toBeGreaterThan(-1);
    expect(firstRecovery).toBeGreaterThan(loading);
    expect(firstRecovery).toBeLessThan(unavailable);
    expect(secondRecovery).toBeGreaterThan(unavailable);
  });

  it('requires post-command server readback to report the remaining search closed', () => {
    expect(route).toContain('const after = await read()');
    expect(route).toContain('after.podatak.remainingClosed ? after');
    expect(route).toContain('REMAINING_SEARCH_CLOSE_NOT_CONFIRMED');
  });
});
