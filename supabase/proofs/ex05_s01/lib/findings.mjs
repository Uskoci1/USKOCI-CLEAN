// EX05-S01: finding classifiers (pure). A proof of this package RECORDS what the server actually does (an observation without private data) and one of these functions names the
// finding; only an UNEXPECTED_SHAPE turns the recorded check red (a harness or contract surprise). A reproduced gap is a FINDING for the owner, never a failed build:
// EX05-S01 binds "record actual behaviour; if a defect is real, write it up and stop at an unapplied candidate decision" (EX05_CANONICAL_SCOPE_20261001.md, slice EX05-S01).
export const FINDING = Object.freeze({
  G22_GAP: 'CONTRACT_GAP_PUSH_ARRIVES_BUT_EXACT_TARGET_UNAVAILABLE',
  G22_NO_GAP: 'NO_GAP_EXACT_TARGET_SERVED',
  G22_PUSH_NOT_CREATED: 'NOT_REACHABLE_NO_PUSH_DELIVERY',
  G16_GAP: 'GAP_REPRODUCED_GROUP_SEND_EMITS_NO_EVENT_OR_DELIVERY',
  G16_CHANGED: 'CHANGED_GROUP_SEND_NOW_EMITS_EVENTS_OR_DELIVERIES',
  UNEXPECTED: 'UNEXPECTED_SHAPE',
});
export const FAIL_ON_UNEXPECTED = Object.freeze([FINDING.UNEXPECTED]);

/**
 * G22 (EX05_CANONICAL_SCOPE G22): a recipient with push ON and in-app OFF. emit_event creates the IN_APP delivery SUPPRESSED (IN_APP_OFF) and the PUSH delivery CREATED; the P4 resolver
 * (rpc_resolve_activity_message_v1) and the displayed-ACK both require an IN_APP delivery that is not suppressed. The observation:
 *   {inApp:{state,suppressionReason}, push:{state,suppressionReason}, begin:{kind,eventType,eventIdPresent}|null, resolver:{kind}, ack:{markedEventCount}, window:{targetMatches}}
 */
export function classifyInAppOffPush(observation) {
  const o = observation;
  if (!o || typeof o !== 'object' || !o.inApp || !o.push || !o.resolver) return FINDING.UNEXPECTED;
  if (o.push.state !== 'CREATED') return FINDING.G22_PUSH_NOT_CREATED;
  if (o.inApp.state !== 'SUPPRESSED') return FINDING.UNEXPECTED;
  if (o.resolver.kind === 'AGREEMENT_MESSAGE') return FINDING.G22_NO_GAP;
  if (o.resolver.kind === 'UNAVAILABLE' && o.begin && o.begin.kind === 'SEND' && o.begin.eventType === 'MESSAGE_RECEIVED' && o.begin.eventIdPresent === true) return FINDING.G22_GAP;
  return FINDING.UNEXPECTED;
}

/** G16 (EX05_CANONICAL_SCOPE G16): a group message creates no event, no delivery and no invalidation row. The observation holds the row-count deltas around ONE group send. */
export function classifyGroupNotifications(observation) {
  const o = observation;
  if (!o || typeof o !== 'object' || !(o.messagesAdded > 0)) return FINDING.UNEXPECTED;
  if (o.eventsAdded === 0 && o.deliveriesAdded === 0) return FINDING.G16_GAP;
  if (o.eventsAdded > 0 || o.deliveriesAdded > 0) return FINDING.G16_CHANGED;
  return FINDING.UNEXPECTED;
}
