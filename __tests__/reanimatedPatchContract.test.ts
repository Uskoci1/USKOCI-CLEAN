import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// RNR-01 / B22: the contract of the ONE dependency patch (patch-package, patches/react-native-reanimated+4.5.1.patch).
// The rules live in scripts/verify-native-patches.cjs, which also runs from `postinstall`; this suite proves that
//  1. the real repository satisfies every rule,
//  2. each rule goes RED when its element is deleted or changed (mutation proof on a throwaway copy), and
//  3. the committed patch really applies to, and reverses from, the pristine library through the real patch-package.
const guard = require('../scripts/verify-native-patches.cjs');

// The first patch-package process of a run is slow on a cold Windows machine (26 s measured); the default 5 s would flake.
jest.setTimeout(120000);

const repo = path.resolve(__dirname, '..');
const target = path.join('node_modules', guard.LIBRARY, guard.TARGET);
const workflows = path.join('.github', 'workflows');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr01-contract-'));
let counter = 0;

afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

const codes = (problems: { code: string }[]) => problems.map(problem => problem.code);
const text = (file: string) => fs.readFileSync(file, 'utf8');
const write = (file: string, data: string | Buffer) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

/** A minimal project that carries only what the guard reads, built from the real repository files. */
function fixture(): string {
  const dir = path.join(scratch, `case-${counter++}`);
  const pkg = JSON.parse(text(path.join(repo, 'package.json')));
  const lock = JSON.parse(text(path.join(repo, 'package-lock.json')));
  const slim = {
    lockfileVersion: lock.lockfileVersion,
    packages: {
      '': { dependencies: { [guard.LIBRARY]: pkg.dependencies[guard.LIBRARY], 'patch-package': pkg.dependencies['patch-package'] } },
      [`node_modules/${guard.LIBRARY}`]: { version: lock.packages[`node_modules/${guard.LIBRARY}`]?.version },
      'node_modules/patch-package': { version: lock.packages['node_modules/patch-package']?.version },
    },
  };
  write(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  write(path.join(dir, 'package-lock.json'), JSON.stringify(slim, null, 2));
  write(path.join(dir, 'node_modules', guard.LIBRARY, 'package.json'), text(path.join(repo, 'node_modules', guard.LIBRARY, 'package.json')));
  write(path.join(dir, 'node_modules', 'patch-package', 'package.json'), text(path.join(repo, 'node_modules', 'patch-package', 'package.json')));
  write(path.join(dir, target), fs.readFileSync(path.join(repo, target)));
  fs.mkdirSync(path.join(dir, 'patches'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'patches', guard.PATCH_FILE), path.join(dir, 'patches', guard.PATCH_FILE));
  fs.copyFileSync(path.join(repo, '.gitattributes'), path.join(dir, '.gitattributes'));
  fs.copyFileSync(path.join(repo, 'eas.json'), path.join(dir, 'eas.json'));
  fs.mkdirSync(path.join(dir, workflows), { recursive: true });
  fs.copyFileSync(path.join(repo, workflows, 'build-android-dev-apk.yml'), path.join(dir, workflows, 'build-android-dev-apk.yml'));
  write(path.join(dir, workflows, 'native-ok.yml'), 'jobs:\n  b:\n    steps:\n      - run: npm ci\n      - run: npx expo prebuild --platform android\n      - run: ./gradlew assembleRelease\n');
  return dir;
}

const mutate = (dir: string, relative: string, change: (before: string) => string) => {
  const file = path.join(dir, relative);
  write(file, change(text(file)));
};
const editPackage = (dir: string, change: (pkg: any) => void) => mutate(dir, 'package.json', before => {
  const pkg = JSON.parse(before); change(pkg); return JSON.stringify(pkg, null, 2);
});
const editLock = (dir: string, change: (lock: any) => void) => mutate(dir, 'package-lock.json', before => {
  const lock = JSON.parse(before); change(lock); return JSON.stringify(lock, null, 2);
});
const apkWorkflow = path.join(workflows, 'build-android-dev-apk.yml');
/** The text of one step of a workflow (from its `- name:` line up to the next step or step comment). */
const stepText = (before: string, prefix: string): string => {
  const start = before.indexOf(`      - name: ${prefix}`);
  expect(start).toBeGreaterThan(-1);
  const rest = before.slice(start + 1);
  const next = rest.search(/\n(?: {6}- name: | {6}# )/);
  return before.slice(start, next === -1 ? undefined : start + 1 + next + 1);
};
const removeStep = (before: string, prefix: string): string => before.replace(stepText(before, prefix), '');

/**
 * Runs the real patch-package in a fixture. CI/NODE_ENV are neutralised so that only the explicit flags decide the exit code:
 * patch-package exits 0 on a failed hunk or a version mismatch unless it is told otherwise (or detects CI / NODE_ENV=test).
 */
function patchPackage(dir: string, ...args: string[]) {
  const bin = require.resolve('patch-package/package.json');
  const declared = JSON.parse(text(bin)).bin;
  const entry = path.join(path.dirname(bin), typeof declared === 'string' ? declared : declared['patch-package']);
  const env = { ...process.env, NODE_ENV: 'development', CI: '', GITHUB_ACTIONS: '', CONTINUOUS_INTEGRATION: '', BUILD_NUMBER: '', RUN_ID: '' } as NodeJS.ProcessEnv;
  return execFileSync(process.execPath, [entry, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000, env, stdio: 'pipe' });
}
/** The pristine 4.5.1 file, obtained by reversing the real patch with the real patch-package (memoised). */
let pristineBytes: Buffer | null = null;
function pristine(): Buffer {
  if (!pristineBytes) {
    const dir = fixture();
    patchPackage(dir, '--reverse', '--error-on-fail');
    pristineBytes = fs.readFileSync(path.join(dir, target));
  }
  return pristineBytes;
}

describe('the real repository satisfies the Reanimated patch contract', () => {
  it('passes every rule: pins, lockfile, postinstall order, patch file, installed state, workflows', () => {
    expect(guard.verify({ scope: 'repo' })).toEqual([]);
  });

  it('pins patch-package exactly as a production dependency and Reanimated exactly', () => {
    const pkg = JSON.parse(text(path.join(repo, 'package.json')));
    expect(pkg.dependencies['patch-package']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies?.['patch-package']).toBeUndefined();
    expect(pkg.dependencies[guard.LIBRARY]).toBe(guard.LIBRARY_VERSION);
    expect(guard.PATCH_FILE).toBe(`${guard.LIBRARY}+${pkg.dependencies[guard.LIBRARY]}.patch`);
  });

  it('runs patch-package loudly BEFORE the existing asset sync and keeps that sync', () => {
    const steps: string[] = JSON.parse(text(path.join(repo, 'package.json'))).scripts.postinstall.split(' && ');
    expect(steps[0]).toBe('patch-package --error-on-fail --error-on-warn');
    expect(steps[1]).toBe('node ./scripts/verify-native-patches.cjs');
    expect(steps[2]).toBe('node ./scripts/sync-entry-reference-assets.cjs');
    expect(steps).toHaveLength(3);
  });

  it('carries exactly one patch, as LF text, touching only NativeProxy.kt, with every marker added', () => {
    expect(fs.readdirSync(path.join(repo, 'patches'))).toEqual([guard.PATCH_FILE]);
    const bytes = fs.readFileSync(path.join(repo, 'patches', guard.PATCH_FILE));
    expect(bytes.includes(0x0d)).toBe(false);
    const headers = bytes.toString('utf8').split('\n').filter(line => line.startsWith('diff --git '));
    expect(headers).toEqual([`diff --git a/node_modules/${guard.LIBRARY}/${guard.TARGET} b/node_modules/${guard.LIBRARY}/${guard.TARGET}`]);
    for (const marker of [...guard.MARKERS, guard.LOG_MARKER]) expect(bytes.toString('utf8')).toContain(marker);
    expect(guard.sha256(bytes)).toBe(guard.PIN.patchFile);
  });

  it('keeps the patch LF on every checkout: .gitattributes pins it (a Windows autocrlf checkout would otherwise write CRs)', () => {
    const lines = text(path.join(repo, '.gitattributes')).split(/\r?\n/).map(line => line.trim());
    expect(lines).toContain('patches/*.patch text eol=lf');
  });

  it('has the patch applied exactly once in the installed library, byte-for-byte as reviewed', () => {
    const installed = fs.readFileSync(path.join(repo, target));
    expect(guard.sha256(installed)).toBe(guard.PIN.patchedTarget);
    for (const marker of guard.MARKERS) expect(text(path.join(repo, target)).split(marker)).toHaveLength(2);
    expect(text(path.join(repo, target))).not.toContain(guard.REPLACED_UPSTREAM_LINE);
  });

  it('keeps every native workflow behind npm ci (so behind patch-package) and never skips install scripts', () => {
    // Same view of a workflow as the verifier: whole-line comments are not code, so a comment can neither satisfy nor trip a rule.
    const names = fs.readdirSync(path.join(repo, workflows)).filter(name => /\.ya?ml$/.test(name));
    const code = (name: string): string => guard.workflowCode(text(path.join(repo, workflows, name)));
    const native = names.filter(name => /expo prebuild|\bgradlew\b/.test(code(name)));
    expect(native).toContain('build-android-dev-apk.yml');
    for (const name of names) expect(code(name)).not.toMatch(/ignore[-_]scripts/i);
    expect(guard.verify({ scope: 'repo' }).filter((problem: { code: string }) => /^WORKFLOW_/.test(problem.code))).toEqual([]);
  });

  it('verifies the patch in the dev APK workflow between npm ci and the native build, publishes only patched builds', () => {
    const workflow = text(path.join(repo, apkWorkflow));
    const at = (needle: string | RegExp) => workflow.search(needle);
    expect(at('npm ci')).toBeGreaterThan(-1);
    expect(at('node scripts/verify-native-patches.cjs')).toBeGreaterThan(at('npm ci'));
    expect(at('node scripts/verify-native-patches.cjs')).toBeLessThan(at('expo prebuild'));
    expect(at('node scripts/verify-native-patches.cjs')).toBeLessThan(at('./gradlew'));
    expect(workflow).toContain('USKOCI-DEV-reanimated-patch-attestation.json');
    // The artifact is uploaded BEFORE the attestation is enforced, and nothing is published unless the owner opened the gate.
    expect(at('Upload workflow artifact')).toBeGreaterThan(at('Attest the Reanimated patch state'));
    expect(at('Enforce the Reanimated patch attestation')).toBeGreaterThan(at('Upload workflow artifact'));
    expect(at('Refresh dev-latest')).toBeGreaterThan(at('Enforce the Reanimated patch attestation'));
    expect(workflow).toContain("vars.RNR01_PUBLISH_PATCHED == 'yes'");
  });
});

describe('every rule goes red when its element is deleted or changed (mutation proof on a throwaway copy)', () => {
  it('the unmutated copy is clean, so each case below is red only because of its mutation', () => {
    expect(guard.verify({ root: fixture(), scope: 'repo' })).toEqual([]);
  });

  const cases: [string, string, (dir: string) => void][] = [
    ['patch-package removed from dependencies', 'PKG_PIN_PATCH_PACKAGE', dir => editPackage(dir, pkg => { delete pkg.dependencies['patch-package']; })],
    ['patch-package given a caret range', 'PKG_PIN_PATCH_PACKAGE', dir => editPackage(dir, pkg => { pkg.dependencies['patch-package'] = `^${pkg.dependencies['patch-package']}`; })],
    ['patch-package moved to devDependencies', 'PKG_PATCH_PACKAGE_IN_DEV', dir => editPackage(dir, pkg => { pkg.devDependencies = { ...pkg.devDependencies, 'patch-package': pkg.dependencies['patch-package'] }; delete pkg.dependencies['patch-package']; })],
    ['Reanimated bumped in package.json', 'PKG_PIN_REANIMATED', dir => editPackage(dir, pkg => { pkg.dependencies[guard.LIBRARY] = '4.7.0'; })],
    ['Reanimated given a range', 'PKG_PIN_REANIMATED', dir => editPackage(dir, pkg => { pkg.dependencies[guard.LIBRARY] = '~4.5.1'; })],
    ['postinstall without patch-package', 'POSTINSTALL_ORDER', dir => editPackage(dir, pkg => { pkg.scripts.postinstall = 'node ./scripts/sync-entry-reference-assets.cjs'; })],
    ['postinstall without the loud-failure flag', 'POSTINSTALL_ORDER', dir => editPackage(dir, pkg => { pkg.scripts.postinstall = pkg.scripts.postinstall.replace(' --error-on-fail', ''); })],
    ['postinstall without the warning-failure flag', 'POSTINSTALL_ORDER', dir => editPackage(dir, pkg => { pkg.scripts.postinstall = pkg.scripts.postinstall.replace(' --error-on-warn', ''); })],
    ['postinstall without the verifier', 'POSTINSTALL_ORDER', dir => editPackage(dir, pkg => { pkg.scripts.postinstall = pkg.scripts.postinstall.replace(' && node ./scripts/verify-native-patches.cjs', ''); })],
    ['postinstall running patch-package AFTER the asset sync', 'POSTINSTALL_ORDER', dir => editPackage(dir, pkg => { pkg.scripts.postinstall = 'node ./scripts/sync-entry-reference-assets.cjs && patch-package --error-on-fail --error-on-warn && node ./scripts/verify-native-patches.cjs'; })],
    ['postinstall without the existing asset sync', 'POSTINSTALL_ORDER', dir => editPackage(dir, pkg => { pkg.scripts.postinstall = 'patch-package --error-on-fail --error-on-warn && node ./scripts/verify-native-patches.cjs'; })],
    ['lockfile locks another Reanimated', 'LOCK_MISMATCH', dir => editLock(dir, lock => { lock.packages[`node_modules/${guard.LIBRARY}`].version = '4.7.0'; })],
    ['lockfile locks another patch-package', 'LOCK_MISMATCH', dir => editLock(dir, lock => { lock.packages['node_modules/patch-package'].version = '8.0.0'; })],
    ['lockfile root declares another patch-package', 'LOCK_MISMATCH', dir => editLock(dir, lock => { lock.packages[''].dependencies['patch-package'] = '^8.0.1'; })],
    ['installed Reanimated is another version', 'INSTALLED_VERSION', dir => mutate(dir, path.join('node_modules', guard.LIBRARY, 'package.json'), before => before.replace(`"version": "${guard.LIBRARY_VERSION}"`, '"version": "4.7.0"'))],
    ['installed patch-package is another version', 'INSTALLED_PATCH_PACKAGE', dir => mutate(dir, path.join('node_modules', 'patch-package', 'package.json'), before => before.replace(/"version": "[^"]+"/, '"version": "0.0.1"'))],
    ['patches directory deleted', 'PATCH_DIR_ALLOWLIST', dir => fs.rmSync(path.join(dir, 'patches'), { recursive: true })],
    ['patch file deleted', 'PATCH_DIR_ALLOWLIST', dir => fs.rmSync(path.join(dir, 'patches', guard.PATCH_FILE))],
    ['a second patch added', 'PATCH_DIR_ALLOWLIST', dir => write(path.join(dir, 'patches', 'react-native-svg+15.15.4.patch'), '')],
    ['patch renamed to another version', 'PATCH_DIR_ALLOWLIST', dir => fs.renameSync(path.join(dir, 'patches', guard.PATCH_FILE), path.join(dir, 'patches', `${guard.LIBRARY}+4.7.0.patch`))],
    ['patch saved with CRLF line endings', 'PATCH_CR', dir => mutate(dir, path.join('patches', guard.PATCH_FILE), before => before.replace(/\n/g, '\r\n'))],
    ['patch also touches another file', 'PATCH_SCOPE', dir => mutate(dir, path.join('patches', guard.PATCH_FILE), before => `${before}diff --git a/node_modules/${guard.LIBRARY}/android/build.gradle.kts b/node_modules/${guard.LIBRARY}/android/build.gradle.kts\n`)],
    ['patch targets another library file', 'PATCH_SCOPE', dir => mutate(dir, path.join('patches', guard.PATCH_FILE), before => before.replace(/NodesManager|NativeProxy\.kt/g, 'DrawPassDetector.kt'))],
    ['patch carries a rename', 'PATCH_KIND', dir => mutate(dir, path.join('patches', guard.PATCH_FILE), before => `${before}rename from x\nrename to y\n`)],
    ['patch loses its markers', 'PATCH_MARKERS', dir => mutate(dir, path.join('patches', guard.PATCH_FILE), before => before.replace(/USKOCI patch RNR-01/g, 'a patch'))],
    ['patch edited by one byte (sha pin)', 'PATCH_SHA', dir => mutate(dir, path.join('patches', guard.PATCH_FILE), before => `${before}\n`)],
    ['installed file without any marker (patch not applied)', 'INSTALLED_MARKERS', dir => mutate(dir, target, before => before.replace(/USKOCI patch RNR-01/g, 'a patch'))],
    ['installed file with a marker twice (patch applied twice)', 'INSTALLED_MARKERS', dir => mutate(dir, target, before => `${before}\n// USKOCI patch RNR-01 (guard)\n`)],
    ['installed file without the log marker', 'INSTALLED_MARKERS', dir => mutate(dir, target, before => before.split(guard.LOG_MARKER).join('NOTHING'))],
    ['installed file brings the replaced upstream line back', 'INSTALLED_ORIGINAL_LINE', dir => mutate(dir, target, before => `${before}\n${guard.REPLACED_UPSTREAM_LINE}\n`)],
    ['installed file differs by one byte (sha pin)', 'INSTALLED_SHA', dir => mutate(dir, target, before => `${before}\n`)],
    ['installed file is the pristine library (patch-package did not run)', 'INSTALLED_SHA', dir => write(path.join(dir, target), pristine())],
    ['installed file deleted', 'INSTALLED_TARGET_MISSING', dir => fs.rmSync(path.join(dir, target))],
    ['a workflow installs with --ignore-scripts', 'WORKFLOW_IGNORE_SCRIPTS', dir => mutate(dir, path.join(workflows, 'native-ok.yml'), before => before.replace('npm ci', 'npm ci --ignore-scripts'))],
    ['a workflow disables scripts through the environment', 'WORKFLOW_IGNORE_SCRIPTS', dir => mutate(dir, path.join(workflows, 'native-ok.yml'), before => `env:\n  npm_config_ignore_scripts: 'true'\n${before}`)],
    ['a workflow builds native code without npm ci', 'WORKFLOW_NPM_BEFORE_NATIVE', dir => mutate(dir, path.join(workflows, 'native-ok.yml'), before => before.replace('      - run: npm ci\n', ''))],
    ['a workflow runs npm ci only after the native build', 'WORKFLOW_NPM_BEFORE_NATIVE', dir => mutate(dir, path.join(workflows, 'native-ok.yml'), before => `${before.replace('      - run: npm ci\n', '')}      - run: npm ci\n`)],
    ['the dev APK workflow loses its verification step', 'WORKFLOW_APK_VERIFY_STEP', dir => mutate(dir, apkWorkflow, before => before.split('node scripts/verify-native-patches.cjs').join('echo skipped'))],
    ['the dev APK workflow verifies only after Gradle', 'WORKFLOW_APK_VERIFY_STEP', dir => mutate(dir, apkWorkflow, before => before.replace('node scripts/verify-native-patches.cjs\n', 'echo skipped\n').replace('- name: Prepare APK', '- name: Late verify\n        run: node scripts/verify-native-patches.cjs\n\n      - name: Prepare APK'))],
    ['the dev APK workflow builds unpatched by default', 'WORKFLOW_DEFAULT_PATCHED', dir => mutate(dir, apkWorkflow, before => before.replace(/(reanimated_patch:\n(?:[^\n]*\n){0,6}?[ \t]+default:\s*)apply/, '$1skip'))],
    ['the dev APK workflow may publish an unpatched build', 'WORKFLOW_UNPATCHED_PUBLISH', dir => mutate(dir, apkWorkflow, before => before.replace(" && inputs.reanimated_patch != 'skip'", ''))],
    ['the dev APK workflow cannot build the BEFORE arm', 'WORKFLOW_BEFORE_ARM', dir => mutate(dir, apkWorkflow, before => before.replace('patch-package --reverse', 'echo noop'))],
    ['the dev APK workflow stops attesting the APK', 'WORKFLOW_ATTESTATION', dir => mutate(dir, apkWorkflow, before => before.split('USKOCI-DEV-reanimated-patch-attestation.json').join('x.json'))],
    ['the dev APK workflow attests without counting dex files', 'WORKFLOW_ATTESTATION', dir => mutate(dir, apkWorkflow, before => before.split('dexFiles').join('dex'))],
    ['the dev APK workflow attests only conditionally', 'WORKFLOW_ATTESTATION', dir => mutate(dir, apkWorkflow, before => before.replace('        id: rnr01_attest\n', '        id: rnr01_attest\n        if: ${{ always() }}\n'))],
    ['the dev APK workflow uploads only conditionally', 'WORKFLOW_ATTESTATION', dir => mutate(dir, apkWorkflow, before => before.replace('        uses: actions/upload-artifact@v4\n', '        if: ${{ failure() }}\n        uses: actions/upload-artifact@v4\n'))],
    ['the verify step is switched off with if: false', 'WORKFLOW_VERIFY_STEP_GATE', dir => mutate(dir, apkWorkflow, before => before.replace("if: ${{ inputs.reanimated_patch != 'skip' }}", 'if: ${{ false }}'))],
    ['the verify step may fail without failing the job', 'WORKFLOW_CONTINUE_ON_ERROR', dir => mutate(dir, apkWorkflow, before => before.replace('        run: node scripts/verify-native-patches.cjs\n', '        continue-on-error: true\n        run: node scripts/verify-native-patches.cjs\n'))],
    ['the attestation step may fail without failing the job', 'WORKFLOW_CONTINUE_ON_ERROR', dir => mutate(dir, apkWorkflow, before => before.replace('        id: rnr01_attest\n', '        id: rnr01_attest\n        continue-on-error: true\n'))],
    ['the attestation is never enforced', 'WORKFLOW_ENFORCE_STEP', dir => mutate(dir, apkWorkflow, before => removeStep(before, 'Enforce the Reanimated patch attestation'))],
    ['the attestation is enforced only when it passed', 'WORKFLOW_ENFORCE_STEP', dir => mutate(dir, apkWorkflow, before => before.replace("verdict != 'pass' }}", "verdict == 'pass' }}"))],
    ['the artifact is uploaded only after the attestation is enforced', 'WORKFLOW_ENFORCE_STEP', dir => mutate(dir, apkWorkflow, before => {
      const upload = stepText(before, 'Upload workflow artifact');
      return before.replace(upload, '').replace('      - name: Note that dev-latest was not refreshed', `${upload}\n      - name: Note that dev-latest was not refreshed`);
    })],
    ['a patched build is published without the owner gate', 'WORKFLOW_PUBLISH_GATE', dir => mutate(dir, apkWorkflow, before => before.replace(" && vars.RNR01_PUBLISH_PATCHED == 'yes'", ''))],
    ['a patched build is published from any branch', 'WORKFLOW_UNPATCHED_PUBLISH', dir => mutate(dir, apkWorkflow, before => before.replace("github.ref == 'refs/heads/clean-alpha-backend' && inputs.reanimated_patch != 'skip' && vars.RNR01_PUBLISH_PATCHED == 'yes'", "inputs.reanimated_patch != 'skip' && vars.RNR01_PUBLISH_PATCHED == 'yes'"))],
    ['.gitattributes loses the patch line (a CRLF checkout would write CRs into the patch)', 'GITATTRIBUTES_PATCH_EOL', dir => mutate(dir, '.gitattributes', before => before.split('patches/*.patch text eol=lf').join('# removed'))],
    ['.gitattributes keeps the patch line only as a comment', 'GITATTRIBUTES_PATCH_EOL', dir => mutate(dir, '.gitattributes', before => before.replace('patches/*.patch text eol=lf', '# patches/*.patch text eol=lf'))],
    ['a root .npmrc disables install scripts', 'NPMRC_IGNORE_SCRIPTS', dir => write(path.join(dir, '.npmrc'), 'registry=https://registry.npmjs.org/\nignore-scripts=true\n')],
    ['a root .npmrc disables install scripts with an underscore key', 'NPMRC_IGNORE_SCRIPTS', dir => write(path.join(dir, '.npmrc'), 'ignore_scripts = true\n')],
    ['eas.json disables install scripts for the cloud build', 'EAS_IGNORE_SCRIPTS', dir => mutate(dir, 'eas.json', before => before.replace(/\{/, '{ "x": { "env": { "NPM_CONFIG_IGNORE_SCRIPTS": "true" } },'))],
  ];

  it.each(cases)('%s -> %s', (_name, code, change) => {
    const dir = fixture();
    change(dir);
    expect(codes(guard.verify({ root: dir, scope: 'repo' }))).toContain(code);
  });

  it('a comment cannot stand in for the install or hide a native build in a workflow', () => {
    const dir = fixture();
    mutate(dir, path.join(workflows, 'native-ok.yml'), before => `# npm ci\n${before.replace('      - run: npm ci\n', '')}`);
    expect(codes(guard.verify({ root: dir, scope: 'repo' }))).toContain('WORKFLOW_NPM_BEFORE_NATIVE');
  });

  it('a comment that merely mentions ignore-scripts is not a violation (workflow and .npmrc)', () => {
    const dir = fixture();
    mutate(dir, path.join(workflows, 'native-ok.yml'), before => `# never use --ignore-scripts here\n${before}`);
    write(path.join(dir, '.npmrc'), '# ignore-scripts=true would skip patch-package\n; ignore-scripts=true\nregistry=https://registry.npmjs.org/\n');
    expect(guard.verify({ root: dir, scope: 'repo' })).toEqual([]);
  });
});

// The attestation step is shell, so it is executed here on small fake APKs (the real step text of the real workflow).
// Needs bash with unzip, awk, grep, mktemp and git; skipped where they are missing (a WSL bash on Windows does not count).
function shellAvailable(): boolean {
  try {
    const out = execFileSync('bash', ['-c', 'uname -s; command -v unzip awk grep mktemp git >/dev/null && echo tools'], { encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
    if (process.platform === 'win32' && !/MINGW|MSYS|CYGWIN/.test(out)) return false;
    return out.includes('tools');
  } catch {
    return false;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (data: Buffer): number => { let c = 0xffffffff; for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** A minimal ZIP with stored (uncompressed) entries: enough for unzip. */
function storeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x21, 14);
    head.writeUInt32LE(crc, 16); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(data.length, 24); head.writeUInt16LE(nameBytes.length, 28); head.writeUInt32LE(offset, 42);
    parts.push(local, nameBytes, data);
    central.push(head, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
const dex = (marker: boolean) => Buffer.from(`dex\n035\0 some classes ${marker ? 'Log USKOCI_RNR01 summary' : 'Log summary'} more`);

(shellAvailable() ? describe : describe.skip)('the attestation step of the dev APK workflow, executed on fake APKs', () => {
  function attestScript(): string {
    const lines = text(path.join(repo, apkWorkflow)).split('\n');
    const start = lines.findIndex(line => line.startsWith('      - name: Attest the Reanimated patch state'));
    const runAt = lines.findIndex((line, i) => i > start && line === '        run: |');
    expect(start).toBeGreaterThan(-1);
    expect(runAt).toBeGreaterThan(start);
    const body: string[] = [];
    for (let i = runAt + 1; i < lines.length; i++) {
      if (lines[i].trim() !== '' && !lines[i].startsWith('          ')) break;
      body.push(lines[i].slice(10));
    }
    return `${body.join('\n')}\n`;
  }

  function attest(expectState: 'patched' | 'unpatched', apk: Buffer | null) {
    const dir = path.join(scratch, `attest-${counter++}`);
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'pipe' });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: dir, stdio: 'pipe' });
    write(path.join(dir, 'node_modules', guard.LIBRARY, 'package.json'), JSON.stringify({ version: guard.LIBRARY_VERSION }));
    write(path.join(dir, target), fs.readFileSync(path.join(repo, target)));
    write(path.join(dir, 'patches', guard.PATCH_FILE), fs.readFileSync(path.join(repo, 'patches', guard.PATCH_FILE)));
    write(path.join(dir, 'USKOCI-DEV.apk.sha256'), 'abc  USKOCI-DEV.apk\n');
    if (apk) write(path.join(dir, 'USKOCI-DEV.apk'), apk);
    const output = path.join(dir, 'github-output.txt');
    write(output, '');
    write(path.join(dir, 'attest.sh'), attestScript());
    execFileSync('bash', ['-e', 'attest.sh'], { // GitHub runs a run: step without shell: as `bash -e {0}`: errexit is ON
      cwd: dir, encoding: 'utf8', timeout: 60000, stdio: 'pipe',
      env: { ...process.env, USKOCI_RNR01_EXPECT: expectState, GITHUB_OUTPUT: output.replace(/\\/g, '/'), GITHUB_RUN_ID: '1' },
    });
    const outputs = Object.fromEntries(text(output).split('\n').filter(Boolean).map(line => [line.split('=')[0], line.slice(line.indexOf('=') + 1)]));
    const receipt = JSON.parse(text(path.join(dir, 'USKOCI-DEV-reanimated-patch-attestation.json')));
    return { outputs, receipt };
  }

  const resources = { name: 'resources.arsc', data: Buffer.from('arsc') };
  const cases: [string, 'patched' | 'unpatched', Buffer | null, 'pass' | 'fail', number, number][] = [
    ['patched build, marker in classes.dex', 'patched', storeZip([{ name: 'classes.dex', data: dex(true) }, resources]), 'pass', 1, 1],
    ['patched build, marker only in classes3.dex (multidex)', 'patched', storeZip([{ name: 'classes.dex', data: dex(false) }, { name: 'classes3.dex', data: dex(true) }]), 'pass', 2, 1],
    ['patched build without the marker', 'patched', storeZip([{ name: 'classes.dex', data: dex(false) }]), 'fail', 1, 0],
    ['patched build with no dex file at all', 'patched', storeZip([resources]), 'fail', 0, 0],
    ['unpatched build without the marker', 'unpatched', storeZip([{ name: 'classes.dex', data: dex(false) }, resources]), 'pass', 1, 0],
    ['unpatched build that carries the marker', 'unpatched', storeZip([{ name: 'classes2.dex', data: dex(true) }]), 'fail', 1, 1],
    ['unpatched build with no dex file (must not pass vacuously)', 'unpatched', storeZip([resources]), 'fail', 0, 0],
    ['unpatched build whose APK cannot be read (must not pass vacuously)', 'unpatched', Buffer.from('this is not a zip file'), 'fail', 0, 0],
    ['unpatched build whose APK is missing (must not pass vacuously)', 'unpatched', null, 'fail', 0, 0],
  ];
  it.each(cases)('%s', (_name, expectState, apk, verdict, dexFiles, markerLines) => {
    const { outputs, receipt } = attest(expectState, apk);
    expect(outputs.verdict).toBe(verdict);
    expect(receipt.verdict).toBe(verdict);
    expect(receipt.patchState).toBe(expectState);
    expect(receipt.dexFiles).toBe(dexFiles);
    expect(receipt.dexMarkerLines).toBe(markerLines);
    expect(receipt.reanimatedVersion).toBe(guard.LIBRARY_VERSION);
    expect(receipt.patchFileSha256).toBe(guard.PIN.patchFile);
    expect(receipt.installedNativeProxySha256).toBe(guard.PIN.patchedTarget);
  });
});

describe('the committed patch against the real patch-package', () => {
  it('reverses to the pristine 4.5.1 file, re-applies to the reviewed bytes, and a second run changes nothing', () => {
    const dir = fixture();
    const file = path.join(dir, target);
    const patched = fs.readFileSync(file);

    patchPackage(dir, '--reverse', '--error-on-fail');
    const original = fs.readFileSync(file);
    expect(guard.sha256(original)).toBe(guard.PIN.originalTarget);
    expect(guard.verify({ root: dir, expect: 'unpatched' })).toEqual([]);
    expect(codes(guard.verify({ root: dir, expect: 'patched' }))).toEqual(expect.arrayContaining(['INSTALLED_MARKERS', 'INSTALLED_SHA']));

    patchPackage(dir, '--error-on-fail', '--error-on-warn');
    expect(fs.readFileSync(file).equals(patched)).toBe(true);
    expect(guard.verify({ root: dir, expect: 'patched' })).toEqual([]);
    expect(codes(guard.verify({ root: dir, expect: 'unpatched' }))).toContain('INSTALLED_NOT_PRISTINE');

    patchPackage(dir, '--error-on-fail', '--error-on-warn');
    expect(fs.readFileSync(file).equals(patched)).toBe(true);
    expect(guard.verify({ root: dir, expect: 'patched' })).toEqual([]);
  });

  it('exits non-zero, with the flags postinstall uses, when a hunk no longer applies', () => {
    const dir = fixture();
    // A library file that moved on: the pristine file with the patched function renamed, so neither the patch nor its reverse fits.
    write(path.join(dir, target), pristine().toString('utf8').replace('fun synchronouslyUpdateUIProps(', 'fun synchronouslyUpdateUIPropsMoved('));
    expect(() => patchPackage(dir, '--error-on-fail', '--error-on-warn')).toThrow();
  });

  it('exits non-zero, with the flags postinstall uses, when the library moves on to another version', () => {
    const dir = fixture();
    patchPackage(dir, '--reverse', '--error-on-fail');
    mutate(dir, path.join('node_modules', guard.LIBRARY, 'package.json'), before => before.replace(`"version": "${guard.LIBRARY_VERSION}"`, '"version": "4.7.0"'));
    expect(() => patchPackage(dir, '--error-on-fail', '--error-on-warn')).toThrow();
  });
});
