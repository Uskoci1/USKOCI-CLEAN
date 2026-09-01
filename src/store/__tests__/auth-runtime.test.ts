import { povratniCilj } from '../povratniCilj';
import { postaviUlogu, ulogaSada, resetujUlogu } from '../uloga';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    clear: jest.fn(async () => { store = {}; }),
  };
});

describe('Auth Runtime & Role Continuity', () => {
  beforeEach(async () => {
    resetujUlogu();
    await povratniCilj.clear();
  });

  it('preserves typed requester draft and same conversation through Auth', async () => {
    await povratniCilj.prepare({
      intent: 'REQUESTER',
      returnTarget: { kind: 'REQUESTER_DRAFT', draftKey: 'conversation-123' },
    });

    const pending = await povratniCilj.snapshot();
    expect(pending?.status).toBe('PENDING');
    expect(pending?.intent.returnTarget).toEqual({
      kind: 'REQUESTER_DRAFT',
      draftKey: 'conversation-123',
    });

    if (pending) {
      await povratniCilj.markCompleted('user-1', pending.intent);
      if (pending.intent.intent === 'WORKER') postaviUlogu('uskocer');
      else postaviUlogu('narucilac');
    }

    expect(ulogaSada()).toBe('narucilac');
    const completed = await povratniCilj.snapshot();
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.completedByUserId).toBe('user-1');
    expect(completed?.intent.returnTarget).toEqual({
      kind: 'REQUESTER_DRAFT',
      draftKey: 'conversation-123',
    });

    const consumed = await povratniCilj.consumeCompleted('user-1');
    expect(consumed?.intent.returnTarget).toEqual({
      kind: 'REQUESTER_DRAFT',
      draftKey: 'conversation-123',
    });
    expect(await povratniCilj.snapshot()).toBeNull();
  });

  it('does not hand a completed return target to a different user', async () => {
    await povratniCilj.markCompleted('user-1', {
      intent: 'REQUESTER',
      returnTarget: { kind: 'REQUESTER_DRAFT', draftKey: 'conversation-123' },
    });

    expect(await povratniCilj.consumeCompleted('user-2')).toBeNull();
    expect(await povratniCilj.snapshot()).toBeNull();
  });

  it('WORKER intent -> Auth -> Worker workspace without losing Requester capability', async () => {
    await povratniCilj.prepare({ intent: 'WORKER' });

    const pending = await povratniCilj.snapshot();
    expect(pending?.status).toBe('PENDING');

    if (pending) {
      await povratniCilj.markCompleted('user-1', pending.intent);
      if (pending.intent.intent === 'WORKER') postaviUlogu('uskocer');
      else postaviUlogu('narucilac');
    }

    expect(ulogaSada()).toBe('uskocer');
    postaviUlogu('narucilac');
    expect(ulogaSada()).toBe('narucilac');
  });
});
