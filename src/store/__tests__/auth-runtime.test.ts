import { povratniCilj } from '../povratniCilj';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    clear: jest.fn(async () => { store = {}; }),
  };
});

// Owner decision 1 (2026-09-19). What a person chose before signing in is a destination, kept by
// `povratniCilj` and handed back once to the account that completed it. It used to be applied to a
// global app mode as well; that mode is gone and the destination is all that is carried.
describe('Auth runtime: the chosen destination survives signing in', () => {
  beforeEach(async () => {
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

    if (pending) await povratniCilj.markCompleted('user-1', pending.intent);

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

  it('"Uskoči i zaradi" before Auth is carried as a destination, and sets no mode that could cost the account its own tasks', async () => {
    await povratniCilj.prepare({ intent: 'WORKER' });

    const pending = await povratniCilj.snapshot();
    expect(pending?.status).toBe('PENDING');

    if (pending) await povratniCilj.markCompleted('user-1', pending.intent);

    const consumed = await povratniCilj.consumeCompleted('user-1');
    expect(consumed?.intent.intent).toBe('WORKER');
    // The store has nothing left to set: the destination is the whole of what was chosen.
    expect(Object.keys(require('../uloga')).sort()).toEqual(['izvorSada', 'postaviIzvor', 'useIzvor']);
    expect(await povratniCilj.snapshot()).toBeNull();
  });
});
