import { forgetAgreementOutboxes } from '../agreementOutbox';

// Deep read 7.28: an explicit logout forgets this account's Agreement message text on the device.
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const AGREEMENT = '33333333-3333-4333-8333-333333333333';
function memory(keys: string[]) {
  const store = new Set(keys);
  return { store, getAllKeys: async () => [...store], multiRemove: async (remove: readonly string[]) => { remove.forEach(k => store.delete(k)); } };
}

it("removes only this account's outboxes and nothing else", async () => {
  const storage = memory([`uskoci:agreement-outbox:v1:${A}:${AGREEMENT}`, `uskoci:agreement-outbox:v1:${A}:${B}`,
    `uskoci:agreement-outbox:v1:${B}:${AGREEMENT}`, 'uskoci:application-journal:v1:x', 'unrelated']);
  await expect(forgetAgreementOutboxes(A, storage)).resolves.toBe(2);
  expect([...storage.store].sort()).toEqual([`uskoci:agreement-outbox:v1:${B}:${AGREEMENT}`, 'uskoci:application-journal:v1:x', 'unrelated'].sort());
});

it('does nothing for an account id that is not a uuid', async () => {
  const storage = memory([`uskoci:agreement-outbox:v1:${A}:${AGREEMENT}`]);
  await expect(forgetAgreementOutboxes('', storage)).resolves.toBe(0);
  expect(storage.store.size).toBe(1);
});
