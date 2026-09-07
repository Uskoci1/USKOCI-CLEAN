import type {
  NeedFactPrivacyClass,
  NeedFactV2Key,
  NeedFactValueType,
} from './needFactsV2';

export type AiNeedV2FactStatus = 'NEEDS_CONFIRMATION' | 'INFERRED' | 'CONFIRMED' | 'UNKNOWN';
export type AiNeedV2FactSource = 'EXPLICIT_USER_ANSWER' | 'CONFIRMED_PROFILE' | 'AI_INFERENCE' | 'SYSTEM_DERIVED';
export type AiNeedSafety = 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';

export type AiNeedV2Fact = {
  id: string;
  key: NeedFactV2Key;
  value: unknown;
  displayValue: string;
  valueType: NeedFactValueType;
  privacyClass: NeedFactPrivacyClass;
  requiredForDraft: boolean;
  status: AiNeedV2FactStatus;
  source: AiNeedV2FactSource;
  evidence: string | null;
};

export type AiNeedMessage = {
  id: string;
  fromAi: boolean;
  body: string;
  safety: AiNeedSafety | null;
  proposedFactIds: string[];
};

export type AiNeedV2Review = {
  conversationId: string;
  schemaVersion: 'NEED_FACT_V2';
  boundNeedId: string | null;
  canSaveDraft: boolean;
  /** Authoritative latest persisted assistant safety from the review RPC. */
  safety: AiNeedSafety;
  missingRequired: NeedFactV2Key[];
  facts: AiNeedV2Fact[];
};

export type AiNeedV2Conversation = {
  conversationId: string;
  schemaVersion: 'NEED_FACT_V2';
  messages: AiNeedMessage[];
  facts: AiNeedV2Fact[];
  review: AiNeedV2Review;
  safety: AiNeedSafety;
};

export type AiNeedContext = Readonly<{ accountId: string; isCurrent(): boolean }>;
export type AiNeedResult<T> = { ok: true; podatak: T } | {
  ok: false; kod: string; poruka: string; outcome: 'rejected' | 'unknown';
};
export interface AiNeedV2Port {
  openConversation(context: AiNeedContext): Promise<AiNeedResult<{ conversationId: string }>>;
  loadConversation(id: string, context: AiNeedContext): Promise<AiNeedV2Conversation | null>;
  sendMessage(id: string, body: string, context: AiNeedContext): Promise<AiNeedResult<{ proposed: number }>>;
  confirmFact(id: string, context: AiNeedContext): Promise<AiNeedResult<null>>;
  correctFact(id: string, value: unknown, display: string, context: AiNeedContext): Promise<AiNeedResult<{ newFactId: string }>>;
  saveDraft(id: string, clientRequestId: string, context: AiNeedContext): Promise<AiNeedResult<{ needId: string }>>;
}
