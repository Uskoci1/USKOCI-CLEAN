import type { RetentionPolicyStatus, RetentionRule } from '../contracts/retentionPolicy';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

const NOT_READY = new Set(['RETENTION_POLICY_NOT_PUBLISHED', 'RETENTION_POLICY_AMBIGUOUS', 'RETENTION_POLICY_INCOMPLETE']);

function mapRule(raw: any): RetentionRule | null {
  if (typeof raw?.dataClass !== 'string' || typeof raw?.retentionPeriod !== 'string' || !raw.retentionPeriod) return null;
  return {
    dataClass: raw.dataClass,
    purpose: String(raw.purpose ?? ''),
    retentionPeriod: raw.retentionPeriod,
    deletionTrigger: String(raw.deletionTrigger ?? ''),
    exceptionRule: String(raw.exceptionRule ?? ''),
    legalBasis: String(raw.legalBasis ?? ''),
  };
}

/**
 * P3 — the only client reader of the trusted retention schedule. Readiness is
 * server truth; the client never lists a rule the server did not publish and
 * never treats a partial schedule as ready.
 */
export const retentionPolicyClientService = {
  async readStatus(): Promise<Ishod<RetentionPolicyStatus>> {
    const { data, error } = await supabase.rpc('rpc_get_retention_policy_status');
    if (error) {
      const name = typeof error.message === 'string' ? error.message : '';
      return fail(name || error.code || 'RETENTION_POLICY_READ_FAILED', name === 'AUTH_REQUIRED'
        ? 'Prijavite se da biste videli rokove čuvanja podataka.'
        : 'Rokovi čuvanja podataka trenutno nisu dostupni. Pokušajte ponovo.');
    }
    if (!data || typeof data.ready !== 'boolean') return fail('RETENTION_POLICY_INVALID_RESPONSE', 'Server nije vratio stanje rokova čuvanja.');
    if (data.ready !== true) {
      const reason = NOT_READY.has(data.reason) ? data.reason : 'RETENTION_POLICY_NOT_PUBLISHED';
      const missing = Array.isArray(data.missingDataClasses) ? data.missingDataClasses.filter((m: unknown) => typeof m === 'string') : [];
      return { ok: true, podatak: { ready: false, reason, missingDataClasses: missing } };
    }
    const rules = (Array.isArray(data.rules) ? data.rules : []).map(mapRule).filter(Boolean) as RetentionRule[];
    if (rules.length === 0 || typeof data.policyVersion !== 'string') {
      return fail('RETENTION_POLICY_INVALID_RESPONSE', 'Server je javio spreman raspored bez pravila.');
    }
    return { ok: true, podatak: { ready: true, policyVersion: data.policyVersion, effectiveAt: String(data.effectiveAt ?? ''), rules } };
  },
};
