'use strict';

// EAS-only lifecycle hook: built-ins suffice before dependency installation.
// No network, credential reads, environment writes, or key values in output.
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = '1e6cc490-9851-4741-9226-128612122db6';
const SUPABASE_REF = 'leqcwgzvjsxugfgzdmth';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isPublicKeyForm(value) {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
    return payload.role === 'anon' && payload.ref === SUPABASE_REF;
  } catch {
    return false;
  }
}

function validatePreview({ app, eas, env }) {
  const expo = app?.expo;
  const preview = eas?.build?.preview;
  requireCondition(expo?.owner === 'sljivas-team' && expo?.slug === 'uskoci' &&
    expo?.extra?.eas?.projectId === PROJECT_ID, 'Expected the existing @sljivas-team/uskoci EAS project.');
  requireCondition(expo?.android?.package === 'rs.uskoci.preview', 'Expected the existing Android preview package.');
  requireCondition(Number.isSafeInteger(expo?.android?.versionCode) && expo.android.versionCode >= 35,
    'Android versionCode must retain the source seed floor of 35.');
  requireCondition(eas?.cli?.appVersionSource === 'remote' && preview?.autoIncrement === true &&
    preview?.distribution === 'internal' && preview?.environment === 'preview' &&
    preview?.credentialsSource === 'remote' && preview?.android?.buildType === 'apk',
  'Expected the reviewed preview internal APK profile with remote credentials and version increment.');
  requireCondition(env.EAS_BUILD_PROFILE === 'preview' && env.EAS_BUILD_PLATFORM === 'android',
    'This EAS hook admits only the reviewed Android preview build.');
  requireCondition(!env.EAS_BUILD_PROJECT_ID || env.EAS_BUILD_PROJECT_ID === PROJECT_ID,
    'The EAS job project does not match the selected existing project.');
  requireCondition(env.EXPO_PUBLIC_USE_FAKE_SOURCE !== '1' && env.NODE_ENV !== 'test' &&
    env.JEST_WORKER_ID === undefined, 'Preview cannot use the fake or test data composition.');
  requireCondition(env.EXPO_PUBLIC_SUPABASE_URL === `https://${SUPABASE_REF}.supabase.co`,
    'EXPO_PUBLIC_SUPABASE_URL must identify the confirmed canonical Supabase project.');
  requireCondition(isPublicKeyForm(env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    'EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public publishable key or canonical-project anon JWT.');
}

function main() {
  let app;
  let eas;
  try {
    const root = path.resolve(__dirname, '..');
    app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  } catch {
    console.error('EAS preview preflight FAIL: could not read the source app/EAS configuration.');
    return 1;
  }
  try {
    validatePreview({ app, eas, env: process.env });
    console.log('EAS preview preflight PASS: existing project/package/profile and public environment form. Auth, signing artifact and push delivery remain unproven.');
    return 0;
  } catch (error) {
    console.error(`EAS preview preflight FAIL: ${error.message}`);
    return 1;
  }
}

module.exports = { validatePreview };
if (require.main === module) process.exitCode = main();
