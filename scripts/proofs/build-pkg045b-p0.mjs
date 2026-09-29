#!/usr/bin/env node
/**
 * Deterministic builder of the PKG045b candidate that is compatible with the APPLIED Discovery P0 exact-public landing.
 *
 *   node scripts/proofs/build-pkg045b-p0.mjs             write supabase/candidates/pkg045b_task_column_privileges_p0.sql
 *   node scripts/proofs/build-pkg045b-p0.mjs --check     fail unless the committed file equals the composition
 *   node scripts/proofs/build-pkg045b-p0.mjs --stdout    print the composition
 *   node scripts/proofs/build-pkg045b-p0.mjs --rehearsal print the composition with its final COMMIT turned into ROLLBACK
 *
 * Why: the proven PKG045b (pkg045b_task_column_privileges.sql) pins the body of public.rpc_list_open_tasks_v3 to the
 * PKG045a version (md5 18b55181…). Discovery P0 (applied to canonical DEV as ledger 206, one function replacement) legitimately
 * replaced that body (md5 602113d5…, pinned in the P0 candidate), so the original candidate would refuse on the current DEV
 * with PKG045_BODY_MISMATCH. This builder changes exactly that ONE pin and nothing else; every other byte of the proven
 * candidate is preserved. Both source files are sha256-pinned (line endings normalised to LF, as CI checks them out).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const SOURCE = { path: 'supabase/candidates/pkg045b_task_column_privileges.sql' };
export const P0 = { path: 'supabase/candidates/discovery_p0_exact_public_landing.sql' };
export const OUTPUT = 'supabase/candidates/pkg045b_task_column_privileges_p0.sql';
export const OLD_PIN = '18b5518140c519b96728d1e25fa3c29d';
export const NEW_PIN = '602113d52d64c775893752ff74bfc324';

const lf = (text) => text.replace(/\r\n/g, '\n');
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export function compose() {
  const source = lf(readFileSync(SOURCE.path, 'utf8'));
  const p0 = lf(readFileSync(P0.path, 'utf8'));
  if (!p0.includes(NEW_PIN)) throw new Error('PKG045B_P0_PIN_NOT_IN_P0_CANDIDATE');
  const parts = source.split(`'${OLD_PIN}'`);
  if (parts.length !== 2) throw new Error(`PKG045B_P0_OLD_PIN_COUNT:${parts.length - 1}`);
  const changed = parts.join(`'${NEW_PIN}'`);
  const header = [
    '-- PKG-045b compatible with the applied Discovery P0 exact-public landing. Composed by scripts/proofs/build-pkg045b-p0.mjs; do not edit by hand.',
    `-- Source: ${SOURCE.path} sha256 ${sha(source)} (the proven PKG045b). The ONLY change: the pinned body md5 of`,
    `-- public.rpc_list_open_tasks_v3 ${OLD_PIN} (PKG045a) -> ${NEW_PIN} (Discovery P0, ledger 206, pinned in ${P0.path}).`,
    '-- HOLD semantics unchanged: apply only after the compatible client is proven; the certificate rebind is part of the transaction.',
    '',
  ].join('\n');
  return header + changed;
}

const rehearsal = (text) => {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith('\ncommit;')) throw new Error('PKG045B_P0_TAIL');
  return trimmed.slice(0, -'commit;'.length) + "rollback;\nselect 'PKG045B_P0_REHEARSAL_COMPLETED_AND_ROLLED_BACK' as result;\n";
};

function main(argv) {
  const text = compose();
  if (argv.includes('--stdout')) { process.stdout.write(text); return 0; }
  if (argv.includes('--rehearsal')) { process.stdout.write(rehearsal(text)); return 0; }
  if (argv.includes('--check')) {
    const committed = lf(readFileSync(OUTPUT, 'utf8'));
    if (committed !== text) { console.error(`PKG045B_P0_NOT_REPRODUCIBLE: ${OUTPUT} differs from the composition`); return 1; }
    console.log(`OK ${OUTPUT} sha256 ${sha(text)}`);
    return 0;
  }
  writeFileSync(OUTPUT, text, 'utf8');
  console.log(`wrote ${OUTPUT} sha256 ${sha(text)} (${text.length} chars)`);
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('build-pkg045b-p0.mjs')) process.exitCode = main(process.argv.slice(2));
