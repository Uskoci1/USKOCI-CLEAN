'use strict';
// Existing EAS read only. Private bytes never enter Git, stdout, stderr, or command arguments.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const assert = require('node:assert/strict');
const eas = 'C:/Users/user/AppData/Local/npm-cache/_npx/03e34f479f818b15/node_modules/eas-cli/build';
const {createGraphqlClient} = require(eas + '/commandUtils/context/contextUtils/createGraphqlClient');
const SessionManager = require(eas + '/user/SessionManager').default;
const privateRoot = 'C:/Users/user/AppData/Local/USKOCI/build-signing-v5-20260912';
const expectedCertificate = 'df2edf3f91abcb1df10eac03802ba55caedc29aee3d7188846182e0e49015782';
let stage = 'LOCAL_AUTH';
(async () => {
  const session = new SessionManager({setActor() {}});
  const auth = {accessToken:session.getAccessToken(),sessionSecret:session.getSessionSecret()};
  assert.ok(auth.accessToken || auth.sessionSecret);
  const client = createGraphqlClient(auth);
  stage = 'READ_EXISTING_KEYSTORE';
  const result = await client.query(`query ExistingTeamAndroidSigning($name:String!, $package:String!) {
    app { byFullName(fullName:$name) { id androidAppCredentials(filter:{applicationIdentifier:$package}) {
      applicationIdentifier androidAppBuildCredentialsList { id isDefault androidKeystore {
        id type keystore keystorePassword keyAlias keyPassword sha256CertificateFingerprint
      } }
    } } }
  }`, {name:'@sljivas-team/uskoci',package:'rs.uskoci.preview'}, {noRetry:true}).toPromise();
  assert.ok(!result.error && result.data);
  const app = result.data.app.byFullName;
  assert.equal(app.id, '1e6cc490-9851-4741-9226-128612122db6');
  const entries = app.androidAppCredentials;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].applicationIdentifier, 'rs.uskoci.preview');
  const defaults = entries[0].androidAppBuildCredentialsList.filter(x => x.isDefault);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, '3125abb1-bb30-40e3-8528-495865839ffe');
  const key = defaults[0].androidKeystore;
  assert.equal(key.id, 'd2eed5ee-6012-42e6-ba3e-009f5c6cbb6f');
  assert.equal(key.type, 'JKS');
  assert.equal(key.sha256CertificateFingerprint.replaceAll(':','').toLowerCase(), expectedCertificate);
  assert.ok(fs.statSync(privateRoot).isDirectory());
  const keystorePath = path.join(privateRoot, 'existing-team-preview.jks');
  const protectedPath = path.join(privateRoot, 'existing-team-preview.dpapi');
  stage = 'SAVE_PRIVATE_KEYSTORE';
  fs.writeFileSync(keystorePath, Buffer.from(key.keystore,'base64'), {mode:0o600,flag:'wx'});
  stage = 'VERIFY_ACTUAL_CERTIFICATE';
  const cert = execFileSync('keytool', ['-exportcert','-keystore',keystorePath,'-alias',key.keyAlias,
    '-storepass:env','USKOCI_CERT_VERIFY_PASSWORD'], {env:{...process.env,USKOCI_CERT_VERIFY_PASSWORD:key.keystorePassword},
    stdio:['ignore','pipe','pipe'],timeout:30000});
  assert.equal(createHash('sha256').update(cert).digest('hex'), expectedCertificate);
  stage = 'PROTECT_LOCAL_CREDENTIALS';
  assert.ok(!fs.existsSync(protectedPath));
  const protectedResult = spawnSync('pwsh', ['-NoProfile','-File',path.join(__dirname,'protect-signing.ps1'),'-OutputPath',protectedPath],
    {input:JSON.stringify({keystorePath,keystorePassword:key.keystorePassword,keyAlias:key.keyAlias,keyPassword:key.keyPassword}),
      encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000});
  assert.equal(protectedResult.status,0);
  const receipt = {observedAtUtc:new Date().toISOString(), projectId:app.id,package:entries[0].applicationIdentifier,
    certificateSha256:expectedCertificate,metadataAndActualCertificateMatch:true,privateDirectory:privateRoot,
    passwordStorage:'Windows DPAPI current-user protected file',privateMaterialInGit:false,credentialsChanged:false,buildStarted:false};
  fs.writeFileSync(path.join(__dirname,'signing-download-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  process.stdout.write(JSON.stringify(receipt)+'\n');
})().catch(() => {process.stderr.write('Existing signing preparation failed at '+stage+'; no credential values printed.\n');process.exitCode=1;});
