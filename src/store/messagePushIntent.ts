export type MessagePushOwner = { accountId: string; accountRevision: number; sessionEpoch: number };
export type MessagePushIntent = MessagePushOwner & { serial: number; eventId: string; at: number; coldRoute: number | null };
let intent: MessagePushIntent | null = null;
let serial = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

/** Memory-only navigation intent. It is not a message, receipt or durable command. */
export const messagePushIntent = {
  snapshot: () => intent,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  remember(eventId: string, owner: MessagePushOwner, coldRoute: number | null) {
    intent = { ...owner, eventId, coldRoute, serial: ++serial, at: Date.now() }; emit();
  },
  retire(expected: number) { if (intent?.serial === expected) { intent = null; emit(); } },
  clear() { if (intent) { intent = null; emit(); } },
};

export function ownsMessagePush(value: MessagePushIntent, owner: MessagePushOwner): boolean {
  return value.accountId === owner.accountId && value.accountRevision === owner.accountRevision
    && value.sessionEpoch === owner.sessionEpoch;
}
