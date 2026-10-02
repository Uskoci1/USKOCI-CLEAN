'use strict';

// B22 / RNR-01 behaviour harness. Copies the three USKOCI RNR-01 regions of the patched NativeProxy.kt VERBATIM into a small class,
// compiles them with the Kotlin K2 compiler against the stubs next to this file (stub_*.kt), and runs the scenarios in Main.kt.
// It is a behaviour test of the guard logic, NOT the Gradle build of the app (the real compile gate is the CI APK build).
//
//   node run.cjs [path to the patched NativeProxy.kt]    default: the installed library file
//   ALLOW_UNPINNED=1 node run.cjs <file>                  test a candidate file that is not (yet) the pinned reviewed one
//   KOTLIN_LIB_DIR=<dir with the kotlin-compiler-embeddable-*.jar and friends>    default: newest ~/.gradle/wrapper/dists/gradle-*-bin/*/gradle-*/lib
//   KOTLIN_LANGUAGE_VERSION=2.1                           language and API level (the Kotlin of React Native 0.86's Gradle build)
//   MAIN_KT=<file>                                        run another scenario file instead of Main.kt (for example one scenario against an older patch)
//
// Needs Node and a JDK 17+ (java on PATH). Not sensitive to line endings of this checkout; the library file must be LF (patch-package writes LF).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const here = __dirname;
const repo = path.resolve(here, '..', '..', '..', '..', '..', '..');
const target = path.join('node_modules', 'react-native-reanimated', 'android', 'src', 'main', 'java', 'com', 'swmansion', 'reanimated', 'NativeProxy.kt');
const source = path.resolve(process.argv[2] ?? path.join(repo, target));
const languageVersion = process.env.KOTLIN_LANGUAGE_VERSION ?? '2.1';
const SEP = process.platform === 'win32' ? ';' : ':';

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

// 1. The Kotlin jars.
function findKotlinLibDir() {
  if (process.env.KOTLIN_LIB_DIR) return process.env.KOTLIN_LIB_DIR;
  const dists = path.join(os.homedir(), '.gradle', 'wrapper', 'dists');
  const found = [];
  try {
    for (const dist of fs.readdirSync(dists).filter(name => /^gradle-.*-bin$/.test(name))) {
      for (const hash of fs.readdirSync(path.join(dists, dist))) {
        const root = path.join(dists, dist, hash);
        for (const inner of fs.readdirSync(root).filter(name => /^gradle-/.test(name))) found.push(path.join(root, inner, 'lib'));
      }
    }
  } catch { /* no wrapper distribution */ }
  return found.filter(dir => fs.existsSync(dir) && fs.readdirSync(dir).some(name => /^kotlin-compiler-embeddable-\d/.test(name))).sort().pop();
}
const libDir = findKotlinLibDir();
if (!libDir) fail('No Kotlin jars found: set KOTLIN_LIB_DIR to a directory with kotlin-compiler-embeddable-*.jar (a Gradle distribution lib folder has them).');
const jar = prefix => {
  const names = fs.readdirSync(libDir).filter(name => name.startsWith(`${prefix}-`) && /^\d/.test(name.slice(prefix.length + 1)) && name.endsWith('.jar')).sort();
  if (!names.length) fail(`No ${prefix}-*.jar in ${libDir}`);
  return path.join(libDir, names[names.length - 1]);
};
const compiler = jar('kotlin-compiler-embeddable');
const stdlib = jar('kotlin-stdlib');
const classpath = [compiler, stdlib, jar('kotlin-script-runtime'), jar('kotlin-reflect'), jar('kotlin-daemon-embeddable'), jar('kotlinx-coroutines-core-jvm'), jar('annotations')].join(SEP);

// 2. The file under test must be the reviewed patched file (sha256 pinned in scripts/verify-native-patches.cjs).
let raw;
try {
  raw = fs.readFileSync(source);
} catch {
  fail(`Cannot read ${source}`);
}
const actual = crypto.createHash('sha256').update(raw).digest('hex');
if (process.env.ALLOW_UNPINNED !== '1') {
  const pinned = require(path.join(repo, 'scripts', 'verify-native-patches.cjs')).PIN.patchedTarget;
  if (actual !== pinned) fail(`${source} is not the pinned reviewed patched NativeProxy.kt (sha256 ${actual}, pinned ${pinned}). ALLOW_UNPINNED=1 tests a candidate.`, 3);
}
console.log(`kotlin ${path.basename(compiler, '.jar').replace('kotlin-compiler-embeddable-', '')}, language level ${languageVersion}; NativeProxy.kt sha256 ${actual}`);

// 3. Extract the verbatim regions.
const src = raw.toString('utf8');
if (src.includes('\r')) fail('The library file has CR bytes; the harness extracts LF text (patch-package writes LF).');
for (const marker of ['USKOCI patch RNR-01 (constants)', 'USKOCI patch RNR-01 (guard)', 'USKOCI patch RNR-01 (call site)']) {
  const count = src.split(marker).length - 1;
  if (count !== 1) fail(`Marker "${marker}" must occur exactly once, found ${count}.`);
}
const constantsAt = src.indexOf('        // USKOCI patch RNR-01 (constants)');
const constants = src.slice(constantsAt, src.indexOf('    }\n', constantsAt));
const guardAt = src.indexOf('    // USKOCI patch RNR-01 (guard)');
const funcAt = src.indexOf('    @DoNotStrip\n    fun synchronouslyUpdateUIProps(');
const funcEnd = src.indexOf('    @DoNotStrip\n    fun setGestureState(');
if ([constantsAt, guardAt, funcAt, funcEnd].some(at => at < 0)) fail('The patched regions were not found in the file.');
const guard = src.slice(guardAt, funcAt);
const func = src.slice(funcAt, funcEnd);

const harness = `package com.swmansion.reanimated

import android.os.SystemClock
import android.util.Log
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.fabric.FabricUIManager
import com.facebook.react.uimanager.IllegalViewOperationException
import com.swmansion.reanimated.nativeProxy.SynchronousPropsBufferParser

object BuildConfig { const val IS_REACT_NATIVE_86_OR_NEWER = true }

class FakeMountingManager {
    val invoked = ArrayList<Int>()
    val failing = HashSet<Int>()
    fun updatePropsSynchronously(tag: Int, props: Any?) {
        invoked.add(tag)
        if (tag in failing) throw IllegalStateException("boom " + tag)
    }
}

@Suppress("unused")
open class NativeProxy(val mFabricUIManager: FabricUIManager, val fake: FakeMountingManager) {
    companion object {
${constants}    }

    private val mountingManager: Any = fake
    // A real java.lang.reflect.Method, so a throwing target arrives wrapped in InvocationTargetException like in the app.
    private val updatePropsSynchronouslyMethod = FakeMountingManager::class.java.getMethod(
        "updatePropsSynchronously", Int::class.javaPrimitiveType, Any::class.java)

${guard}${func}}
`;

// 4. Compile (K2) and run.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr01-kotlin-'));
try {
  const harnessFile = path.join(work, 'Harness.kt');
  fs.writeFileSync(harnessFile, harness, 'utf8');
  const stubs = fs.readdirSync(here).filter(name => /^stub_.*\.kt$/.test(name)).sort().map(name => path.join(here, name));
  const out = path.join(work, 'out');
  const compile = spawnSync('java', ['-cp', classpath, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-jvm-target', '17',
    '-language-version', languageVersion, '-api-version', languageVersion, '-cp', stdlib, '-d', out, ...stubs, harnessFile, path.resolve(process.env.MAIN_KT ?? path.join(here, 'Main.kt'))], { stdio: 'inherit' });
  if (compile.error) fail(`Cannot start java: ${compile.error.message}`);
  if (compile.status !== 0) fail('The Kotlin compile failed (see above).', 4);
  console.log('--- compiled with no errors; running the scenarios');
  const run = spawnSync('java', ['-cp', `${out}${SEP}${stdlib}`, 'com.swmansion.reanimated.MainKt'], { stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
