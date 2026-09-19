import type { MojaPrijavaProjekcija, PotrebaProjekcija } from '../contracts/projections';
import type { HomeSection } from './homeSnapshot';

/**
 * What this account is to one task (owner decision 1, 2026-09-19).
 *
 * The app used to answer this with the mode it was in: in the requester mode every task was one to
 * look at, in the worker mode every task was one to apply to, and a person had to switch the whole
 * app to do the other. The answer is in data the account already reads: a task is mine if my own
 * tasks contain it, and I have applied if my own applications point at it. Both are account-scoped
 * on the server, so nothing here can name somebody else's task or application.
 *
 * `UNKNOWN` is a read that failed with no positive evidence from the other side. It is never
 * shown as `NONE`: not knowing whether I have applied is not a licence to offer applying. The
 * server still refuses an application to my own task and a duplicate, whatever this says.
 *
 * There is no per-task reader, so this costs the two whole lists. A bounded
 * "my relation to task X" reader is a READ_CONTRACT item for the third slice.
 */
export type RelationReads = { needs: HomeSection<PotrebaProjekcija[]>; applications: HomeSection<MojaPrijavaProjekcija[]> };
export type TaskRelation = { kind: 'OWNER' } | { kind: 'APPLIED'; applicationId: string; agreementId: string | null }
  | { kind: 'NONE' } | { kind: 'UNKNOWN' };

const standing = (row: MojaPrijavaProjekcija) => row.stanje !== 'WITHDRAWN' && row.stanje !== 'CLOSED';

export function taskRelation(needId: string, reads: RelationReads): TaskRelation {
  if (reads.needs.kind === 'known' && reads.needs.value.some(row => row.id === needId)) return { kind: 'OWNER' };
  const application = reads.applications.kind === 'known'
    ? reads.applications.value.find(row => row.potrebaId === needId && standing(row)) : undefined;
  if (application) return { kind: 'APPLIED', applicationId: application.prijavaId, agreementId: application.dogovorId };
  return reads.needs.kind === 'known' && reads.applications.kind === 'known' ? { kind: 'NONE' } : { kind: 'UNKNOWN' };
}

/** Labels for a whole list. A side that could not be read labels nothing; it does not guess. */
export function relationIndex(reads: RelationReads): { owned: ReadonlySet<string>; applied: ReadonlySet<string> } {
  return { owned: new Set(reads.needs.kind === 'known' ? reads.needs.value.map(row => row.id) : []),
    applied: new Set(reads.applications.kind === 'known' ? reads.applications.value.filter(standing).map(row => row.potrebaId) : []) };
}
