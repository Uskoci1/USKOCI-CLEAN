import type {
  NeedFactPrivacyClass,
  NeedFactV2Key,
  NeedFactValueType,
} from './needFactsV2';

export type AiNeedV2FactStatus = 'NEEDS_CONFIRMATION' | 'INFERRED' | 'CONFIRMED' | 'UNKNOWN';
export type AiNeedV2FactSource = 'EXPLICIT_USER_ANSWER' | 'CONFIRMED_PROFILE' | 'AI_INFERENCE' | 'SYSTEM';
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
