import type { SupportState } from './SupportController';

/**
 * The controller's own words about the last command, in one place, so a screen can draw each in the look that fits it
 * (round 5 review: a refused send was drawn as plain information). The words are unchanged; only their source moved.
 */
export const supportCopy = {
  committed: 'Radnja je potvrđena.',
  absent: 'Potvrda prethodne radnje još nije pronađena.',
  cancelled: 'Prvobitno slanje je zaustavljeno. Ranije primljen predmet ostaje sačuvan.',
  markedRead: 'Prikazani događaji su označeni kao pročitani.',
} as const;

/**
 * How a message of the support controller reads: `success` a confirmed command, `info` a plain fact the person chose
 * (a stopped send, events marked as read), `warn` something that waits for the person (a confirmation not found yet),
 * `danger` everything else: a failed read or a refused command, in the service's own words.
 */
export type SupportMessageTone = 'success' | 'info' | 'warn' | 'danger';
export function supportMessageTone(state: Pick<SupportState, 'phase' | 'message'>): SupportMessageTone {
  if (state.phase === 'ERROR') return 'danger';
  if (state.message === supportCopy.committed) return 'success';
  if (state.message === supportCopy.cancelled || state.message === supportCopy.markedRead) return 'info';
  if (state.message === supportCopy.absent) return 'warn';
  return 'danger';
}
