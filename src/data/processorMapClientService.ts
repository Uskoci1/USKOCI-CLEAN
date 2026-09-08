import type { ProcessorMapProvider, ProcessorMapStatus } from '../contracts/processorMap';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

const NOT_READY = new Set(['PROCESSOR_MAP_NOT_PUBLISHED', 'PROCESSOR_MAP_AMBIGUOUS', 'PROCESSOR_MAP_INCOMPLETE']);
const ROLES = new Set(['PROCESSOR', 'SUBPROCESSOR', 'INDEPENDENT_CONTROLLER']);

function mapProvider(raw: any): ProcessorMapProvider | null {
  const url = typeof raw?.privacyNoticeUrl === 'string' && raw.privacyNoticeUrl.startsWith('https://') ? raw.privacyNoticeUrl : '';
  const role = ROLES.has(raw?.legalRole) ? raw.legalRole : null;
  const categories = Array.isArray(raw?.dataCategories) ? raw.dataCategories.filter((c: unknown) => typeof c === 'string') : [];
  if (!url || !role || typeof raw?.providerCode !== 'string' || categories.length === 0) return null;
  return {
    providerCode: raw.providerCode,
    providerDisplayName: String(raw.providerDisplayName ?? raw.providerCode),
    legalEntityName: String(raw.legalEntityName ?? ''),
    legalRole: role,
    purpose: String(raw.purpose ?? ''),
    dataCategories: categories,
    processingRegions: String(raw.processingRegions ?? ''),
    crossBorderTransfer: raw.crossBorderTransfer === true,
    transferMechanism: String(raw.transferMechanism ?? ''),
    dpaReference: String(raw.dpaReference ?? ''),
    privacyNoticeUrl: url,
    retentionDeletionTerms: String(raw.retentionDeletionTerms ?? ''),
    subprocessorTerms: String(raw.subprocessorTerms ?? ''),
    legalBasisReference: String(raw.legalBasisReference ?? ''),
  };
}

/**
 * P4 — the only client reader of the trusted processor map. Readiness is
 * server truth; the client never lists a provider the server did not publish
 * and never treats a partial map as ready.
 */
export const processorMapClientService = {
  async readStatus(): Promise<Ishod<ProcessorMapStatus>> {
    const { data, error } = await supabase.rpc('rpc_get_processor_map_status');
    if (error) {
      const name = typeof error.message === 'string' ? error.message : '';
      return fail(name || error.code || 'PROCESSOR_MAP_READ_FAILED', name === 'AUTH_REQUIRED'
        ? 'Prijavite se da biste videli obrađivače podataka.'
        : 'Podaci o obrađivačima trenutno nisu dostupni. Pokušajte ponovo.');
    }
    if (!data || typeof data.ready !== 'boolean') return fail('PROCESSOR_MAP_INVALID_RESPONSE', 'Server nije vratio stanje mape obrađivača.');
    if (data.ready !== true) {
      const reason = NOT_READY.has(data.reason) ? data.reason : 'PROCESSOR_MAP_NOT_PUBLISHED';
      const missing = Array.isArray(data.missingProviders) ? data.missingProviders.filter((m: unknown) => typeof m === 'string') : [];
      return { ok: true, podatak: { ready: false, reason, missingProviders: missing } };
    }
    const providers = (Array.isArray(data.providers) ? data.providers : []).map(mapProvider).filter(Boolean) as ProcessorMapProvider[];
    if (providers.length === 0 || typeof data.mapVersion !== 'string') {
      return fail('PROCESSOR_MAP_INVALID_RESPONSE', 'Server je javio spremnu mapu bez obrađivača.');
    }
    return { ok: true, podatak: { ready: true, mapVersion: data.mapVersion, effectiveAt: String(data.effectiveAt ?? ''), providers } };
  },
};
