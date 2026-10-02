// EX-05 S02: the chain-fidelity pin gate. ASCII only, LF only.
// The disposable chain is NOT DEV. A lock-order statement about the chain is only a statement about DEV where the function bodies and
// trigger definitions that decide the lock order are the DEV ones. The pins file holds the md5 of every such body as read read-only on
// canonical DEV on 2026-10-02; this module classifies what the chain holds and derives the verdict. B24 part 1 (the 40001 -> PT409
// conversion of the task media functions and of rpc_prepare_account_closure) is not part of the chain, so those seven functions are
// EXPECTED to carry their pre-B24 body (the md5 the b24 inventory records) and are converted by the proof with the very transformation
// of the candidate; the converted body must then equal the DEV md5 exactly.
import {readFileSync} from 'node:fs';
import {HEX64_RE} from './ex05_s02_sql.mjs';

export const PINS_PATH = 'supabase/proofs/ex05/ex05_s02_pins.json';
const MD5_RE = /^[0-9a-f]{32}$/;
const SIG_RE = /^(public|private)\.[a-z0-9_]+\([a-z0-9_.,\[\] ]*\)$/;
const TRIGGER_RE = /^(public|private)\.[a-z0-9_]+\.[a-z0-9_]+$/;

export function loadPins(text = readFileSync(PINS_PATH, 'utf8')) {
  const pins = JSON.parse(text);
  const problems = [];
  if (pins.unit !== 'EX05_S02_PINS') problems.push('UNIT');
  if (!HEX64_RE.test(pins.devRead?.certifiedDigest ?? '') || pins.devRead?.date !== '2026-10-02') problems.push('DEV_READ');
  for (const [sig, pin] of Object.entries(pins.functions ?? {})) {
    if (!SIG_RE.test(sig)) problems.push('SIGNATURE:' + sig);
    if (!MD5_RE.test(pin.md5 ?? '')) problems.push('MD5:' + sig);
    if (pin.preB24Md5 !== undefined && (!MD5_RE.test(pin.preB24Md5) || pin.preB24Md5 === pin.md5)) problems.push('PRE_B24:' + sig);
    if (typeof pin.core !== 'boolean') problems.push('CORE_FLAG:' + sig);
  }
  for (const [name, pin] of Object.entries(pins.triggers ?? {})) {
    if (!TRIGGER_RE.test(name)) problems.push('TRIGGER_NAME:' + name);
    if (!MD5_RE.test(pin.md5 ?? '') || typeof pin.core !== 'boolean') problems.push('TRIGGER_PIN:' + name);
  }
  const writers = pins.census?.writers ?? [];
  if (!Array.isArray(writers) || writers.length < 10 || new Set(writers).size !== writers.length || writers.some(name => !/^(public|private)\.[a-z0-9_]+$/.test(name))) problems.push('CENSUS');
  if (problems.length) throw new Error('PINS_INVALID:' + problems.join(','));
  return pins;
}

/** The functions the proof converts (B24 part 1 transformation): everything that has a pre-B24 pin. */
export const b24Targets = pins => Object.entries(pins.functions).filter(([, pin]) => pin.preB24Md5).map(([sig, pin]) => ({sig, preMd5: pin.preB24Md5, devMd5: pin.md5}));

/** One pin against what the chain holds ({md5, secdef, config} or null). */
export function classifyFunction(sig, pin, chain) {
  if (!chain) return {sig, core: pin.core, status: 'MISSING'};
  if (chain.md5 === pin.md5) return {sig, core: pin.core, status: 'EQUAL', metadata: chain.secdef === (pin.secdef !== false) && chain.config === 'search_path=pg_catalog' ? 'EQUAL' : 'DIFFERENT'};
  if (pin.preB24Md5 && chain.md5 === pin.preB24Md5) return {sig, core: pin.core, status: 'EXPECTED_PRE_B24', chainMd5: chain.md5};
  return {sig, core: pin.core, status: 'DIFFERENT', chainMd5: chain.md5, devMd5: pin.md5};
}

export function classifyTrigger(name, pin, chainMd5) {
  if (!chainMd5) return {name, core: pin.core, status: 'MISSING'};
  return chainMd5 === pin.md5 ? {name, core: pin.core, status: 'EQUAL'} : {name, core: pin.core, status: 'DIFFERENT', chainMd5, devMd5: pin.md5};
}

/** What was written by the census query on the chain against the DEV pin: both directions are reported. */
export function censusDiff(chainWriters, pinned) {
  const chain = new Set(chainWriters);
  const dev = new Set(pinned);
  return {missingOnChain: [...dev].filter(name => !chain.has(name)).sort(), extraOnChain: [...chain].filter(name => !dev.has(name)).sort()};
}

/**
 * The verdict. `before` = classification before the conversion, `after` = classification after it, `converted` = [{sig, sites, md5After}] from the proof.
 * DEV_FAITHFUL needs: every core function EQUAL after the conversion, every converted function equal to its DEV md5, every core trigger EQUAL,
 * the census equal, the certificate unchanged by the conversion, and no 40001 left in a pinned body.
 */
export function fidelityVerdict({pins, before, after, triggers, census, converted, certificate, remaining40001}) {
  const problems = [];
  const warnings = [];
  for (const item of after) {
    if (item.status === 'EQUAL') {
      if (item.metadata === 'DIFFERENT') (item.core ? problems : warnings).push('METADATA_DIFFERENT:' + item.sig);
      continue;
    }
    (item.core ? problems : warnings).push(`${item.status}:${item.sig}`);
  }
  for (const item of before) if (item.status === 'EXPECTED_PRE_B24' && !converted.some(entry => entry.sig === item.sig && entry.md5After === pins.functions[item.sig].md5)) problems.push('CONVERSION_NOT_EQUAL_TO_DEV:' + item.sig);
  for (const entry of converted) if (entry.md5After !== pins.functions[entry.sig]?.md5) problems.push('CONVERTED_BODY_DIFFERS_FROM_DEV:' + entry.sig);
  for (const item of triggers) if (item.status !== 'EQUAL') (item.core ? problems : warnings).push(`TRIGGER_${item.status}:${item.name}`);
  if (census.missingOnChain.length || census.extraOnChain.length) problems.push('CENSUS_DIFFERS:' + JSON.stringify(census));
  if (certificate && certificate.unchangedByConversion === false) problems.push('CERTIFICATE_MOVED_BY_THE_CONVERSION');
  if ((remaining40001 ?? []).length) problems.push('SQLSTATE_40001_LEFT_IN:' + remaining40001.join(','));
  const checked = after.length;
  const equal = after.filter(item => item.status === 'EQUAL').length;
  return {verdict: problems.length ? 'NOT_DEV_FAITHFUL' : 'DEV_FAITHFUL', checked, equal, converted: converted.length, expectedPreB24: before.filter(item => item.status === 'EXPECTED_PRE_B24').length,
    triggersChecked: triggers.length, triggersEqual: triggers.filter(item => item.status === 'EQUAL').length, problems, warnings, census};
}
