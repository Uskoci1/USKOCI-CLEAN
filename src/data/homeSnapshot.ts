import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija } from '../contracts/projections';
import { prijava } from '../ui/system/plural';
import { hasNeedAttention, ownedTaskCounts, type OwnedTaskCounts } from './marketplaceView';
import { applicationCounts, type ApplicationCounts } from './myApplicationsView';

/**
 * Početna (owner decision 1, 2026-09-19; the overview of the owner's information architecture, 2026-09-23): what
 * waits for this account, composed on the phone from the three reads that already exist. No mode is consulted: the
 * same account's own tasks, its applications to other people's, and its Dogovori on either side stand next to each
 * other. My own tasks and my applications are two front doors, "Moji zadaci" and "Moje prijave", each counted by the
 * same rule as the list it opens; the preview of their rows ("Moje aktivnosti") is retired, and since 2026-09-24 its
 * address redirects to Početna, so its composition is gone too.
 *
 * PKG-042 supplies server attention separately. The legacy attention composition stays as the
 * historical SQL proof oracle and test-source adapter, never a production fallback after an RPC failure.
 * The counts and the next Agreement still need complete lists: limiting their reads would lose
 * ordering and totals. Attention integration alone does not make these remaining reads bounded.
 */
export type HomeSection<T> = { kind: 'known'; value: T } | { kind: 'unavailable' };
export type HomeReads = { needs: HomeSection<PotrebaProjekcija[]>; applications: HomeSection<MojaPrijavaProjekcija[]>;
  agreements: HomeSection<DogovorProjekcija[]> };
export type HomeTarget = { kind: 'NEED'; needId: string } | { kind: 'CANDIDATES'; needId: string }
  | { kind: 'APPLICATION'; applicationId: string } | { kind: 'AGREEMENT'; agreementId: string };
export type HomeAttention = { id: string; title: string; detail: string; target: HomeTarget };
export type HomeAttentionPreview = { rows: HomeAttention[]; more: number; asOf: string };
export type HomeRow = { id: string; title: string; detail: string; target: HomeTarget;
  /** Display facts kept separate for the appointment card; time is already worded by the Agreement projection. */
  appointment?: { timeText: string; counterpartName: string; roleLabel: 'Tvoj zadatak' | 'Uskačeš' | null } };
type Preview<Row> = { rows: Row[]; more: number };
export type HomeSnapshot = { attention: HomeAttention[]; attentionMore: number; agreements: HomeSection<Preview<HomeRow>>;
  /** The two front doors. A side that could not be read is unavailable, never zero. */
  mine: { tasks: HomeSection<OwnedTaskCounts>; applications: HomeSection<ApplicationCounts> };
  partial: boolean; attentionState?: 'known' | 'unavailable';
  /** Every read answered and this account has no task, no application, no Dogovor and nothing waiting. */
  firstRun: boolean;
  /** Exact number only after every completed row has a valid receipt; null means unavailable, never zero. */
  ratingsDue: number | null;
  /**
   * When exactly one Dogovor waits for my rating, its id, as the Dogovori read already gave it: Početna then opens that
   * rating in one tap (emulator critique A1, 2026-09-24). With none or several it is null and Početna opens Dogovori.
   */
  ratingDueAgreementId: string | null };

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

// One next Dogovor (2026-09-23): the rest are one tab away, in Dogovori.
const HOME_ATTENTION_LIMIT = 3, HOME_AGREEMENT_LIMIT = 1;

const activeApplication = (row: MojaPrijavaProjekcija) => ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED'].includes(row.stanje);
const staleApplication = (row: MojaPrijavaProjekcija) => row.stanje === 'STALE_REVIEW_REQUIRED' || row.promenjenaPotreba;
/** `traziPaznju` is the server's own flag; the phone does not second-guess it, only words it. */
const needsMe = (row: MojaPrijavaProjekcija) => staleApplication(row) || row.traziPaznju;
const activeAgreement = (row: DogovorProjekcija) => row.stanje === 'CONFIRMED' || row.stanje === 'AWAITING_REQUESTER';
/** The same rule the Dogovori list uses for "Čeka tvoju ocenu"; Home must not contradict it. */
const ratingDue = (row: DogovorProjekcija) => row.stanje === 'COMPLETED' && row.ocenaMoguca;
/** What I am to a Dogovor comes from that Dogovor's own participants, never from an app-wide mode. */
const mySide = (row: DogovorProjekcija) => row.ucesnici.find(person => person.viSte)?.uloga ?? null;
const counterpart = (row: DogovorProjekcija) => row.ucesnici.find(person => !person.viSte)?.ime ?? 'Druga strana';

function agreementRow(row: DogovorProjekcija): HomeRow {
  const side = mySide(row);
  const roleLabel = side === 'narucilac' ? 'Tvoj zadatak' : side === 'uskocer' ? 'Uskačeš' : null;
  const counterpartName = counterpart(row);
  return { id: `agreement:${row.id}`, title: row.naslov, target: { kind: 'AGREEMENT', agreementId: row.id },
    detail: [roleLabel, counterpartName, row.vremeTekst].filter(Boolean).join(' · '),
    appointment: { timeText: row.vremeTekst, counterpartName, roleLabel } };
}

export function composeHome(reads: HomeReads, serverAttention?: HomeSection<HomeAttentionPreview>): HomeSnapshot {
  const needs = reads.needs.kind === 'known' ? reads.needs.value : null;
  const applications = reads.applications.kind === 'known' ? reads.applications.value : null;
  const agreements = reads.agreements.kind === 'known' ? reads.agreements.value : null;

  // A blocked completion first, then an open problem, then a changed task under my application,
  // then my own tasks with applications to choose from. One identity per subject and reason.
  const attention: HomeAttention[] = serverAttention
    ? serverAttention.kind === 'known' ? serverAttention.value.rows : [] : [
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
      id: `need:${row.id}:applications`, title: prijava(row.brojPrijavaZaIzbor!), detail: `${row.naslov} · čeka tvoj izbor`,
      target: { kind: 'CANDIDATES' as const, needId: row.id } })),
  ];

  // Since PKG-023a a Dogovor carries the start of the work, so the one the home shows is the one that
  // comes soonest; the ones with no term yet keep the order the server gave, behind them.
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
  const due = (agreements ?? []).filter(ratingDue);
  const ratingsKnown = agreements !== null && !agreements.some(row => row.stanje === 'COMPLETED' && row.stanjeProvereOcene === 'UNAVAILABLE');
  const partial = !ratingsKnown || serverAttention?.kind === 'unavailable' || [reads.needs, reads.applications, reads.agreements].some(section => section.kind === 'unavailable');

  return {
    attention: attention.slice(0, HOME_ATTENTION_LIMIT), attentionMore: serverAttention
      ? serverAttention.kind === 'known' ? serverAttention.value.more : 0 : Math.max(0, attention.length - HOME_ATTENTION_LIMIT),
    ...(serverAttention ? { attentionState: serverAttention.kind } : {}),
    agreements: agreements ? { kind: 'known', value: { rows: activeAgreements.slice(0, HOME_AGREEMENT_LIMIT),
      more: Math.max(0, activeAgreements.length - HOME_AGREEMENT_LIMIT) } } : { kind: 'unavailable' },
    mine: { tasks: needs ? { kind: 'known', value: ownedTaskCounts(needs) } : { kind: 'unavailable' },
      applications: applications ? { kind: 'known', value: applicationCounts(applications) } : { kind: 'unavailable' } },
    partial,
    firstRun: !partial && !attention.length && !needs?.length && !applications?.length && !agreements?.length,
    ratingsDue: ratingsKnown ? due.length : null,
    ratingDueAgreementId: ratingsKnown && due.length === 1 ? due[0].id : null,
  };
}
