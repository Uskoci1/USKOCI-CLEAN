import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgreementUploadRef } from './agreementPhotoClientService';
import { positiveInteger, record, uuid } from './serverReceipt';

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const queues = new Map<string, Promise<unknown>>();
const exactRef = (a: AgreementUploadRef, b: AgreementUploadRef) => a.agreementId === b.agreementId
  && a.agreementVersion === b.agreementVersion && a.clientRequestId === b.clientRequestId;
function parse(raw: string | null, accountId: string, agreementId: string): AgreementUploadRef[] {
  if (raw === null) return [];
  if (raw.length > 3000) throw new Error('PHOTO_JOURNAL_INVALID');
  const r = record(JSON.parse(raw));
  if (!r || Object.keys(r).length !== 4 || r.version !== 1 || r.accountId !== accountId || r.agreementId !== agreementId
    || !Array.isArray(r.uploads) || r.uploads.length > 6) throw new Error('PHOTO_JOURNAL_INVALID');
  const refs = r.uploads.map(rawRef => {
    const v = record(rawRef);
    if (!v || Object.keys(v).length !== 3 || v.agreementId !== agreementId || !positiveInteger(v.agreementVersion)
      || !uuid(v.clientRequestId) || v.clientRequestId !== v.clientRequestId.toLowerCase()) throw new Error('PHOTO_JOURNAL_INVALID');
    return { agreementId, agreementVersion: v.agreementVersion, clientRequestId: v.clientRequestId };
  });
  if (new Set(refs.map(ref => ref.clientRequestId)).size !== refs.length) throw new Error('PHOTO_JOURNAL_INVALID');
  return refs;
}
/** Opaque identities only. A per-account/Agreement queue prevents stale cleanup
 * or two mounted editors from overwriting an unresolved upload. */
export function createAgreementPhotoJournal(storage: Storage = AsyncStorage) {
  function run<T>(accountId: string, agreementId: string, work: (key: string) => Promise<T>): Promise<T> {
    if (!uuid(accountId) || !uuid(agreementId) || accountId !== accountId.toLowerCase() || agreementId !== agreementId.toLowerCase())
      return Promise.reject(new Error('PHOTO_JOURNAL_INVALID'));
    const key = `uskoci.agreement.photos.v1.${accountId}.${agreementId}`;
    const task = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => work(key));
    queues.set(key, task); void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => undefined); return task;
  }
  async function mutate(accountId: string, ref: AgreementUploadRef, current: () => boolean, remove: boolean) {
    const captured = { ...ref };
    parse(JSON.stringify({ version: 1, accountId, agreementId: captured.agreementId, uploads: [captured] }), accountId, captured.agreementId);
    return run(accountId, captured.agreementId, async key => {
      const old = parse(await storage.getItem(key), accountId, captured.agreementId);
      if (!current()) throw new Error('PHOTO_SCOPE_CHANGED');
      const found = old.find(v => v.clientRequestId === captured.clientRequestId);
      if (found && !exactRef(found, captured)) throw new Error('PHOTO_JOURNAL_CONFLICT');
      const uploads = remove ? old.filter(v => !exactRef(v, captured)) : found ? old : [...old, captured];
      if (uploads.length > 6) throw new Error('PHOTO_JOURNAL_CAPACITY');
      await storage.setItem(key, JSON.stringify({ version: 1, accountId, agreementId: captured.agreementId, uploads }));
      return uploads;
    });
  }
  return { load: (accountId: string, agreementId: string) => run(accountId, agreementId, async key => parse(await storage.getItem(key), accountId, agreementId)),
    save: (accountId: string, ref: AgreementUploadRef, current: () => boolean) => mutate(accountId, ref, current, false),
    clear: (accountId: string, ref: AgreementUploadRef, current: () => boolean) => mutate(accountId, ref, current, true) };
}
export const agreementPhotoJournal = createAgreementPhotoJournal();
