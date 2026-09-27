export type PublicPushTarget = { kind: 'INBOX' } | { kind: 'MESSAGE_EVENT'; eventId: string };

/** Provider metadata supplies an opaque event, never a route or message body. */
export function publicPushTarget(value: unknown): PublicPushTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.kind !== 'INBOX') return null;
  if (Object.keys(data).length === 1) return { kind: 'INBOX' };
  if (Object.keys(data).length !== 3 || data.eventType !== 'MESSAGE_RECEIVED'
    || typeof data.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.eventId)) return null;
  return { kind: 'MESSAGE_EVENT', eventId: data.eventId.toLowerCase() };
}
