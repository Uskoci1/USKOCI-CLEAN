import { readFileSync } from 'fs';
import { join } from 'path';

describe('RU-5 P0D-01 candidate projection source cutover', () => {
  it('has one production candidate read owner and no raw baseline reader', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const candidateSource = readFileSync(join(dataDir, 'candidateClientService.ts'), 'utf8');

    expect(indexSource).toContain("import { candidateClientService } from './candidateClientService';");
    expect(indexSource).toContain('...candidateClientService,');
    expect(candidateSource).toContain("supabase.rpc('rpc_list_need_candidates'");
    expect(candidateSource).toContain("type CandidateService = Pick<Izvor, 'prijaveZaPotrebu'>;");

    expect(baselineSource).toContain("| 'prijaveZaPotrebu'");
    expect(baselineSource).not.toContain('async prijaveZaPotrebu(');
    expect(baselineSource).not.toContain("from('marketplace_responses')");
  });

  it('uses server-owned canonical candidate states instead of legacy UI fiction', () => {
    const root = join(__dirname, '..', '..');
    const projections = readFileSync(join(root, 'contracts', 'projections.ts'), 'utf8');
    const r05 = readFileSync(join(root, 'app', '(app)', 'potrebe', '[id]', 'kandidati.tsx'), 'utf8');
    const legacyRoute = readFileSync(join(root, 'app', 'prijave.tsx'), 'utf8');

    for (const legacy of ['IZBORNA', 'IZABRANA', 'POPUNJENO']) {
      expect(projections).not.toContain(`'${legacy}'`);
      expect(r05).not.toContain(`"${legacy}"`);
      expect(legacyRoute).not.toContain(`'${legacy}'`);
    }

    for (const canonical of ['SELECTABLE', 'STALE', 'OVERFILL', 'SELECTED', 'WITHDRAWN', 'CLOSED', 'FULL']) {
      expect(projections).toContain(`'${canonical}'`);
    }
    expect(r05).toContain('!k.mozeIzabrati');
    expect(legacyRoute).toContain("k.stanje === 'SELECTED'");
  });
});
