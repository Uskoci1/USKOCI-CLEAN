
import { povratniCilj } from '../povratniCilj';
import { postaviUlogu, ulogaSada, resetujUlogu } from '../uloga';

// Mock AsyncStorage
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

  it('preserves guest draft intent and resolves to correct workspace (REQUESTER)', async () => {
    // 1. Guest creates draft
    await povratniCilj.prepare({ intent: 'REQUESTER', returnTarget: { kind: 'REQUESTER_DRAFT', draftKey: '123' } } as any);
    
    // 2. Auth transition (Auth is successful, layout calls resolution)
    const pending = await povratniCilj.snapshot();
    expect(pending?.status).toBe('PENDING');
    
    if (pending) {
      await povratniCilj.markCompleted('user-1', pending.intent);
      if (pending.intent.intent === 'WORKER') postaviUlogu('uskocer');
      else postaviUlogu('narucilac');
    }
    
    // 3. Verify
    expect(ulogaSada()).toBe('narucilac');
    const completed = await povratniCilj.snapshot();
    expect(completed?.status).toBe('COMPLETED');
  });

  it('WORKER intent -> Auth -> Worker workspace without losing Requester capability', async () => {
    // 1. Guest wants to see opportunities
    await povratniCilj.prepare({ intent: 'WORKER' } as any);
    
    // 2. Auth transition
    const pending = await povratniCilj.snapshot();
    expect(pending?.status).toBe('PENDING');
    
    if (pending) {
      await povratniCilj.markCompleted('user-1', pending.intent);
      if (pending.intent.intent === 'WORKER') postaviUlogu('uskocer');
      else postaviUlogu('narucilac');
    }
    
    // 3. Verify role changed locally
    expect(ulogaSada()).toBe('uskocer');
    
    // 4. Verify Requester capability is NOT lost (they can switch back instantly)
    postaviUlogu('narucilac');
    expect(ulogaSada()).toBe('narucilac');
  });
});

