import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { Ishod, PovuciPrijavuKomanda } from '../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead } from '../../data/applicationSelectionClientService';
import { readApplicationCommandState, readExistingApplicationInterval, type ApplicationCommandState } from '../../data/myApplicationsClientService';
import { ru4Production, type Ru4RazresiPrijavuInput } from '../../data/ru4Production';
import { positiveInteger, sameId } from '../../data/serverReceipt';
import { fixedApplicationPeople, fixedApplicationPrice, readableTitle } from '../../data/needDetailPresentation';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../lib/idempotencija';
import { calendarInstant } from '../../lib/calendarTime';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { MyApplicationsPresentation, type ApplicationsTab, type OfferEdit } from '../../ui/v2/MyApplicationsPresentation';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';

type Intent = { kind: 'withdraw'; command: PovuciPrijavuKomanda } | { kind: 'resolve'; command: Ru4RazresiPrijavuInput };
type Pending = { intent: Intent; row: MojaPrijavaProjekcija; inFlight: boolean; reconciled: boolean;
  result: 'receipt' | 'unknown' | 'rejected' | null; code: string | null };
type Loaded = { rows: MojaPrijavaProjekcija[]; notice: string | null };
function pricedOffer(draft: OfferEdit): OfferEdit {
  const fixedPeople = fixedApplicationPeople(draft.pricing);
  const people = fixedPeople === null ? draft.people : String(fixedPeople);
  const price = draft.pricing.rezimCene === 'MY_PRICE'
    ? String(fixedApplicationPrice(draft.pricing, /^\d+$/.test(people) ? Number(people) : NaN) ?? '') : draft.price;
  return { ...draft, people, price };
}
const errors: Readonly<Record<string, string>> = { ...applicationSelectionErrors,
  FORBIDDEN: 'Ova Prijava nije dostupna na ovom nalogu.', RESPONSE_NOT_OWNED: 'Ova Prijava nije dostupna na ovom nalogu.',
  RESPONSE_NOT_WITHDRAWABLE: 'Prijavu sada nije moguće povući. Proveri aktuelno stanje.',
  RESPONSE_NOT_AWAITING_REVIEW: 'Prijava više ne čeka ovu proveru. Učitaj aktuelno stanje.',
  RESPONSE_ALREADY_CURRENT: 'Prijava je već usklađena. Učitaj aktuelno stanje.',
  INVALID_PROPOSED_WINDOW: 'Sačuvani termin nije prihvaćen. Proveri aktuelnu Prijavu.',
  SCOPE_NOTE_TOO_LONG: 'Napomena može imati najviše 1.200 znakova.',
};
const unknown = () => ({ ok: false as const, kod: 'APPLICATION_OUTCOME_UNKNOWN', poruka: 'Ishod radnje nije potvrđen. Proveri sačuvano stanje pre ponavljanja.' });
const identity = (p: MojaPrijavaProjekcija) => `${p.prijavaId}:${p.potrebaId}:${p.potrebaRevizija}:${p.prijavaRevizija}:${p.prijavaVerzija}:${p.stanje}`;
const withdrawal = (pending: Pending) => pending.intent.kind === 'withdraw' || pending.intent.command.akcija === 'WITHDRAW';
function observed(pending: Pending, row: ApplicationCommandState) {
  if (!sameId(row.applicationId, pending.row.prijavaId) || !sameId(row.needId, pending.row.potrebaId)) return false;
  // The exact persisted row establishes withdrawal. UPDATE/KEEP also require
  // the command receipt; a coincidentally similar offer never proves replay.
  if (withdrawal(pending)) return row.status === 'WITHDRAWN' && row.version >= pending.row.prijavaVerzija;
  const update = pending.intent.kind === 'resolve' && pending.intent.command.akcija === 'UPDATE' ? pending.intent.command : null;
  const sameInstant = (actual: string | null, expected: string | null | undefined) => expected === null
    ? actual === null : actual !== null && calendarInstant(expected) !== null && calendarInstant(actual) === calendarInstant(expected);
  // A later Need edit/closure changes today's projection, not whether this
  // version was saved against the reviewed revision. The list still displays
  // the server's current lifecycle; it cannot settle this command.
  return pending.result === 'receipt' && row.version === pending.row.prijavaVerzija + 1 &&
    row.submittedNeedRevision === pending.row.potrebaRevizija &&
    row.priceRsd === (update ? update.cenaRsd : pending.row.cena.iznos) &&
    row.coveredSlots === (update ? update.pokrivenaMesta : pending.row.pokrivaMesta) &&
    row.scopeNote === (update ? update.napomena : pending.row.napomena) &&
    (!update || sameInstant(row.proposedStartAt, update.predlozeniPocetak) && sameInstant(row.proposedEndAt, update.predlozeniKraj));
}
export default function MojePrijave() {
  const izvor = useIzvor(), router = useRouter();
  // "Zadatak je izmenjen — proveri svoju prijavu" used to land on the list and stop there, leaving
  // the person to find which of their applications it meant. The notification knows; it now says.
  const params = useLocalSearchParams<{ prijavaId?: string | string[] }>();
  const named = typeof params.prijavaId === 'string' ? params.prijavaId : null;
  const landing = useRef<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => { landing.current = named; setFocusId(null); }, [named]);
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ focused: false, active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    token: 0, readRevision: 0, reading: false, editRevision: 0, editingLoading: false, tab: 'all' as ApplicationsTab,
    expanded: null as string | null, draft: null as OfferEdit | null, pending: null as Pending | null, message: null as string | null }),
  [izvor, user?.id, accountRevision]);
  const [, render] = useState(0), [resume, setResume] = useState(0);
  const confirmation = useConfirmSheet(), retireConfirmation = confirmation.close;
  const accountCurrent = useCallback(() => !!user?.id && sesijaSada().user?.id === user.id &&
    sesijaSada().accountRevision === accountRevision, [user?.id, accountRevision]);
  // Every retirement below also makes an open withdrawal question stale (its answer checks `editRevision`), so the
  // question leaves the screen with it instead of waiting there as a button that no longer does anything.
  const clearReview = useCallback(() => { session.expanded = null; session.draft = null; session.editRevision++; session.editingLoading = false; session.message = null;
    retireConfirmation(); }, [session, retireConfirmation]);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.token++; clearReview(); render(v => v + 1);
    return () => { session.focused = false; session.token++; session.readRevision++; session.reading = false; clearReview(); };
  }, [session, clearReview]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (session.active === active) return;
      session.active = active; session.token++; session.readRevision++; session.reading = false; clearReview();
      if (active) setResume(v => v + 1); else render(v => v + 1);
    });
    return () => subscription.remove();
  }, [session, clearReview]);
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision, token = session.token; session.reading = true; clearReview();
    const owned = () => session.focused && session.active && token === session.token && generation === session.readRevision && accountCurrent();
    const pending = session.pending && !session.pending.inFlight ? session.pending : null;
    if (pending) pending.reconciled = false;
    try {
      const [rows, named] = await Promise.all([
        boundedApplicationSelectionRead(izvor.mojePrijave()),
        pending ? readApplicationCommandState(pending.row) : Promise.resolve(null),
      ]);
      if (!owned()) return { ok: false, kod: 'STALE_READ', poruka: 'Učitaj aktuelne Prijave.' };
      let notice: string | null = null;
      if (pending && session.pending === pending && !pending.inFlight && named) {
        pending.reconciled = named.ok;
        if (!named.ok) notice = 'Sačuvano stanje ove prijave nije potvrđeno. Proveri ponovo pre nove radnje.';
        else if (observed(pending, named.podatak)) {
          notice = withdrawal(pending) ? 'Sačuvano stanje: Prijava je povučena.' : 'Prijava je usklađena sa pregledanom verzijom Zadatka.';
          session.pending = null;
        } else if (pending.result === 'receipt') notice = 'Server je potvrdio radnju. Sačuvana prijava sada ima drugačije stanje; pregledaj je ponovo.';
      }
      return { ok: true, podatak: { rows, notice } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Prijave nisu učitane. Proveri vezu i pokušaj ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  // Resume retires the hook's old owner and reads before showing actions.
  }, [session, izvor, accountCurrent, clearReview, resume]);
  const editor = useOwnedEditor(read), data = editor.data;
  // Every read closes any open review, so the named row is opened after one arrives, and only once:
  // closing it afterwards is the person's decision and is not undone on the next refresh.
  useEffect(() => {
    const id = landing.current;
    if (!id || !data?.rows.some(row => row.prijavaId === id)) return;
    landing.current = null; session.expanded = id; setFocusId(id); render(v => v + 1);
  }, [data, session]);
  const token = session.token, revision = session.readRevision, editRevision = session.editRevision;
  const current = () => session.focused && session.active && token === session.token && revision === session.readRevision && accountCurrent();
  const rowCurrent = (p: MojaPrijavaProjekcija) => current() && !!data?.rows.some(row => identity(row) === identity(p));
  const idle = () => !session.reading && !session.pending && !editor.busy && !editor.uncertain && !session.editingLoading;
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight) void editor.refresh(); };
  const perform = (pending: Pending) => {
    if (!current() || !data || session.reading || pending.inFlight || editor.busy || editor.uncertain ||
        session.pending && (session.pending !== pending || !pending.reconciled)) return;
    void editor.save(async () => {
      session.pending = pending; pending.inFlight = true; pending.reconciled = false; session.message = null;
      let result: Ishod<unknown>;
      try {
        // A timeout bounds waiting, not server execution. After an owned read
        // the exact immutable idempotent command is the only retry allowed.
        const raw = await boundedApplicationSelectionRead<Ishod<unknown>>(pending.intent.kind === 'withdraw'
          ? izvor.povuciPrijavu(pending.intent.command) : ru4Production.resolveChangedApplication(pending.intent.command));
        if (!raw.ok) result = Object.prototype.hasOwnProperty.call(errors, raw.kod)
          ? { ok: false, kod: raw.kod, poruka: errors[raw.kod] } : unknown();
        else {
          const receipt = raw.podatak as { stanje?: string; status?: string; verzija?: number; version?: number };
          const status = pending.intent.kind === 'withdraw' ? receipt?.stanje : receipt?.status;
          const version = pending.intent.kind === 'withdraw' ? receipt?.verzija : receipt?.version;
          result = positiveInteger(version) && version === pending.row.prijavaVerzija + (withdrawal(pending) ? 0 : 1) &&
            status === (withdrawal(pending) ? 'WITHDRAWN' : 'SUBMITTED') ? { ok: true, podatak: null } : unknown();
        }
      } catch { result = unknown(); }
      finally { pending.inFlight = false; }
      if (!accountCurrent() || session.pending !== pending) return unknown();
      pending.result = result.ok ? 'receipt' : result.kod === 'APPLICATION_OUTCOME_UNKNOWN' ? 'unknown' : 'rejected';
      pending.code = result.ok ? null : result.kod;
      if (session.focused && session.active) render(v => v + 1);
      if (!session.focused || !session.active || token !== session.token) return unknown();
      if (!result.ok) return result;
      const fresh = await read();
      if (!fresh.ok) return { ok: false, kod: 'APPLICATION_REFRESH_REQUIRED', poruka: 'Server je potvrdio radnju, ali lista nije učitana. Proveri sačuvano stanje.' };
      return fresh;
    });
  };
  const makeIntent = (p: MojaPrijavaProjekcija, action: 'KEEP' | 'UPDATE' | 'WITHDRAW') => {
    if (!rowCurrent(p) || !idle() || editRevision !== session.editRevision) return;
    const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
    if (stale && session.expanded !== p.prijavaId || !stale && (action !== 'WITHDRAW' || !p.mozePovuci)) return;
    const draft = session.draft ? pricedOffer(session.draft) : null;
    if (action === 'UPDATE') {
      if (!draft) return;
      const price = /^\d+$/.test(draft.price) ? Number(draft.price) : NaN, people = /^\d+$/.test(draft.people) ? Number(draft.people) : NaN;
      if (!positiveInteger(price) || !positiveInteger(people)) { session.message = 'Unesi celu pozitivnu cenu u RSD i ceo broj ljudi.'; render(v => v + 1); return; }
      // Existing RU4 SQL limit, not a new UI/business policy.
      if (Array.from(draft.note.trim()).length > 1200) { session.message = errors.SCOPE_NOTE_TOO_LONG; render(v => v + 1); return; }
    }
    const intent: Intent = stale ? { kind: 'resolve', command: Object.freeze({ prijavaId: p.prijavaId,
      ocekivanaVerzija: p.prijavaVerzija, ocekivanaPotrebaRevizija: p.potrebaRevizija, akcija: action,
      clientRequestId: noviZahtevId(`prijava-${action.toLowerCase()}`),
      pokrivenaMesta: action === 'UPDATE' ? Number(draft!.people) : null, cenaRsd: action === 'UPDATE' ? Number(draft!.price) : null,
      napomena: action === 'UPDATE' ? draft!.note.trim() : null,
      predlozeniPocetak: action === 'UPDATE' ? draft!.start : null, predlozeniKraj: action === 'UPDATE' ? draft!.end : null }) }
      : { kind: 'withdraw', command: Object.freeze({ prijavaId: p.prijavaId, potrebaRevizija: p.potrebaRevizija,
        prijavaVerzija: p.prijavaVerzija, clientRequestId: noviZahtevId('povuci-prijavu'), razlog: null }) };
    perform({ intent, row: p, inFlight: false, reconciled: false, result: null, code: null });
  };
  const withdraw = (p: MojaPrijavaProjekcija) => {
    if (!rowCurrent(p) || !idle()) return;
    const review = session.editRevision;
    // The card shows the title without its stored wrapping quotes; the dialog names the same task the same way.
    confirmation.ask({ title: 'Povući prijavu?', message: `Prijava za „${readableTitle(p.naslov)}” više neće biti aktivna.`,
      cancelLabel: 'Odustani', confirmLabel: 'Povuci', tone: 'danger', onConfirm: () => {
        if (review === session.editRevision) makeIntent(p, 'WITHDRAW');
      } });
  };
  const edit = async (p: MojaPrijavaProjekcija) => {
    if (!rowCurrent(p) || !idle() || session.expanded !== p.prijavaId) return;
    const generation = ++session.editRevision; session.editingLoading = true; session.message = null; render(v => v + 1);
    try {
      const result = await readExistingApplicationInterval(p);
      if (!rowCurrent(p) || generation !== session.editRevision) return;
      if (result.ok) session.draft = pricedOffer({ price: String(p.cena.iznos), people: String(p.pokrivaMesta), note: p.napomena, ...result.podatak });
      else session.message = 'Sačuvani termin ili aktuelna cena nisu potvrđeni. Osveži Prijave pre izmene ponude.';
    } catch { if (current() && generation === session.editRevision) session.message = 'Termin i cena nisu učitani. Osveži Prijave pre izmene.'; }
    finally { if (generation === session.editRevision) { session.editingLoading = false; if (current()) render(v => v + 1); } }
  };
  const navigate = (path: '/zadaci' | '/profil') => { if (current()) router.navigate(path); };
  const pending = session.pending, visible = current();
  return <><MyApplicationsPresentation rows={visible ? data?.rows ?? [] : []} loading={!session.focused || !session.active || editor.loading}
    unavailable={!data} message={session.message ?? editor.error} notice={data?.notice ?? null}
    tab={session.tab} onTab={tab => { if (current()) { clearReview(); session.tab = tab; render(v => v + 1); } }}
    focusId={visible ? focusId : null} requestedId={visible ? named : null}
    expanded={visible ? session.expanded : null} draft={visible ? session.draft : null} busy={editor.busy || !!pending?.inFlight}
    editingLoading={session.editingLoading} pending={!!pending} canRetry={!!pending?.reconciled && !editor.uncertain && pending.result === 'unknown'}
    canReset={!!pending?.reconciled && !editor.uncertain && (pending.result === 'rejected' || pending.result === 'receipt')}
    onRefresh={refresh} onExplore={() => navigate('/zadaci')} onProfile={() => navigate('/profil')}
    onBack={() => { if (current()) { if (router.canGoBack()) router.back(); else router.replace('/'); } }}
    onReview={p => { if (rowCurrent(p) && idle()) { clearReview(); session.expanded = p.prijavaId; render(v => v + 1); } }}
    onClose={() => { if (current() && !session.pending) { clearReview(); render(v => v + 1); } }} onEdit={p => void edit(p)}
    onChange={draft => { if (current() && idle() && editRevision === session.editRevision && session.draft) { session.draft = pricedOffer({ ...session.draft, price: draft.price, people: draft.people, note: draft.note }); session.editRevision++; session.message = null; render(v => v + 1); } }}
    onCancelEdit={() => { if (current() && idle()) { session.draft = null; session.editRevision++; session.message = null; render(v => v + 1); } }}
    onKeep={p => makeIntent(p, 'KEEP')} onUpdate={p => makeIntent(p, 'UPDATE')} onWithdraw={withdraw}
    onAgreement={p => { if (rowCurrent(p) && !session.pending && p.stanje === 'SELECTED' && p.dogovorId) router.push(`/dogovor/${p.dogovorId}` as any); }}
    onTask={p => { if (rowCurrent(p) && !session.pending) router.push({ pathname: '/prilike/[id]', params: { id: p.potrebaId } }); }}
    onRetry={() => { if (pending?.result === 'unknown' && pending === session.pending) perform(pending); }}
    onReset={() => { if (current() && pending === session.pending && pending?.reconciled && (pending.result === 'rejected' || pending.result === 'receipt') && !editor.busy && !editor.uncertain) {
      session.pending = null; clearReview(); render(v => v + 1);
    } }} />{confirmation.sheet}</>;
}
