import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { Ishod, PovuciPrijavuKomanda } from '../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead } from '../../data/applicationSelectionClientService';
import { readExistingApplicationInterval } from '../../data/myApplicationsClientService';
import { ru4Production, type Ru4RazresiPrijavuInput } from '../../data/ru4Production';
import { positiveInteger } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../../store/uloga';
import { MyApplicationsPresentation, type ApplicationsTab, type OfferEdit } from '../../ui/v2/MyApplicationsPresentation';

type Intent = { kind: 'withdraw'; command: PovuciPrijavuKomanda } | { kind: 'resolve'; command: Ru4RazresiPrijavuInput };
type Pending = { intent: Intent; row: MojaPrijavaProjekcija; inFlight: boolean; reconciled: boolean;
  result: 'receipt' | 'unknown' | 'rejected' | null; code: string | null };
type Loaded = { rows: MojaPrijavaProjekcija[]; notice: string | null };
const errors: Readonly<Record<string, string>> = { ...applicationSelectionErrors,
  FORBIDDEN: 'Ova Prijava nije dostupna na ovom nalogu.', RESPONSE_NOT_OWNED: 'Ova Prijava nije dostupna na ovom nalogu.',
  RESPONSE_NOT_WITHDRAWABLE: 'Prijavu sada nije moguće povući. Proverite aktuelno stanje.',
  RESPONSE_NOT_AWAITING_REVIEW: 'Prijava više ne čeka ovu proveru. Učitajte aktuelno stanje.',
  RESPONSE_ALREADY_CURRENT: 'Prijava je već usklađena. Učitajte aktuelno stanje.',
  INVALID_PROPOSED_WINDOW: 'Sačuvani termin nije prihvaćen. Proverite aktuelnu Prijavu.',
  SCOPE_NOTE_TOO_LONG: 'Napomena može imati najviše 1.200 znakova.',
};
const unknown = () => ({ ok: false as const, kod: 'APPLICATION_OUTCOME_UNKNOWN', poruka: 'Ishod radnje nije potvrđen. Proverite sačuvano stanje pre ponavljanja.' });
const identity = (p: MojaPrijavaProjekcija) => `${p.prijavaId}:${p.potrebaId}:${p.potrebaRevizija}:${p.prijavaRevizija}:${p.prijavaVerzija}:${p.stanje}`;
const withdrawal = (pending: Pending) => pending.intent.kind === 'withdraw' || pending.intent.command.akcija === 'WITHDRAW';
function observed(pending: Pending, rows: MojaPrijavaProjekcija[]) {
  const row = rows.find(p => p.prijavaId === pending.row.prijavaId && p.potrebaId === pending.row.potrebaId);
  if (!row) return false;
  // A list can establish withdrawal itself. UPDATE/KEEP also require the
  // command receipt; a coincidentally similar offer never proves replay.
  if (withdrawal(pending)) return row.stanje === 'WITHDRAWN' && row.prijavaVerzija >= pending.row.prijavaVerzija;
  const update = pending.intent.kind === 'resolve' && pending.intent.command.akcija === 'UPDATE' ? pending.intent.command : null;
  return pending.result === 'receipt' && row.prijavaVerzija === pending.row.prijavaVerzija + 1 &&
    row.prijavaRevizija === pending.row.potrebaRevizija && row.potrebaRevizija === pending.row.potrebaRevizija &&
    row.cena.iznos === (update ? update.cenaRsd : pending.row.cena.iznos) &&
    row.pokrivaMesta === (update ? update.pokrivenaMesta : pending.row.pokrivaMesta) &&
    row.napomena === (update ? update.napomena : pending.row.napomena) &&
    ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'SELECTED'].includes(row.stanje);
}
export default function MojePrijave() {
  const izvor = useIzvor(), router = useRouter(), role = useUloga();
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ focused: false, active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    token: 0, readRevision: 0, reading: false, editRevision: 0, editingLoading: false, tab: 'all' as ApplicationsTab,
    expanded: null as string | null, draft: null as OfferEdit | null, pending: null as Pending | null, message: null as string | null }),
  [izvor, user?.id, accountRevision, role]);
  const [, render] = useState(0), [resume, setResume] = useState(0);
  const accountCurrent = useCallback(() => !!user?.id && sesijaSada().user?.id === user.id &&
    sesijaSada().accountRevision === accountRevision && ulogaSada() === role, [user?.id, accountRevision, role]);
  const clearReview = useCallback(() => { session.expanded = null; session.draft = null; session.editRevision++; session.editingLoading = false; session.message = null; }, [session]);
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
    try {
      const rows = await boundedApplicationSelectionRead(izvor.mojePrijave());
      if (!owned()) return { ok: false, kod: 'STALE_READ', poruka: 'Učitajte aktuelne Prijave.' };
      const pending = session.pending;
      let notice: string | null = null;
      if (pending && !pending.inFlight) {
        pending.reconciled = true;
        if (observed(pending, rows)) {
          notice = withdrawal(pending) ? 'Sačuvano stanje: Prijava je povučena.' : 'Prijava je usklađena sa pregledanom verzijom Zadatka.';
          session.pending = null;
        } else if (pending.result === 'receipt') notice = 'Server je potvrdio radnju. Aktuelna lista još ne potvrđuje očekivano stanje; proverite ponovo.';
      }
      return { ok: true, podatak: { rows, notice } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Prijave nisu učitane. Proverite vezu i pokušajte ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  // Resume retires the hook's old owner and reads before showing actions.
  }, [session, izvor, accountCurrent, clearReview, resume]);
  const editor = useOwnedEditor(read), data = editor.data;
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
      if (!fresh.ok) return { ok: false, kod: 'APPLICATION_REFRESH_REQUIRED', poruka: 'Server je potvrdio radnju, ali lista nije učitana. Proverite sačuvano stanje.' };
      return fresh;
    });
  };
  const makeIntent = (p: MojaPrijavaProjekcija, action: 'KEEP' | 'UPDATE' | 'WITHDRAW') => {
    if (!rowCurrent(p) || !idle() || editRevision !== session.editRevision) return;
    const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
    if (stale && session.expanded !== p.prijavaId || !stale && (action !== 'WITHDRAW' || !p.mozePovuci)) return;
    const draft = session.draft;
    if (action === 'UPDATE') {
      if (!draft) return;
      const price = /^\d+$/.test(draft.price) ? Number(draft.price) : NaN, people = /^\d+$/.test(draft.people) ? Number(draft.people) : NaN;
      if (!positiveInteger(price) || !positiveInteger(people)) { session.message = 'Unesite celu pozitivnu cenu u RSD i ceo broj ljudi.'; render(v => v + 1); return; }
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
    Alert.alert('Povući prijavu?', `Prijava za „${p.naslov}” više neće biti aktivna.`, [
      { text: 'Odustani', style: 'cancel' }, { text: 'Povuci', style: 'destructive', onPress: () => {
        if (review === session.editRevision) makeIntent(p, 'WITHDRAW');
      } },
    ]);
  };
  const edit = async (p: MojaPrijavaProjekcija) => {
    if (!rowCurrent(p) || !idle() || session.expanded !== p.prijavaId) return;
    const generation = ++session.editRevision; session.editingLoading = true; session.message = null; render(v => v + 1);
    try {
      const result = await readExistingApplicationInterval(p);
      if (!rowCurrent(p) || generation !== session.editRevision) return;
      if (result.ok) session.draft = { price: String(p.cena.iznos), people: String(p.pokrivaMesta), note: p.napomena, ...result.podatak };
      else session.message = 'Sačuvani termin nije potvrđen. Osvežite Prijave pre izmene ponude.';
    } catch { if (current() && generation === session.editRevision) session.message = 'Termin nije učitan. Osvežite Prijave pre izmene.'; }
    finally { if (generation === session.editRevision) { session.editingLoading = false; if (current()) render(v => v + 1); } }
  };
  const navigate = (path: '/prilike' | '/profil') => { if (current()) router.navigate(path); };
  const pending = session.pending, visible = current();
  return <MyApplicationsPresentation rows={visible ? data?.rows ?? [] : []} loading={!session.focused || !session.active || editor.loading}
    unavailable={!data} message={session.message ?? editor.error} notice={data?.notice ?? null}
    tab={session.tab} onTab={tab => { if (current()) { clearReview(); session.tab = tab; render(v => v + 1); } }}
    expanded={visible ? session.expanded : null} draft={visible ? session.draft : null} busy={editor.busy || !!pending?.inFlight}
    editingLoading={session.editingLoading} pending={!!pending} canRetry={!!pending?.reconciled && !editor.uncertain && pending.result === 'unknown'}
    canReset={!!pending?.reconciled && !editor.uncertain && (pending.result === 'rejected' || pending.result === 'receipt')}
    onRefresh={refresh} onExplore={() => navigate('/prilike')} onProfile={() => navigate('/profil')}
    onBack={() => { if (current()) { if (router.canGoBack()) router.back(); else router.replace('/prilike'); } }}
    onReview={p => { if (rowCurrent(p) && idle()) { clearReview(); session.expanded = p.prijavaId; render(v => v + 1); } }}
    onClose={() => { if (current() && !session.pending) { clearReview(); render(v => v + 1); } }} onEdit={p => void edit(p)}
    onChange={draft => { if (current() && idle() && editRevision === session.editRevision && session.draft) { session.draft = { ...session.draft, price: draft.price, people: draft.people, note: draft.note }; session.editRevision++; session.message = null; render(v => v + 1); } }}
    onCancelEdit={() => { if (current() && idle()) { session.draft = null; session.editRevision++; session.message = null; render(v => v + 1); } }}
    onKeep={p => makeIntent(p, 'KEEP')} onUpdate={p => makeIntent(p, 'UPDATE')} onWithdraw={withdraw}
    onAgreement={p => { if (rowCurrent(p) && !session.pending && p.stanje === 'SELECTED' && p.dogovorId) router.push(`/dogovor/${p.dogovorId}` as any); }}
    onRetry={() => { if (pending?.result === 'unknown' && pending === session.pending) perform(pending); }}
    onReset={() => { if (current() && pending === session.pending && pending?.reconciled && (pending.result === 'rejected' || pending.result === 'receipt') && !editor.busy && !editor.uncertain) {
      session.pending = null; clearReview(); render(v => v + 1);
    } }} />;
}
