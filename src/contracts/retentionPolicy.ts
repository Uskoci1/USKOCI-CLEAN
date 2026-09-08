/** P3 — trusted retention schedule as the server projects it. */

export type RetentionRule = {
  dataClass: string;
  purpose: string;
  retentionPeriod: string;
  deletionTrigger: string;
  exceptionRule: string;
  legalBasis: string;
};

export type RetentionPolicyNotReadyReason =
  | 'RETENTION_POLICY_NOT_PUBLISHED'
  | 'RETENTION_POLICY_AMBIGUOUS'
  | 'RETENTION_POLICY_INCOMPLETE';

/**
 * Fail-closed by design: `ready` is false until authorized operations publish
 * one policy that covers every active required data class. Execution (purge)
 * is never admitted by this projection.
 */
export type RetentionPolicyStatus =
  | { ready: false; reason: RetentionPolicyNotReadyReason; missingDataClasses: string[] }
  | { ready: true; policyVersion: string; effectiveAt: string; rules: RetentionRule[] };
