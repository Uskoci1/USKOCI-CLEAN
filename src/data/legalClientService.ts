import type { LegalAcceptanceReceipt, LegalBundleStatus, LegalDocument } from '../contracts/legal';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

// Server exception names → product language. The user never sees a code.
const LEGAL_COPY: Record<string, string> = {
  LEGAL_DOCUMENTS_NOT_PUBLISHED: 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.',
  LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE:
    'Uslovi su u međuvremenu ažurirani. Pročitajte ih ponovo pre prihvatanja.',
  INVALID_CLIENT_REQUEST_ID: 'Prihvatanje trenutno nije moglo da se zabeleži. Pokušajte ponovo.',
  AUTH_REQUIRED: 'Prijavite se da biste prihvatili uslove.',
};

function legalFailure(error: any, fallback: string): Ishod<never> {
  const name = typeof error?.message === 'string' ? error.message : '';
  return fail(name || error?.code || fallback, LEGAL_COPY[name] ?? 'Radnja trenutno nije mogla da se završi. Pokušajte ponovo.');
}

function mapDocument(raw: any): LegalDocument | null {
  const kind = raw?.kind === 'TERMS' || raw?.kind === 'PRIVACY' ? raw.kind : null;
  const version = typeof raw?.version === 'string' ? raw.version : '';
  const sha256 = typeof raw?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(raw.sha256) ? raw.sha256 : '';
  const url = typeof raw?.url === 'string' && raw.url.startsWith('https://') ? raw.url : '';
  if (!kind || !version || !sha256 || !url) return null;
  return {
    kind,
    version,
    sha256,
    url,
    publishedAt: String(raw?.publishedAt ?? ''),
    effectiveAt: String(raw?.effectiveAt ?? ''),
  };
}

/**
 * P1 — the only client owner of legal bundle reads and acceptance.
 * Readiness is server truth: an unpublished bundle is `ready:false`, never a
 * client-side default. Acceptance carries one stable request id per intent so
 * a retry replays the original receipt instead of recording twice.
 */
export const legalClientService = {
  async readBundle(): Promise<Ishod<LegalBundleStatus>> {
    const { data, error } = await supabase.rpc('rpc_get_legal_bundle');
    if (error) return legalFailure(error, 'LEGAL_BUNDLE_READ_FAILED');
    if (!data || typeof data.ready !== 'boolean') return fail('LEGAL_BUNDLE_INVALID_RESPONSE', 'Server nije vratio stanje uslova.');
    if (data.ready !== true) {
      return {
        ok: true,
        podatak: { ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] },
      };
    }
    const documents = (Array.isArray(data.documents) ? data.documents : []).map(mapDocument).filter(Boolean) as LegalDocument[];
    const kinds = documents.map((d) => d.kind);
    if (!kinds.includes('TERMS') || !kinds.includes('PRIVACY')) {
      return fail('LEGAL_BUNDLE_INVALID_RESPONSE', 'Server nije vratio oba pravna dokumenta.');
    }
    return {
      ok: true,
      podatak: { ready: true, acceptedCurrentBundle: data.acceptedCurrentBundle === true, reason: null, documents },
    };
  },

  async acceptBundle(clientRequestId: string): Promise<Ishod<LegalAcceptanceReceipt>> {
    const { data, error } = await supabase.rpc('rpc_accept_legal_bundle', { p_client_request_id: clientRequestId });
    if (error) return legalFailure(error, 'LEGAL_ACCEPT_FAILED');
    if (data?.accepted !== true || typeof data?.termsSha256 !== 'string' || typeof data?.privacySha256 !== 'string') {
      return fail('LEGAL_ACCEPT_INVALID_RESPONSE', 'Server nije potvrdio prihvatanje uslova.');
    }
    return {
      ok: true,
      podatak: {
        accepted: true,
        idempotentReplay: data.idempotentReplay === true,
        acceptedAt: String(data.acceptedAt ?? ''),
        termsVersion: String(data.termsVersion ?? ''),
        termsSha256: data.termsSha256,
        privacyVersion: String(data.privacyVersion ?? ''),
        privacySha256: data.privacySha256,
      },
    };
  },
};
