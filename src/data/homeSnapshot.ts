import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija } from '../contracts/projections';
import { prijava } from '../ui/system/plural';
import { hasNeedAttention } from './marketplaceView';

/**
 * Početna v1 (owner decision 1, 2026-09-19): what waits for this account, composed on the phone
 * from the three reads that already exist. No mode is consulted:
 * the same account's own tasks, its applications to other people's, and its Dogovori on either
 * side stand next to each other, and each row says what the person is to that thing.
 *
 * There is no server aggregate behind this. `rpc_list_my_applications` takes no limit or cursor, so
 * every bound here is a bound on what is shown, not on what is fetched. Since PKG-023a the Dogovori do
 * carry the start of the work, so "next" is ordered by time; a pending change proposal is raised on the
 * Dogovori list itself, where the person acts on it. What is still missing is a server aggregate for
 * "what needs me": this scans every application and Dogovor, which is why the reads behind it cannot be
 * a first page. That one remains a READ_CONTRACT item, recorded in the V3 decision record.
 */
export type HomeSection<T> = { kind: 'known'; value: T } | { kind: 'unavailable' };
export type HomeReads = { needs: HomeSection<PotrebaProjekcija[]>; applications: HomeSection<MojaPrijavaProjekcija[]>;
  agreements: HomeSection<DogovorProjekcija[]> };
export type HomeTarget = { kind: 'NEED'; needId: string } | { kind: 'CANDIDATES'; needId: string }
  | { kind: 'APPLICATION'; applicationId: string } | { kind: 'AGREEMENT'; agreementId: string };
export type HomeAttention = { id: string; title: string; detail: string; target: HomeTarget };
export type HomeRow = { id: string; title: string; detail: string; target: HomeTarget };
export type HomeActivityRow = HomeRow & { relation: 'OWNED' | 'APPLIED' };
type Preview<Row> = { rows: Row[]; more: number };
/** `partial` keeps what could be read and names what could not; it is never shown as "nothing". */
export type HomeActivities = HomeSection<Preview<HomeActivityRow>>
  | { kind: 'partial'; missing: ('needs' | 'applications')[]; value: Preview<HomeActivityRow> };
export type HomeSnapshot = { attention: HomeAttention[]; attentionMore: number; agreements: HomeSection<Preview<HomeRow>>;
  activities: HomeActivities; partial: boolean };

const READ_TIMEOUT_MS = 15_000;
/** One read that fails or hangs costs its own section, never the screen, and never reads as empty. */
export async function readHomeSection<T>(read: () => Promise<T>): Promise<HomeSection<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('HOME_READ_TIMEOUT')), READ_TIMEOUT_MS);
    })]);
    return { kind: 'known', value };
  } catch { return { kind: 'unavailable' }; } finally { if (timer) clearTimeout(timer); }
}

const HOME_ATTENTION_LIMIT = 3, HOME_AGREEMENT_LIMIT = 2, HOME_ACTIVITY_LIMIT = 5;

const activeApplication = (row: MojaPrijavaProjekcija) => ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED'].includes(row.stanje);
const staleApplication = (row: MojaPrijavaProjekcija) => row.stanje === 'STALE_REVIEW_REQUIRED' || row.promenjenaPotreba;
/** `traziPaznju` is the server's own flag; the phone does not second-guess it, only words it. */
const needsMe = (row: MojaPrijavaProjekcija) => staleApplication(row) || row.traziPaznju;
const activeAgreement = (row: DogovorProjekcija) => row.stanje === 'CONFIRMED' || row.stanje === 'AWAITING_REQUESTER';
/** What I am to a Dogovor comes from that Dogovor's own participants, never from an app-wide mode. */
const mySide = (row: DogovorProjekcija) => row.ucesnici.find(person => person.viSte)?.uloga ?? null;
const counterpart = (row: DogovorProjekcija) => row.ucesnici.find(person => !person.viSte)?.ime ?? 'Druga strana';

function needRow(need: PotrebaProjekcija): HomeActivityRow {
  return { id: `need:${need.id}`, relation: 'OWNED', title: need.naslov, target: { kind: 'NEED', needId: need.id },
    detail: need.stanje === 'NACRT' ? 'Nacrt · nije objavljen'
      : `Tvoj zadatak · ${need.vremeTekst} · ${need.brojPrijava > 0 ? prijava(need.brojPrijava) : 'još nema prijava'}` };
}
function applicationRow(row: MojaPrijavaProjekcija): HomeActivityRow {
  return { id: `application:${row.prijavaId}`, relation: 'APPLIED', title: row.naslov, target: { kind: 'APPLICATION', applicationId: row.prijavaId },
    detail: `Tvoja prijava · ${row.cena.prikaz} ukupno · ${staleApplication(row) ? 'zadatak je izmenjen' : 'čeka izbor'}` };
}
function agreementRow(row: DogovorProjekcija): HomeRow {
  const side = mySide(row);
  return { id: `agreement:${row.id}`, title: row.naslov, target: { kind: 'AGREEMENT', agreementId: row.id },
    detail: [side === 'narucilac' ? 'Objavio si' : side === 'uskocer' ? 'Uskočio si' : null, counterpart(row), row.vremeTekst].filter(Boolean).join(' · ') };
}
/** Alternate the two sides, so an account busy on one of them still sees the other in five rows. */
function interleave<T>(first: readonly T[], second: readonly T[]): T[] {
  const result: T[] = [];
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    if (index < first.length) result.push(first[index]);
    if (index < second.length) result.push(second[index]);
  }
  return result;
}

export function composeHome(reads: HomeReads): HomeSnapshot {
  const needs = reads.needs.kind === 'known' ? reads.needs.value : null;
  const applications = reads.applications.kind === 'known' ? reads.applications.value : null;
  const agreements = reads.agreements.kind === 'known' ? reads.agreements.value : null;

  // A blocked completion first, then an open problem, then a changed task under my application,
  // then my own tasks with applications to choose from. One identity per subject and reason.
  const attention: HomeAttention[] = [
    ...(agreements ?? []).filter(row => row.stanje === 'AWAITING_REQUESTER' && mySide(row) === 'narucilac').map(row => ({
      id: `agreement:${row.id}:confirm`, title: 'Potvrdi završetak', detail: `${row.naslov} · završetak je označen i čeka tvoju potvrdu`,
      target: { kind: 'AGREEMENT' as const, agreementId: row.id } })),
    ...(agreements ?? []).filter(row => activeAgreement(row) && row.problemOtvoren).map(row => ({
      id: `agreement:${row.id}:problem`, title: 'Prijavljen je problem', detail: `${row.naslov} · automatski završetak je zaustavljen`,
      target: { kind: 'AGREEMENT' as const, agreementId: row.id } })),
    ...(applications ?? []).filter(row => activeApplication(row) && needsMe(row)).map(row => ({
      id: `application:${row.prijavaId}:${staleApplication(row) ? 'stale' : 'attention'}`,
      title: staleApplication(row) ? 'Zadatak je izmenjen' : 'Prijava traži tvoju pažnju',
      detail: staleApplication(row) ? `${row.naslov} · pregledaj izmene pre nego što odlučiš o prijavi` : `${row.naslov} · otvori svoju prijavu`,
      target: { kind: 'APPLICATION' as const, applicationId: row.prijavaId } })),
    ...(needs ?? []).filter(hasNeedAttention).map(row => ({
      id: `need:${row.id}:applications`, title: prijava(row.brojPrijava), detail: `${row.naslov} · čeka tvoj izbor`,
      target: { kind: 'CANDIDATES' as const, needId: row.id } })),
  ];

  // Since PKG-023a a Dogovor carries the start of the work, so the two the home shows are the two that
  // come soonest; the ones with no term yet keep the order the server gave, behind them.
  const activeAgreements = (agreements ?? []).filter(activeAgreement)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const left = a.row.pocinje, right = b.row.pocinje;
      if (left && right && left !== right) return left < right ? -1 : 1;
      if (left && !right) return -1;
      if (!left && right) return 1;
      return a.index - b.index;
    })
    .map(entry => agreementRow(entry.row));
  const activityRows = interleave((needs ?? []).filter(row => row.stanje !== 'ZATVORENA').map(needRow),
    (applications ?? []).filter(activeApplication).map(applicationRow));
  const preview = { rows: activityRows.slice(0, HOME_ACTIVITY_LIMIT), more: Math.max(0, activityRows.length - HOME_ACTIVITY_LIMIT) };
  const missing = [...(needs ? [] : ['needs' as const]), ...(applications ? [] : ['applications' as const])];

  return {
    attention: attention.slice(0, HOME_ATTENTION_LIMIT), attentionMore: Math.max(0, attention.length - HOME_ATTENTION_LIMIT),
    agreements: agreements ? { kind: 'known', value: { rows: activeAgreements.slice(0, HOME_AGREEMENT_LIMIT),
      more: Math.max(0, activeAgreements.length - HOME_AGREEMENT_LIMIT) } } : { kind: 'unavailable' },
    activities: missing.length === 2 ? { kind: 'unavailable' } : missing.length ? { kind: 'partial', missing, value: preview } : { kind: 'known', value: preview },
    partial: [reads.needs, reads.applications, reads.agreements].some(section => section.kind === 'unavailable'),
  };
}

/**
 * Moje aktivnosti v1: the things this account is part of, as one list filtered by what the person
 * is to them. It is a list of subjects, not of events — the inbox stays the list of events.
 *
 * A selected application belongs to history once its Dogovor has ended; when the Dogovori could
 * not be read that cannot be known, so the row stays under active, where it can still be found.
 */
export type ActivityFilter = { relation: 'ALL' | 'OWNED' | 'APPLIED'; period: 'ACTIVE' | 'HISTORY' };
export type ActivityPage = HomeSection<HomeActivityRow[]>
  | { kind: 'partial'; missing: ('needs' | 'applications')[]; value: HomeActivityRow[] };

export function composeActivities(reads: HomeReads, filter: ActivityFilter): ActivityPage {
  const needs = reads.needs.kind === 'known' ? reads.needs.value : null;
  const applications = reads.applications.kind === 'known' ? reads.applications.value : null;
  const agreements = reads.agreements.kind === 'known' ? new Map(reads.agreements.value.map(row => [row.id, row])) : null;
  const active = filter.period === 'ACTIVE';

  const over = (row: MojaPrijavaProjekcija) => {
    if (row.stanje === 'WITHDRAWN' || row.stanje === 'CLOSED') return true;
    if (row.stanje !== 'SELECTED') return false;
    const agreement = row.dogovorId ? agreements?.get(row.dogovorId) : undefined;
    return !!agreement && !activeAgreement(agreement);
  };
  const appliedRow = (row: MojaPrijavaProjekcija): HomeActivityRow => row.stanje === 'SELECTED'
    ? { id: `application:${row.prijavaId}`, relation: 'APPLIED', title: row.naslov, detail: 'Tvoja prijava je izabrana · otvori Dogovor',
      target: row.dogovorId ? { kind: 'AGREEMENT', agreementId: row.dogovorId } : { kind: 'APPLICATION', applicationId: row.prijavaId } }
    : row.stanje === 'WITHDRAWN' ? { ...applicationRow(row), detail: `Tvoja prijava · ${row.cena.prikaz} ukupno · povučena` }
      : row.stanje === 'CLOSED' ? { ...applicationRow(row), detail: `Tvoja prijava · ${row.cena.prikaz} ukupno · zatvorena` } : applicationRow(row);
  const ownedRow = (row: PotrebaProjekcija): HomeActivityRow => row.stanje === 'ZATVORENA'
    ? { ...needRow(row), detail: `Tvoj zadatak · ${row.vremeTekst} · zatvoren` } : needRow(row);

  const wantsOwned = filter.relation !== 'APPLIED', wantsApplied = filter.relation !== 'OWNED';
  const missing = [...(wantsOwned && !needs ? ['needs' as const] : []), ...(wantsApplied && !applications ? ['applications' as const] : [])];
  const owned = wantsOwned && needs ? needs.filter(row => (row.stanje === 'ZATVORENA') !== active).map(ownedRow) : [];
  const applied = wantsApplied && applications ? applications.filter(row => over(row) !== active).map(appliedRow) : [];
  const value = interleave(owned, applied);
  const asked = Number(wantsOwned) + Number(wantsApplied);
  return missing.length === asked ? { kind: 'unavailable' } : missing.length ? { kind: 'partial', missing, value } : { kind: 'known', value };
}
