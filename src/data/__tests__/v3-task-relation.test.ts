import { noTaskRelations, taskRelationIndex, type TaskRelation } from '../taskRelation';

/** One row as public.rpc_get_my_task_relations builds it. */
const applied = (needId: string, state: string, patch: Record<string, unknown> = {}) => ({
  needId, relation: 'APPLIED', applicationId: 'a-' + needId, applicationState: state, agreementId: null, ...patch,
});
const owner = (needId: string) => ({ needId, relation: 'OWNER', applicationId: null, applicationState: null, agreementId: null });
const invalid = (rows: unknown[], asked: string[]) => () => taskRelationIndex(rows, asked);

describe('what I am to the tasks on screen (PKG-023b overlay)', () => {
  it('reads the server answer for the ids it asked about', () => {
    const index = taskRelationIndex([owner('t-a'), applied('t-c', 'SUBMITTED', { agreementId: 'd-1' })], ['t-a', 't-b', 't-c']);
    expect(index.relation('t-a')).toEqual({ kind: 'OWNER' });
    expect(index.relation('t-c')).toEqual({ kind: 'APPLIED', applicationId: 'a-t-c', agreementId: 'd-1' });
    expect([...index.owned]).toEqual(['t-a']);
    expect([...index.applied]).toEqual(['t-c']);
  });

  it('a task the server did not name is NONE, and one nobody asked about is UNKNOWN', () => {
    const index = taskRelationIndex([owner('t-a')], ['t-a', 't-b']);
    // Absent from the answer means "not mine and not applied to" only for a task that was asked.
    expect(index.relation('t-b')).toEqual({ kind: 'NONE' });
    // Never NONE for a task this read never covered: not knowing is not a licence to offer applying.
    expect(index.relation('t-z')).toEqual({ kind: 'UNKNOWN' });
    expect(noTaskRelations.relation('t-a')).toEqual({ kind: 'UNKNOWN' });
  });

  it('a withdrawn or closed application leaves the task open to apply to again', () => {
    for (const state of ['WITHDRAWN', 'CLOSED']) {
      const index = taskRelationIndex([applied('t-c', state)], ['t-c']);
      expect(index.relation('t-c')).toEqual({ kind: 'NONE' });
      expect([...index.applied]).toEqual([]);
    }
  });

  it('every standing application state is a standing relation', () => {
    for (const state of ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED', 'SELECTED']) {
      const index = taskRelationIndex([applied('t-c', state)], ['t-c']);
      expect((index.relation('t-c') as Extract<TaskRelation, { kind: 'APPLIED' }>).kind).toBe('APPLIED');
      expect([...index.applied]).toEqual(['t-c']);
    }
  });

  it('an answer it cannot stand behind is not a label', () => {
    // A task nobody asked about, a repeated answer, an unknown relation or state, a missing
    // application id: each one throws, so the screen shows no labels instead of wrong ones.
    expect(invalid([owner('t-x')], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
    expect(invalid([owner('t-a'), applied('t-a', 'SUBMITTED')], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
    expect(invalid([{ needId: 't-a', relation: 'WATCHING' }], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
    expect(invalid([applied('t-a', 'INTERESTED')], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
    expect(invalid([applied('t-a', 'SUBMITTED', { applicationId: null })], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
    expect(invalid([applied('t-a', 'SUBMITTED', { agreementId: 7 })], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
    expect(invalid([null], ['t-a'])).toThrow('TASK_RELATIONS_INVALID_PROJECTION');
  });
});
