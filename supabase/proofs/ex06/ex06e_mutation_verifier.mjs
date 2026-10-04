import assert from 'node:assert/strict';

/** No network and no database here. A denied write is proven by readback,
 * not merely by an HTTP status, an error, or an empty response. */
export function verifyClosedSearchMutationDenied(result, before, after) {
  assert.ok(before && after, 'MUTATION_READBACK_MISSING');
  assert.match(before.id, /^[0-9a-f-]{36}$/i, 'MUTATION_SUBJECT_INVALID');
  assert.equal(after.id, before.id, 'MUTATION_SUBJECT_CHANGED');
  assert.equal(typeof before.remaining_search_closed_at, 'string', 'SEARCH_WAS_NOT_CLOSED');
  assert.ok(before.remaining_search_closed_at.length > 0, 'SEARCH_WAS_NOT_CLOSED');
  assert.equal(typeof before.need_hash, 'string', 'MUTATION_FINGERPRINT_MISSING');
  assert.match(before.need_hash, /^[0-9a-f]{32}$/i, 'MUTATION_FINGERPRINT_INVALID');
  assert.deepEqual(after, before, 'FORBIDDEN_MUTATION_CHANGED_STATE');
  assert.ok(result && Object.hasOwn(result, 'error'), 'MUTATION_REPLY_INVALID');
  if (result.error !== null) {
    assert.equal(result.error?.code, '42501', 'UNEXPECTED_MUTATION_ERROR');
    return { directMutationDenied: true, denialMechanism: 'EXPLICIT_PERMISSION_DENIAL', stateUnchanged: true };
  }
  assert.deepEqual(result.data, [], 'MUTATION_RETURNED_ROWS_OR_UNKNOWN');
  return { directMutationDenied: true, denialMechanism: 'RLS_ZERO_ROWS', stateUnchanged: true };
}
