import type { AiNeedV2Conversation, AiNeedV2Fact, AiNeedV2Port } from '../../../contracts/aiNeedV2';
import { NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../../../contracts/needFactsV2';
export const id = (n: number) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
export function fact(key: NeedFactV2Key = 'need.title', value: unknown = 'Generic task', overrides: Partial<AiNeedV2Fact> = {}): AiNeedV2Fact {
 const { label: _label, ...definition } = NEED_FACT_V2_DEFINITIONS[key];
 return { id: id(10), key, value, displayValue: String(value), ...definition,
  source: 'AI_INFERENCE', status: 'CONFIRMED', evidence: null, ...overrides };
}
export function conversation(facts = [fact()], overrides: Partial<AiNeedV2Conversation> = {}): AiNeedV2Conversation {
 const review = { conversationId: id(2), schemaVersion: 'NEED_FACT_V2' as const, boundNeedId: null,
 safety: 'ALLOW' as const, canSaveDraft: true, missingRequired: [], facts };
 return { conversationId: id(2), schemaVersion: 'NEED_FACT_V2', messages: [], facts, safety: 'ALLOW', review, ...overrides };
}
export function port(): jest.Mocked<AiNeedV2Port> { return {
 openConversation: jest.fn().mockResolvedValue({ ok: true, podatak: { conversationId: id(2) } }),
 loadConversation: jest.fn().mockResolvedValue(conversation()),
 sendMessage: jest.fn().mockResolvedValue({ ok: true, podatak: { proposed: 1 } }),
 confirmFact: jest.fn().mockResolvedValue({ ok: true, podatak: null }),
 correctFact: jest.fn().mockResolvedValue({ ok: true, podatak: { newFactId: id(11) } }),
 saveDraft: jest.fn().mockResolvedValue({ ok: true, podatak: { needId: id(3) } }),
}; }
export function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void;
 const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
export const uncertain = { ok: false as const, kod: 'AI_OUTCOME_UNKNOWN', poruka: 'Potvrda nije stigla.', outcome: 'unknown' as const };
