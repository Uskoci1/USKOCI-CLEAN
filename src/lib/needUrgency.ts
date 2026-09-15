import type { NeedUrgencyProjection } from '../contracts/projections';

/** Display expiry only; no transport, invented duration or activation authority. */
export function displaysUrgent(urgency: NeedUrgencyProjection | undefined, now = Date.now()): boolean {
  return urgency?.level === 'HITNO' && Date.parse(urgency.expiresAt) > now;
}
