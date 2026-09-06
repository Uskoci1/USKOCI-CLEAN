import assert from 'node:assert/strict';

/** Reject non-local fixture targets before creating clients or issuing any write.
 * Ports are the existing ru5_device_ui_live79_env.sh contract, not production policy.
 * Never include a supplied URL in an error: database URLs can contain credentials.
 */
export function assertLocalDeviceProofTargets(apiUrl, dbUrl) {
  let api;
  let db;
  try {
    api = new URL(apiUrl);
    db = new URL(dbUrl);
  } catch {
    throw new Error('RU5_DEVICE_TARGET_INVALID: explicit local proof URLs required');
  }
  assert.ok(
    api.protocol === 'http:' && api.hostname === '127.0.0.1' && api.port === '54321'
      && api.pathname === '/' && !api.username && !api.password && !api.search && !api.hash,
    'RU5_DEVICE_API_NOT_LOCAL: fixture writes require the disposable loopback API',
  );
  assert.ok(
    db.protocol === 'postgresql:' && db.hostname === '127.0.0.1' && db.port === '54322'
      && db.pathname === '/postgres' && db.username === 'postgres' && !db.search && !db.hash,
    'RU5_DEVICE_DB_NOT_LOCAL: fixture writes require the disposable loopback database',
  );
}
