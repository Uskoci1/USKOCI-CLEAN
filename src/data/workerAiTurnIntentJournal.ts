import AsyncStorage from '@react-native-async-storage/async-storage';
import { record, uuid } from './serverReceipt';

export type WorkerAiTurnIntent = { accountId: string; conversationId: string; clientRequestId: string };
const key = (accountId: string) => `uskoci.worker.ai.turn.intent.v1.${accountId}`;
const chains = new Map<string, Promise<unknown>>();
function queue<T>(accountId: string, work: () => Promise<T>): Promise<T> {
  const next = (chains.get(accountId) ?? Promise.resolve()).catch(() => undefined).then(work);
  chains.set(accountId, next);
  void next.finally(() => { if (chains.get(accountId) === next) chains.delete(accountId); }).catch(() => undefined);
  return next;
}
function parse(raw: string | null, accountId: string): WorkerAiTurnIntent | null {
  if (!uuid(accountId)) throw new Error('WORKER_AI_LOCAL_INTENT_INVALID');
  if (raw === null) return null;
  const value = record(JSON.parse(raw));
  if (!value || Object.keys(value).length !== 3 || value.accountId !== accountId
    || !uuid(value.conversationId) || !uuid(value.clientRequestId)) throw new Error('WORKER_AI_LOCAL_INTENT_INVALID');
  return { accountId, conversationId: value.conversationId, clientRequestId: value.clientRequestId };
}
/** Opaque IDs only. Unknown outcomes survive app exit/logout. The calling UI
 * must resolve or explicitly fence the same server command before clearing. */
export const workerAiTurnIntentJournal = {
  load: (accountId: string) => queue(accountId, async () => parse(await AsyncStorage.getItem(key(accountId)), accountId)),
  save: (intent: WorkerAiTurnIntent) => queue(intent.accountId, async () => {
    const encoded = JSON.stringify(intent);
    parse(encoded, intent.accountId);
    const old = parse(await AsyncStorage.getItem(key(intent.accountId)), intent.accountId);
    if (old && (old.conversationId !== intent.conversationId || old.clientRequestId !== intent.clientRequestId))
      throw new Error('WORKER_AI_UNRESOLVED_INTENT');
    await AsyncStorage.setItem(key(intent.accountId), encoded);
  }),
  clear: (intent: WorkerAiTurnIntent) => queue(intent.accountId, async () => {
    const old = parse(await AsyncStorage.getItem(key(intent.accountId)), intent.accountId);
    if (old?.conversationId === intent.conversationId && old.clientRequestId === intent.clientRequestId)
      await AsyncStorage.removeItem(key(intent.accountId));
  }),
};
