import type { MojaPrijavaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { relationIndex, taskRelation, type RelationReads } from '../taskRelation';

const need = (id: string) => ({ id, stanje: 'OBJAVLJENA' } as PotrebaProjekcija);
const application = (needId: string, patch: Partial<MojaPrijavaProjekcija> = {}) => ({ prijavaId: `a-${needId}`, potrebaId: needId,
  stanje: 'SUBMITTED', dogovorId: null, ...patch } as MojaPrijavaProjekcija);
const known = <T,>(value: T) => ({ kind: 'known' as const, value });
const reads = (patch: Partial<RelationReads> = {}): RelationReads => ({ needs: known([]), applications: known([]), ...patch });

/**
 * What one account is to one task, from the two account-scoped reads that already exist. It used to
 * be answered by the mode the whole app was in: "requester mode" meant the task was treated as
 * mine to look at and not to apply to, whoever had actually published it.
 */
describe('my relation to a task comes from my own tasks and my own applications, never from a mode', () => {
  it('knows my own task, my application, and a task I am nothing to yet', () => {
    const mine = reads({ needs: known([need('t-a')]), applications: known([application('t-c')]) });
    expect(taskRelation('t-a', mine)).toEqual({ kind: 'OWNER' });
    expect(taskRelation('t-c', mine)).toEqual({ kind: 'APPLIED', applicationId: 'a-t-c', agreementId: null });
    expect(taskRelation('t-x', mine)).toEqual({ kind: 'NONE' });
  });

  it('a selected application points at its own Dogovor', () => {
    expect(taskRelation('t-c', reads({ applications: known([application('t-c', { stanje: 'SELECTED', dogovorId: 'g-c' })]) })))
      .toEqual({ kind: 'APPLIED', applicationId: 'a-t-c', agreementId: 'g-c' });
  });

  it('an application that is over does not stand in the way of a new one; the server decides that', () => {
    for (const stanje of ['WITHDRAWN', 'CLOSED'] as const)
      expect(taskRelation('t-c', reads({ applications: known([application('t-c', { stanje })]) }))).toEqual({ kind: 'NONE' });
  });

  it('a read that failed is unknown, not "nothing": it never turns into a licence to apply', () => {
    expect(taskRelation('t-x', reads({ applications: { kind: 'unavailable' } }))).toEqual({ kind: 'UNKNOWN' });
    expect(taskRelation('t-x', reads({ needs: { kind: 'unavailable' } }))).toEqual({ kind: 'UNKNOWN' });
    // Positive evidence from the side that was read still counts.
    expect(taskRelation('t-a', reads({ needs: known([need('t-a')]), applications: { kind: 'unavailable' } }))).toEqual({ kind: 'OWNER' });
    expect(taskRelation('t-c', reads({ needs: { kind: 'unavailable' }, applications: known([application('t-c')]) })))
      .toEqual({ kind: 'APPLIED', applicationId: 'a-t-c', agreementId: null });
  });

  it('labels a whole list at once and leaves unread sides unlabelled rather than guessed', () => {
    const index = relationIndex(reads({ needs: known([need('t-a'), need('t-b')]), applications: known([application('t-c'), application('t-d', { stanje: 'WITHDRAWN' })]) }));
    expect([...index.owned]).toEqual(['t-a', 't-b']); expect([...index.applied]).toEqual(['t-c']);
    const blind = relationIndex(reads({ needs: { kind: 'unavailable' }, applications: { kind: 'unavailable' } }));
    expect(blind.owned.size).toBe(0); expect(blind.applied.size).toBe(0);
  });
});
