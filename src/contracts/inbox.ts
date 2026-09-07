export type InboxRole = 'REQUESTER' | 'WORKER';
export type InboxItem = {
  id: string; eventType: string; role: InboxRole; occurredAt: string;
  readAt: string | null; title: string; body: string; family: string;
};
export type InboxCursor = { at: string; id: string };
export type InboxPage = { items: InboxItem[]; hasMore: boolean; unreadCount: number; asOf: string };
export type InboxTarget = { kind: 'UNAVAILABLE' } | {
  kind: 'AGREEMENT' | 'APPLICATIONS' | 'CANDIDATES' | 'OWN_NEED' | 'OPPORTUNITY';
  id: string; role: InboxRole;
};
export interface InboxPort {
  list(role: InboxRole | null, cursor?: InboxCursor, limit?: number): Promise<InboxPage>;
  read(id: string): Promise<string>;
  readAll(through: string, role: InboxRole | null): Promise<number>;
  resolve(id: string): Promise<InboxTarget>;
}
