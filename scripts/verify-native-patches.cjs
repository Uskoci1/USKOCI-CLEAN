'use strict';

// RNR-01 / B22: guard for the ONE dependency patch this app carries, patches/react-native-reanimated+4.5.1.patch
// (owner decision 2026-10-02, "uvedi zakrpu"; AGENTS.md 3.1.5 admits patch-package for this patch only).
//
// Built-ins only on purpose: it runs from `postinstall` (so under `npm ci`, NODE_ENV=production, CI and EAS) and from the Jest
// contract test __tests__/reanimatedPatchContract.test.ts. The patch-package call that precedes it in `postinstall` applies the
// patch and fails the install on any problem; this script then proves the result is the reviewed one, because patch-package is
// silent when `patches/` is missing or empty (exit 0) and when a library upgrade still applies cleanly.
//
//   node scripts/verify-native-patches.cjs                        installed state must be PATCHED
//   node scripts/verify-native-patches.cjs --expect-unpatched     installed state must be the pristine library (BEFORE arm of the
//                                                                 A/B build, see B22_REANIMATED_PATCH_20261002.md)
//   node scripts/verify-native-patches.cjs --repo                 also scan .github/workflows (used by the Jest contract)
//
// To change the patch: edit it, regenerate the pins below (the contract test prints the new hashes), and update the document.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LIBRARY = 'react-native-reanimated';
const LIBRARY_VERSION = '4.5.1';
const PATCH_FILE = `${LIBRARY}+${LIBRARY_VERSION}.patch`;
const PATCH_TOOL = 'patch-package';
const TARGET = 'android/src/main/java/com/swmansion/reanimated/NativeProxy.kt';
const DEV_APK_WORKFLOW = 'build-android-dev-apk.yml';
const VERIFY_COMMAND = 'node scripts/verify-native-patches.cjs';
// A patched dev APK refreshes the public dev-latest pre-release only after the owner decided it may (repository variable set to 'yes').
const PUBLISH_GATE_VARIABLE = 'RNR01_PUBLISH_PATCHED';
const GITATTRIBUTES_LINE = 'patches/*.patch text eol=lf';

const EXPECTED_POSTINSTALL_HEAD = [
  'patch-package --error-on-fail --error-on-warn',
  'node ./scripts/verify-native-patches.cjs',
];
const EXPECTED_POSTINSTALL_TAIL = 'sync-entry-reference-assets.cjs';

// SHA-256 pins: the reviewed patch file, the pristine 4.5.1 target file and the target file after the patch.
const PIN = {
  patchFile: 'c8ed7574f1a76c5bda70226bc62d834bec9055d22bd287f2f4717d4f5364a1a9',
  originalTarget: 'bc198ba58e5ce15b2a5873dac4446fc057a457fd93443664710b4481671d0c0d',
  patchedTarget: '713f771c28ca74b3b1438b77d72c9876e34bbf0c647fe2fc8cf287169e593fb5',
};

// Each marker must occur exactly once in the patched file. A purely additive hunk is applied a second time by patch-package when
// its context survives patching, which is the failure this count catches.
const MARKERS = [
  'USKOCI patch RNR-01 (constants)',
  'USKOCI patch RNR-01 (guard)',
  'USKOCI patch RNR-01 (call site)',
];
// The log marker that identifies the patched build in a device log and in the dex of an APK.
const LOG_MARKER = 'USKOCI_RNR01';
// The upstream statement the patch replaces; its presence means the patch is not (fully) applied.
const REPLACED_UPSTREAM_LINE = 'Log.w("Reanimated", "synchronouslyUpdateUIProps failed for tag $viewTag", e)';

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function countOccurrences(text, needle) {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count++;
  return count;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readBuffer(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

// Workflow text without whole-line YAML comments, so that a comment cannot satisfy or trip an ordering check.
function workflowCode(text) {
  return text.split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');
}

function checkPackageJson(root, fail) {
  const pkg = readJson(path.join(root, 'package.json'));
  if (!pkg) return fail('PKG_UNREADABLE', 'package.json is missing or is not valid JSON.');
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  if (deps[LIBRARY] !== LIBRARY_VERSION) {
    fail('PKG_PIN_REANIMATED', `${LIBRARY} must be pinned to exactly ${LIBRARY_VERSION} in dependencies (the patch is version-specific), found ${JSON.stringify(deps[LIBRARY])}.`);
  }
  if (typeof deps[PATCH_TOOL] !== 'string' || !EXACT_VERSION.test(deps[PATCH_TOOL])) {
    fail('PKG_PIN_PATCH_PACKAGE', `${PATCH_TOOL} must be an exact version (no range) in dependencies, found ${JSON.stringify(deps[PATCH_TOOL])}.`);
  }
  if (devDeps[PATCH_TOOL] !== undefined) {
    fail('PKG_PATCH_PACKAGE_IN_DEV', `${PATCH_TOOL} must not be a devDependency: the dev APK workflow installs with NODE_ENV=production and would not have it.`);
  }
  const postinstall = typeof pkg.scripts?.postinstall === 'string' ? pkg.scripts.postinstall : '';
  const steps = postinstall.split(' && ').map(step => step.trim());
  const ordered = steps[0] === EXPECTED_POSTINSTALL_HEAD[0] && steps[1] === EXPECTED_POSTINSTALL_HEAD[1] &&
    steps.slice(2).some(step => step.includes(EXPECTED_POSTINSTALL_TAIL));
  if (!ordered) {
    fail('POSTINSTALL_ORDER', `postinstall must run "${EXPECTED_POSTINSTALL_HEAD[0]}", then "${EXPECTED_POSTINSTALL_HEAD[1]}", then ${EXPECTED_POSTINSTALL_TAIL}; found ${JSON.stringify(postinstall)}.`);
  }
  return pkg;
}

function checkLock(root, pkg, fail) {
  const lock = readJson(path.join(root, 'package-lock.json'));
  const packages = lock?.packages;
  if (!packages) return fail('LOCK_UNREADABLE', 'package-lock.json is missing or has no packages map.');
  const declared = pkg?.dependencies ?? {};
  for (const [name, expected] of [[LIBRARY, LIBRARY_VERSION], [PATCH_TOOL, declared[PATCH_TOOL]]]) {
    const locked = packages[`node_modules/${name}`]?.version;
    if (locked !== expected) fail('LOCK_MISMATCH', `package-lock.json locks ${name} at ${JSON.stringify(locked)}, package.json pins ${JSON.stringify(expected)}.`);
    const rootDeclared = packages['']?.dependencies?.[name];
    if (rootDeclared !== expected) fail('LOCK_MISMATCH', `package-lock.json root declares ${name} ${JSON.stringify(rootDeclared)}, package.json pins ${JSON.stringify(expected)}.`);
  }
}

function checkInstalledVersions(root, pkg, fail) {
  const library = readJson(path.join(root, 'node_modules', LIBRARY, 'package.json'));
  if (library?.version !== LIBRARY_VERSION) {
    fail('INSTALLED_VERSION', `Installed ${LIBRARY} is ${JSON.stringify(library?.version)}, the patch is for ${LIBRARY_VERSION}. Re-create or drop the patch before upgrading.`);
  }
  const tool = readJson(path.join(root, 'node_modules', PATCH_TOOL, 'package.json'));
  if (tool?.version !== pkg?.dependencies?.[PATCH_TOOL]) {
    fail('INSTALLED_PATCH_PACKAGE', `Installed ${PATCH_TOOL} is ${JSON.stringify(tool?.version)}, package.json pins ${JSON.stringify(pkg?.dependencies?.[PATCH_TOOL])}.`);
  }
}

function checkPatchFile(root, fail) {
  const dir = path.join(root, 'patches');
  let names = null;
  try {
    names = fs.readdirSync(dir).sort();
  } catch {
    names = null;
  }
  // The allowlist is exact: a second patch is a new owner decision and needs this script and its test to change.
  if (!names || names.length !== 1 || names[0] !== PATCH_FILE) {
    fail('PATCH_DIR_ALLOWLIST', `patches/ must contain exactly ${PATCH_FILE} (patch-package is silent when it is missing), found ${JSON.stringify(names)}.`);
  }
  const bytes = readBuffer(path.join(dir, PATCH_FILE));
  if (!bytes) return;
  if (bytes.includes(0x0d)) {
    fail('PATCH_CR', 'The patch contains a carriage return; it must be LF only (.gitattributes: patches/*.patch text eol=lf), otherwise the CR is written into the library.');
  }
  const text = bytes.toString('utf8');
  const wanted = `diff --git a/node_modules/${LIBRARY}/${TARGET} b/node_modules/${LIBRARY}/${TARGET}`;
  const headers = text.split('\n').filter(line => line.startsWith('diff --git '));
  if (headers.length !== 1 || headers[0] !== wanted) {
    fail('PATCH_SCOPE', `The patch may touch only node_modules/${LIBRARY}/${TARGET}; its diff headers are ${JSON.stringify(headers)}.`);
  }
  const kinds = text.split('\n').filter(line =>
    /^(GIT binary patch|Binary files |rename (from|to) |copy (from|to) |(old|new) mode |new file mode |deleted file mode |similarity index )/.test(line));
  if (kinds.length) fail('PATCH_KIND', `The patch must be a plain text edit of one existing file, found ${JSON.stringify(kinds)}.`);
  const added = text.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
  const missing = [...MARKERS, LOG_MARKER].filter(marker => !added.some(line => line.includes(marker)));
  if (missing.length) fail('PATCH_MARKERS', `The patch does not add its markers ${JSON.stringify(missing)}.`);
  if (sha256(bytes) !== PIN.patchFile) {
    fail('PATCH_SHA', `The patch file is not the reviewed one: sha256 ${sha256(bytes)} (pinned ${PIN.patchFile}). Update the pin and the document together.`);
  }
}

function checkInstalledTarget(root, expect, fail) {
  const target = path.join(root, 'node_modules', LIBRARY, TARGET);
  const bytes = readBuffer(target);
  if (!bytes) return fail('INSTALLED_TARGET_MISSING', `${LIBRARY}/${TARGET} is not installed.`);
  const text = bytes.toString('utf8');
  const hash = sha256(bytes);
  if (expect === 'unpatched') {
    if (hash !== PIN.originalTarget) fail('INSTALLED_NOT_PRISTINE', `${TARGET} is not the pristine ${LIBRARY_VERSION} file (sha256 ${hash}).`);
    const present = [...MARKERS, LOG_MARKER].filter(marker => text.includes(marker));
    if (present.length) fail('INSTALLED_MARKERS', `The unpatched arm still carries ${JSON.stringify(present)}.`);
    return;
  }
  for (const marker of MARKERS) {
    const count = countOccurrences(text, marker);
    if (count !== 1) fail('INSTALLED_MARKERS', `Installed ${TARGET} carries "${marker}" ${count} times, expected exactly once (patch missing or applied twice).`);
  }
  if (!text.includes(LOG_MARKER)) fail('INSTALLED_MARKERS', `Installed ${TARGET} carries no ${LOG_MARKER} log marker.`);
  if (text.includes(REPLACED_UPSTREAM_LINE)) {
    fail('INSTALLED_ORIGINAL_LINE', `Installed ${TARGET} still contains the upstream statement the patch replaces.`);
  }
  if (hash !== PIN.patchedTarget) {
    fail('INSTALLED_SHA', `Installed ${TARGET} is not the reviewed patched file: sha256 ${hash} (pinned ${PIN.patchedTarget}${hash === PIN.originalTarget ? '; it is the pristine file, so patch-package did not run' : ''}).`);
  }
}

function checkWorkflows(root, fail) {
  const dir = path.join(root, '.github', 'workflows');
  let names = [];
  try {
    names = fs.readdirSync(dir).filter(name => /\.ya?ml$/.test(name)).sort();
  } catch {
    return fail('WORKFLOWS_UNREADABLE', '.github/workflows is missing.');
  }
  for (const name of names) {
    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    const code = workflowCode(raw);
    if (/ignore[-_]scripts/i.test(code)) {
      fail('WORKFLOW_IGNORE_SCRIPTS', `${name} installs with scripts disabled, which would skip patch-package.`);
    }
    const install = code.search(/\bnpm (ci|install)\b/);
    const native = code.search(/expo prebuild|\bgradlew\b/);
    if (native !== -1 && (install === -1 || install > native)) {
      fail('WORKFLOW_NPM_BEFORE_NATIVE', `${name} builds native code without an earlier npm ci/npm install, so postinstall (patch-package) would not have run.`);
    }
  }
  let apk = null;
  try {
    apk = fs.readFileSync(path.join(dir, DEV_APK_WORKFLOW), 'utf8');
  } catch {
    return fail('WORKFLOW_APK_VERIFY_STEP', `${DEV_APK_WORKFLOW} is missing.`);
  }
  checkDevApkWorkflow(workflowCode(apk), fail);
}

// The steps of the dev APK workflow (all at the 6-space indent of `- name:`), from comment-free workflow text.
function stepBlocks(code) {
  const marks = [...code.matchAll(/^ {6}- name: (.+)$/gm)];
  return marks.map((mark, i) => ({
    name: mark[1].trim(),
    index: mark.index,
    text: code.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : code.length),
  }));
}

// The exact `if:` of a step (null when it has none). Several `if:` lines count as a mismatch.
function stepIf(block) {
  const lines = block.text.split('\n').filter(line => /^ {8}if:/.test(line));
  return lines.length === 1 ? lines[0].replace(/^ {8}if:\s*/, '').trim() : lines.length === 0 ? null : '<several if lines>';
}

function checkDevApkWorkflow(code, fail) {
  const install = code.search(/\bnpm ci\b/);
  // The plain call (patched-state check). The BEFORE-arm call carries --expect-unpatched and must not stand in for it.
  const verify = code.search(/node scripts\/verify-native-patches\.cjs[ \t]*(?:\r?\n|$)/);
  const native = code.search(/expo prebuild/);
  const gradle = code.search(/\bgradlew\b/);
  if (install === -1 || verify === -1 || verify < install || verify > native || verify > gradle) {
    fail('WORKFLOW_APK_VERIFY_STEP', `${DEV_APK_WORKFLOW} must run "${VERIFY_COMMAND}" after npm ci and before expo prebuild and Gradle.`);
  }
  if (!/reanimated_patch:\n(?:[^\n]*\n){0,6}?[ \t]+default:\s*apply\b/.test(code)) {
    fail('WORKFLOW_DEFAULT_PATCHED', `${DEV_APK_WORKFLOW} must keep the Reanimated patch ON by default (input reanimated_patch, default apply).`);
  }
  if (!/--expect-unpatched/.test(code) || !/patch-package --reverse/.test(code)) {
    fail('WORKFLOW_BEFORE_ARM', `${DEV_APK_WORKFLOW} must reverse the patch explicitly and verify the pristine state for the BEFORE arm.`);
  }
  // No step of this workflow may turn a failure into a pass: that would let an unpatched or unattested APK through.
  if (/continue-on-error/.test(code)) {
    fail('WORKFLOW_CONTINUE_ON_ERROR', `${DEV_APK_WORKFLOW} must not use continue-on-error: a failed patch check or attestation would no longer stop the build.`);
  }
  const blocks = stepBlocks(code);
  const find = prefix => blocks.find(block => block.name.startsWith(prefix));
  const verifyStep = find('Verify the Reanimated patch');
  const reverseStep = find('Reverse the Reanimated patch');
  const attestStep = find('Attest the Reanimated patch state');
  const uploadStep = find('Upload workflow artifact');
  const enforceStep = find('Enforce the Reanimated patch attestation');
  const refreshStep = find('Refresh dev-latest');
  if (!verifyStep || stepIf(verifyStep) !== "${{ inputs.reanimated_patch != 'skip' }}" || !/^ {8}run: node scripts\/verify-native-patches\.cjs[ \t]*$/m.test(verifyStep.text)) {
    fail('WORKFLOW_VERIFY_STEP_GATE', `The "Verify the Reanimated patch" step must run "${VERIFY_COMMAND}" with exactly the condition \`inputs.reanimated_patch != 'skip'\` (no other if, no skipped run).`);
  }
  if (!reverseStep || stepIf(reverseStep) !== "${{ inputs.reanimated_patch == 'skip' }}" || !/patch-package --reverse/.test(reverseStep.text) || !/--expect-unpatched/.test(reverseStep.text)) {
    fail('WORKFLOW_BEFORE_ARM', 'The BEFORE-arm step must run only for reanimated_patch == skip, reverse the patch and then verify the pristine state.');
  }
  if (!attestStep || stepIf(attestStep) !== null || !/^ {8}id: rnr01_attest$/m.test(attestStep.text) ||
      !attestStep.text.includes('USKOCI-DEV-reanimated-patch-attestation.json') || !attestStep.text.includes('dexFiles')) {
    fail('WORKFLOW_ATTESTATION', `${DEV_APK_WORKFLOW} must attest the patch state of the built APK in an unconditional step (id rnr01_attest) that records the receipt with the dex file count.`);
  }
  if (!uploadStep || stepIf(uploadStep) !== null || !uploadStep.text.includes('USKOCI-DEV-reanimated-patch-attestation.json')) {
    fail('WORKFLOW_ATTESTATION', 'The artifact upload must be unconditional and carry the patch attestation receipt.');
  }
  if (!enforceStep || stepIf(enforceStep) !== "${{ steps.rnr01_attest.outputs.verdict != 'pass' }}" || !/\bexit 1\b/.test(enforceStep.text)) {
    fail('WORKFLOW_ENFORCE_STEP', 'The patch attestation must fail the job from its own step, AFTER the artifact upload and before publishing (condition: steps.rnr01_attest.outputs.verdict != pass, then exit 1).');
  }
  if (attestStep && uploadStep && enforceStep && refreshStep &&
      !(attestStep.index < uploadStep.index && uploadStep.index < enforceStep.index && enforceStep.index < refreshStep.index)) {
    fail('WORKFLOW_ENFORCE_STEP', 'Step order must be: attest, upload the artifact, enforce the attestation, publish (a failed attestation must still leave the APK and the receipt to inspect, and must never publish).');
  }
  const refreshIf = refreshStep ? stepIf(refreshStep) ?? '' : '';
  if (!refreshStep || !refreshIf.includes("github.ref == 'refs/heads/clean-alpha-backend'") || !refreshIf.includes("inputs.reanimated_patch != 'skip'")) {
    fail('WORKFLOW_UNPATCHED_PUBLISH', `${DEV_APK_WORKFLOW} must never publish dev-latest from an unpatched (BEFORE arm) build or from another branch.`);
  }
  if (!refreshIf.includes(`vars.${PUBLISH_GATE_VARIABLE} == 'yes'`)) {
    fail('WORKFLOW_PUBLISH_GATE', `${DEV_APK_WORKFLOW} must publish a patched APK as dev-latest only when the owner has decided it (repository variable ${PUBLISH_GATE_VARIABLE} == 'yes').`);
  }
}

// Repository-level switches that would silently turn the patch off or corrupt it.
function checkRepoFiles(root, fail) {
  const attributes = readBuffer(path.join(root, '.gitattributes'));
  const attributeLines = attributes ? attributes.toString('utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')) : [];
  if (!attributeLines.includes(GITATTRIBUTES_LINE)) {
    fail('GITATTRIBUTES_PATCH_EOL', `.gitattributes must contain the line "${GITATTRIBUTES_LINE}": with core.autocrlf=true a Windows checkout would otherwise write CR bytes into the patch and postinstall would refuse it.`);
  }
  const npmrc = readBuffer(path.join(root, '.npmrc'));
  if (npmrc && npmrc.toString('utf8').split(/\r?\n/).some(line => !/^\s*[#;]/.test(line) && /ignore[-_]scripts/i.test(line))) {
    fail('NPMRC_IGNORE_SCRIPTS', '.npmrc disables install scripts, which would skip patch-package and the verifier in every install.');
  }
  const eas = readBuffer(path.join(root, 'eas.json'));
  if (eas && /ignore[-_]scripts/i.test(eas.toString('utf8'))) {
    fail('EAS_IGNORE_SCRIPTS', 'eas.json disables install scripts, which would skip patch-package and the verifier in the cloud build.');
  }
}

/**
 * @param {{root?: string, scope?: 'install' | 'repo', expect?: 'patched' | 'unpatched'}} [options]
 * @returns {{code: string, message: string}[]} empty when everything holds
 */
function verify({ root = path.resolve(__dirname, '..'), scope = 'install', expect = 'patched' } = {}) {
  const problems = [];
  const fail = (code, message) => problems.push({ code, message });
  const pkg = checkPackageJson(root, fail);
  checkLock(root, pkg, fail);
  checkInstalledVersions(root, pkg, fail);
  checkPatchFile(root, fail);
  checkInstalledTarget(root, expect, fail);
  if (scope === 'repo') {
    checkWorkflows(root, fail);
    checkRepoFiles(root, fail);
  }
  return problems;
}

module.exports = { verify, workflowCode, sha256, PIN, MARKERS, LOG_MARKER, PATCH_FILE, TARGET, LIBRARY, LIBRARY_VERSION, REPLACED_UPSTREAM_LINE };

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter(arg => !['--repo', '--expect-unpatched'].includes(arg));
  if (unknown.length) {
    console.error(`[native-patches] unknown argument(s): ${unknown.join(' ')}`);
    process.exit(2);
  }
  const expect = args.has('--expect-unpatched') ? 'unpatched' : 'patched';
  const problems = verify({ scope: args.has('--repo') ? 'repo' : 'install', expect });
  if (problems.length) {
    for (const { code, message } of problems) console.error(`[native-patches] ${code}: ${message}`);
    process.exit(1);
  }
  console.log(`[native-patches] OK: ${LIBRARY}@${LIBRARY_VERSION} is ${expect} as reviewed (${PATCH_FILE}).`);
}
