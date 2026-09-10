import type { DokazPrijave, KandidatProjekcija, StanjePrijave } from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';
import { positiveInteger, readOwnedResult, uuid } from './serverReceipt';
import { calendarInstant } from '../lib/calendarTime';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type CandidateService = Pick<Izvor, 'prijaveZaPotrebu'>;

const STATES = new Set<StanjePrijave>([
  'SELECTABLE',
  'STALE',
  'OVERFILL',
  'SELECTED',
  'WITHDRAWN',
  'CLOSED',
  'FULL',
]);

function rsd(iznos: number) {
  return {
    iznos,
    valuta: 'RSD',
    prikaz: `${iznos.toLocaleString('sr-Latn-RS')} RSD`,
  };
}

function inicijali(ime: string) {
  const delovi = ime.trim().split(/\s+/).filter(Boolean);
  if (!delovi.length) return '?';
  return delovi.slice(0, 2).map((d) => d[0] ?? '').join('').toUpperCase() || '?';
}

function vreme(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return 'Po dogovoru';
  const datum = new Date(raw);
  if (Number.isNaN(datum.getTime())) return 'Po dogovoru';
  return datum.toLocaleString('sr-Latn-RS', {
    timeZone: 'Europe/Belgrade',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dokaz(raw: any): DokazPrijave {
  const schema = raw?.schema;
  if (schema === 'LEGACY_UNPROVEN') {
    return {
      sema: 'LEGACY_UNPROVEN',
      kapacitetTima: null,
      vestine: null,
      alati: null,
      licence: null,
      vozila: null,
    };
  }
  if (schema !== 'APPLICATION_V1_SELF_DECLARED') {
    throw new Error('CANDIDATE_EVIDENCE_SCHEMA_UNSUPPORTED');
  }
  const teamCapacity = Number(raw.teamCapacity);
  if (!Number.isInteger(teamCapacity) || teamCapacity < 1) {
    throw new Error('CANDIDATE_EVIDENCE_TEAM_CAPACITY_INVALID');
  }
  const arr = (value: unknown, code: string) => {
    if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) throw new Error(code);
    return value as string[];
  };
  return {
    sema: 'APPLICATION_V1_SELF_DECLARED',
    kapacitetTima: teamCapacity,
    vestine: arr(raw.skills, 'CANDIDATE_EVIDENCE_SKILLS_INVALID'),
    alati: arr(raw.tools, 'CANDIDATE_EVIDENCE_TOOLS_INVALID'),
    licence: arr(raw.licenses, 'CANDIDATE_EVIDENCE_LICENSES_INVALID'),
    vozila: arr(raw.vehicles, 'CANDIDATE_EVIDENCE_VEHICLES_INVALID'),
  };
}

function mapCandidate(raw: any): KandidatProjekcija {
  if (!raw || typeof raw !== 'object') throw new Error('CANDIDATE_INVALID_PROJECTION');
  if (!uuid(raw.responseId)) throw new Error('CANDIDATE_RESPONSE_ID_MISSING');
  if (!uuid(raw.workerProfileId)) throw new Error('CANDIDATE_PROFILE_ID_MISSING');
  if (!positiveInteger(raw.needRevision)) throw new Error('CANDIDATE_NEED_REVISION_INVALID');
  if (!Number.isInteger(raw.version) || raw.version < 1) throw new Error('CANDIDATE_VERSION_INVALID');
  if (typeof raw.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.contentHash)) throw new Error('CANDIDATE_HASH_INVALID');
  const from = calendarInstant(raw.proposedStartAt), to = calendarInstant(raw.proposedEndAt);
  if (!(raw.proposedStartAt === null && raw.proposedEndAt === null) &&
      (from === null || to === null || from >= to)) throw new Error('CANDIDATE_INTERVAL_INVALID');
  if (!STATES.has(raw.state)) throw new Error('CANDIDATE_STATE_UNSUPPORTED');
  if (!Number.isInteger(raw.priceRsd) || raw.priceRsd <= 0) throw new Error('CANDIDATE_PRICE_INVALID');
  if (!Number.isInteger(raw.coveredSlots) || raw.coveredSlots < 1) throw new Error('CANDIDATE_COVERAGE_INVALID');
  if (!Number.isInteger(raw.remainingSlots) || raw.remainingSlots < 0) throw new Error('CANDIDATE_REMAINING_INVALID');

  const profile = raw.publicProfile;
  const ime = typeof profile?.displayName === 'string' && profile.displayName.trim()
    ? profile.displayName.trim()
    : 'Uskočer';
  const trust = profile?.trust;
  const rating = typeof trust?.ratingAverage === 'number' && Number.isFinite(trust.ratingAverage) && trust.ratingAverage >= 0 && trust.ratingAverage <= 5 ? trust.ratingAverage : null;
  const reviews = Number.isInteger(trust?.reviewCount) && trust.reviewCount >= 0 ? trust.reviewCount : null;
  const completed = Number.isInteger(trust?.completedCount) && trust.completedCount >= 0 ? trust.completedCount : 0;
  const evidence = dokaz(raw.applicationEvidence);
  const vozila = evidence.vozila;

  return {
    prijavaId: raw.responseId,
    radnikProfilId: raw.workerProfileId,
    verzija: raw.version,
    hash: raw.contentHash,
    potrebaRevizija: raw.needRevision,
    predlozeniPocetak: raw.proposedStartAt,
    predlozeniKraj: raw.proposedEndAt,
    ime,
    inicijali: inicijali(ime),
    ocenaTekst: rating === null ? '—' : rating.toLocaleString('sr-Latn-RS', { maximumFractionDigits: 1 }),
    recenzijeTekst: reviews === null ? `${completed} završenih` : `${reviews} recenzija`,
    cena: rsd(raw.priceRsd),
    pokrivaMesta: raw.coveredSlots,
    preostaloMesta: raw.remainingSlots,
    dolazakTekst: vreme(raw.proposedStartAt),
    prevozTekst: vozila === null ? 'Nije dokazano' : vozila.length ? vozila.join(', ') : 'Bez navedenog vozila',
    napomena: typeof raw.scopeNote === 'string' ? raw.scopeNote : '',
    stanje: raw.state,
    mozeIzabrati: raw.canSelect === true && raw.state === 'SELECTABLE',
    dokazPrijave: evidence,
    razlogPreporuke: null,
  };
}

/**
 * RU-5 / P0D-01 sole production owner for Requester candidate reads.
 * Server owns visibility, canonical candidate state and exact version/hash binding.
 * Read failures throw; R05 must not turn a network/authority failure into a false empty list.
 */
export const candidateClientService: CandidateService = {
  async prijaveZaPotrebu(potrebaId) {
    const id = potrebaId.trim();
    if (!id) return [];

    const result = await readOwnedResult({
      request: () => supabase.rpc('rpc_list_need_candidates', { p_need_id: id }),
      errors: {}, fallback: 'CANDIDATE_READ_FAILED', invalid: 'CANDIDATE_LIST_INVALID_PROJECTION',
      decode(data) {
        if (!Array.isArray(data)) return null;
        try {
          const rows = data.map(mapCandidate);
          return new Set(rows.map(row => row.prijavaId.toLowerCase())).size === rows.length ? rows : null;
        } catch { return null; }
      },
    });
    if (!result.ok) throw new Error('Prijave trenutno nije moguće učitati. Pokušajte ponovo.');
    return result.podatak;
  },
};
