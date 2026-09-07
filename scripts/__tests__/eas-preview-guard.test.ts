import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { validatePreview } = require('../check-eas-preview.cjs');
const root = path.resolve(__dirname, '../..');
const appSource = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const easSource = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const ref = 'leqcwgzvjsxugfgzdmth';
const jwt = (role = 'anon', project = ref) => ['header',
  Buffer.from(JSON.stringify({ role, ref: project })).toString('base64url'), 'signature'].join('.');

function fixture() {
  return {
    app: structuredClone(appSource), eas: structuredClone(easSource),
    env: {
      EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'android',
      EAS_BUILD_PROJECT_ID: '1e6cc490-9851-4741-9226-128612122db6',
      EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt(), NODE_ENV: 'production',
    } as NodeJS.ProcessEnv,
  };
}

describe('actual EAS preview pre-install guard', () => {
  it.each([jwt(), 'sb_publishable_syntheticPublicFormOnly'])('admits public key form without Auth or network proof', (key) => {
    const input = fixture();
    input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
    expect(() => validatePreview(input)).not.toThrow();
  });

  it.each(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])('fails before build when %s is absent', (name) => {
    const input = fixture(); delete input.env[name];
    expect(() => validatePreview(input)).toThrow(/EXPO_PUBLIC_SUPABASE/);
  });

  it.each(['https://another.supabase.co', 'http://127.0.0.1:54321', `https://${ref}.supabase.co.evil.test`])('rejects a different backend', (url) => {
    const input = fixture(); input.env.EXPO_PUBLIC_SUPABASE_URL = url;
    expect(() => validatePreview(input)).toThrow(/confirmed canonical/);
  });

  it.each([jwt('service_role'), jwt('anon', 'anotherproject'), 'sb_secret_NEVER_LOG_THIS_KEY', 'garbage', 'header.bm90anNvbg.signature'])('rejects privileged, foreign or malformed credentials without including them in errors', (key) => {
    const input = fixture(); input.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
    expect(() => validatePreview(input)).toThrow(/must be a public/);
    try { validatePreview(input); } catch (error) { expect(String(error)).not.toContain(key); }
  });

  it.each(['owner', 'slug', 'projectId', 'package', 'jobProject'])('rejects accidental identity drift: %s', (field) => {
    const input = fixture();
    if (field === 'projectId') input.app.expo.extra.eas.projectId = 'other-project';
    else if (field === 'package') input.app.expo.android.package = 'rs.uskoci.other';
    else if (field === 'jobProject') input.env.EAS_BUILD_PROJECT_ID = 'other-project';
    else input.app.expo[field] = 'other';
    expect(() => validatePreview(input)).toThrow(/project|package/);
  });

  it.each([{ EXPO_PUBLIC_USE_FAKE_SOURCE: '1' }, { NODE_ENV: 'test' }, { JEST_WORKER_ID: '1' }])('rejects each actual fake-source composition switch: %j', (override) => {
    const input = fixture(); Object.assign(input.env, override);
    expect(() => validatePreview(input)).toThrow(/fake or test/);
  });

  it.each(['distribution', 'credentialsSource', 'buildType', 'versionSource', 'profile', 'platform'])('rejects a changed build boundary: %s', (field) => {
    const input = fixture();
    if (field === 'buildType') input.eas.build.preview.android.buildType = 'app-bundle';
    else if (field === 'versionSource') input.eas.cli.appVersionSource = 'local';
    else if (field === 'profile') input.env.EAS_BUILD_PROFILE = 'production';
    else if (field === 'platform') input.env.EAS_BUILD_PLATFORM = 'ios';
    else input.eas.build.preview[field] = 'other';
    expect(() => validatePreview(input)).toThrow(/preview/);
  });

  it.each([undefined, 1, 34, 35.5])('rejects a version reset below the existing build lineage', (version) => {
    const input = fixture(); input.app.expo.android.versionCode = version;
    expect(() => validatePreview(input)).toThrow(/seed floor/);
  });

  it('actual lifecycle command fails with a fixed diagnostic and never prints a rejected key', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, ...fixture().env, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_NEVER_LOG_THIS_KEY' };
    delete env.JEST_WORKER_ID;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-eas-preview.cjs')], { cwd: root, env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EAS preview preflight FAIL: EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(result.stdout + result.stderr).not.toContain('NEVER_LOG_THIS_KEY');
  });
});
