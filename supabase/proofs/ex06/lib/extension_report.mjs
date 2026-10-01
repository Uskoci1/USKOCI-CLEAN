// EX-06 S03, SECOND SECTION as an importable function (the entry is ex06_s03_extension_report.mjs): what the non-blocking, unproven extension stages did to the chain, read AFTER them.
//
// The corpus proof runs right after stage 18 on exactly the ex04d-proven chain. The extension stages (A1, B3a, B3b, P0, the P4 resolver, P5, B3c, the P4 push transport, pkg051a and B24
// part 1 in relaxed pre-image mode) run afterwards for ONE purpose: to reach the post-B24 body of public.rpc_begin_push_send (pin fc76b344), the 12th S01 pin. This reads that pin, compares
// the catalog fingerprint (every function body and trigger of public and private) with the one the proof took BEFORE the extension and lists the objects the extension changed, so a reader
// can see that the corpus result was not produced on the extended chain and what the extension was. It asserts nothing about matching and never fails the job for a differing pin.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createFixtures} from './fixtures.mjs';
import {EXTENSION_PINS, PINS, PROOF_POINT_PINS, bodyMd5Map, catalogLines, catalogQuery, diffCatalog, evaluatePins, evidenceLabel, pinQuery, pinRowsOf} from './pins.mjs';
import {sha256Hex} from './corpus.mjs';

export function renderExtensionMarkdown(report) {
  const lines = ['# EX-06 S03 - second section: the extension for public.rpc_begin_push_send', '', `**Label: ${report.label}**`, '', report.note, ''];
  lines.push('## Extension stages (from the workflow)');
  lines.push(...(report.extensionStages.length ? report.extensionStages.map(line => '- ' + line) : ['- none recorded']));
  lines.push('', '## The 12th pin');
  lines.push('| function | role | S01 pin | chain | verdict | explanation |', '| --- | --- | --- | --- | --- | --- |');
  for (const row of report.pinRows) lines.push(`| ${row.name} | ${row.role} | ${row.expected} | ${row.actual} | ${row.verdict} | ${String(row.explanation ?? '').replaceAll('|', '\\|')} |`);
  lines.push('', '## Objects the extension changed (catalog fingerprint before / after)');
  if (!report.changed) lines.push('Not compared: ' + (report.warnings.join(' ') || 'no catalog file'));
  else {
    const c = report.changed;
    lines.push(`Before sha256 ${report.catalog.before} (${report.catalog.beforeCounts.functions} functions, ${report.catalog.beforeCounts.triggers} triggers); after sha256 ${report.catalog.after} (${report.catalog.afterCounts.functions} functions, ${report.catalog.afterCounts.triggers} triggers).`);
    lines.push(`Added ${c.added.length}, removed ${c.removed.length}, changed ${c.changed.length}.`);
    for (const name of c.added.slice(0, 120)) lines.push(`- ADDED ${name}`);
    for (const name of c.removed.slice(0, 120)) lines.push(`- REMOVED ${name}`);
    for (const item of c.changed.slice(0, 120)) lines.push(`- CHANGED ${item.name}: ${item.before.slice(0, 8)} -> ${item.after.slice(0, 8)}`);
  }
  lines.push('', `Certificate after the extension: ${JSON.stringify(report.certificate)}`);
  for (const warning of report.warnings) lines.push(`- WARNING: ${warning}`);
  lines.push('');
  return lines.join('\n');
}

/** Reads the chain after the extension. deps = {rt, env}. Writes ex06-s03-extension-report.json / .md; returns {report, markdown, exitCode}; never throws. */
export function runExtensionReport({rt, env}) {
  const {rows} = rt;
  const outDir = env.EX06_ARTIFACT_DIR ?? env.PRE_V3_ARTIFACT_DIR ?? 'artifacts/ex06';
  mkdirSync(outDir, {recursive: true});
  const privateDir = env.PRE_V3_ARTIFACT_DIR ?? outDir;
  const catalogPath = env.EX06_CATALOG_FILE ?? privateDir + '/ex06-catalog-before-extension.json';
  const mainReportPath = outDir + '/ex06-s03-report.json';
  const report = {unit: 'EX06_S03_EXTENSION_PIN_REPORT', sourceSha: env.GITHUB_SHA ?? null, disposableDbOnly: true, devAccess: false, providerCalls: 0, result: 'RUNNING',
    note: 'Read AFTER the non-blocking extension stages. The corpus result of the first section was produced BEFORE them, on the ex04d-proven chain.', stages: null, extensionStages: [], pinRows: [],
    proofPoint: null, label: null, catalog: null, changed: null, certificate: null, warnings: []};
  try {
    const stagesPath = env.EX06_STAGES_FILE;
    report.stages = stagesPath && existsSync(stagesPath) ? readFileSync(stagesPath, 'utf8').split(/\r?\n/).filter(line => /\sexit=\d+$|\sSKIPPED/.test(line)) : null;
    report.extensionStages = (report.stages ?? []).filter(line => /^(19|2\d|30)-/.test(line));
    const pinRows = rows(pinQuery(PINS));
    const gate = evaluatePins(pinRows, EXTENSION_PINS);
    report.pinRows = pinRowsOf(gate, EXTENSION_PINS);
    report.bodies = bodyMd5Map(pinRows, EXTENSION_PINS);
    // the proof point: read from the first section's report, never re-derived here (the chain has moved on)
    let proofGate = null;
    if (existsSync(mainReportPath)) proofGate = JSON.parse(readFileSync(mainReportPath, 'utf8')).pinGate ?? null;
    else report.warnings.push('The first section report was not found: the 11 proof-point pins are unknown.');
    report.proofPoint = proofGate ? {equal: proofGate.equal.length, different: proofGate.different.map(item => item.name), missing: proofGate.missing} : null;
    const all = proofGate ? {different: [...proofGate.different, ...gate.different], missing: [...proofGate.missing, ...gate.missing], equal: [...proofGate.equal, ...gate.equal]} : null;
    report.label = all ? evidenceLabel(all, PROOF_POINT_PINS.length + EXTENSION_PINS.length)
      : `12TH PIN ONLY: ${gate.equal.length ? 'rpc_begin_push_send == DEV' : 'rpc_begin_push_send != DEV'} (the 11 proof-point pins were not read)`;
    if (existsSync(catalogPath)) {
      const before = JSON.parse(readFileSync(catalogPath, 'utf8')).rows;
      const afterRows = rows(catalogQuery());
      const b = catalogLines(before), a = catalogLines(afterRows);
      report.catalog = {before: sha256Hex(b.lines.join('\n')), after: sha256Hex(a.lines.join('\n')), beforeCounts: {functions: b.functions, triggers: b.triggers}, afterCounts: {functions: a.functions, triggers: a.triggers}};
      report.changed = diffCatalog(before, afterRows);
    } else {
      report.warnings.push('The catalog file of the first section was not found (' + catalogPath + '): what the extension changed is not compared.');
    }
    report.certificate = createFixtures(rt, {needPath: 'product'}).closureState();
    report.result = 'READ';
  } catch (error) {
    report.result = 'NOT_READ';
    report.warnings.push(String(error?.stack ?? error).slice(0, 1500));
  }
  const markdown = renderExtensionMarkdown(report);
  writeFileSync(outDir + '/ex06-s03-extension-report.json', JSON.stringify(report, null, 2) + '\n');
  writeFileSync(outDir + '/ex06-s03-extension-report.md', markdown);
  return {report, markdown, exitCode: report.result === 'READ' ? 0 : 1};
}

/** The one console line of the second section. */
export const extensionResultLine = report => `EXTENSION_RESULT ${report.result} | ${report.label ?? 'NO LABEL'} | changed ${report.changed ? `+${report.changed.added.length} -${report.changed.removed.length} ~${report.changed.changed.length}` : 'not compared'} | stages ${report.extensionStages.length}`;
