import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { MojaPrijavaProjekcija, PotrebaProjekcija, PrilikaProjekcija, RadnikProfilProjekcija } from '../../../../contracts/projections';
import type { Ishod, PodnesiPrijavuKomanda } from '../../../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead } from '../../../../data/applicationSelectionClientService';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../../../../store/uloga';
import { ApplicationSelectionPresentation, SelectionUnavailable, type ApplicationDraft } from '../../../../ui/v2/ApplicationSelectionPresentation';

type Receipt = { prijavaId: string; verzija: number; hash: string };
type Loaded = { need: PotrebaProjekcija; opportunity: PrilikaProjekcija; profile: RadnikProfilProjekcija; applications: MojaPrijavaProjekcija[]; receipt: Receipt | null };
type Pending = { command: PodnesiPrijavuKomanda; need: PotrebaProjekcija; opportunity: PrilikaProjekcija; profile: RadnikProfilProjekcija; result: Ishod<Receipt> | null; inFlight: boolean; reconciled: boolean };
export default function Prijava() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const izvor = useIzvor(), router = useRouter(), role = useUloga();
  const { user, accountRevision } = useSesija();
  // One uncertain intent survives a retained tab, but never an A→B→A transition.
  const session = useMemo(() => ({ pending: null as Pending | null, draft: null as ApplicationDraft | null, navigated: false, focused: false, focusToken: 0, readRevision: 0, reading: false }),
    [id, izvor, user?.id, accountRevision, role]);
  const [, render] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.focusToken++; render(v => v + 1);
    return () => { session.focused = false; };
  }, [session]));
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision; session.reading = true;
    session.navigated = false;
    if (!id) { session.reading = false; return { ok: false, kod: 'UNAVAILABLE', poruka: 'Podaci za prijavu nisu dostupni.' }; }
    try {
      const [liveOpportunity, liveNeed, liveProfile, applications] = await boundedApplicationSelectionRead(Promise.all([
        izvor.prilika(id), izvor.potreba(id), izvor.mojRadnikProfil(), izvor.mojePrijave(),
      ]));
      // Visibility can close after a committed write. A successful owned list
      // read still permits replay of only the frozen original request.
      const opportunity = liveOpportunity ?? session.pending?.opportunity;
      const need = liveNeed ?? session.pending?.need;
      const profile = liveProfile ?? session.pending?.profile;
      if (!opportunity || !need || !profile) return { ok: false, kod: 'UNAVAILABLE', poruka: 'Podaci za prijavu nisu dostupni. Proverite Zadatak i radni profil.' };
      if (generation !== session.readRevision) return { ok: false, kod: 'STALE_READ', poruka: 'Učitajte aktuelno stanje.' };
      // Displayed terms and command revision come from the same Need read.
      const displayedOpportunity = { ...opportunity, naslov: need.naslov, podrucjeTekst: need.podrucjeTekst, vremeTekst: need.vremeTekst,
        pokrivenost: need.pokrivenost, rezimCene: need.rezimCene, ponudjenaCena: need.ponudjenaCena };
      if (!session.draft) session.draft = { price: need.rezimCene === 'MY_PRICE' ? String(need.ponudjenaCena?.iznos ?? '') : '', people: '1', note: '', start: null, end: null };
      else if (!session.pending && need.rezimCene === 'MY_PRICE') session.draft = { ...session.draft, price: String(need.ponudjenaCena?.iznos ?? '') };
      if (session.pending) session.pending.reconciled = !session.pending.inFlight;
      const result = session.pending?.result;
      return { ok: true, podatak: { opportunity: displayedOpportunity, need, profile, applications, receipt: result?.ok ? result.podatak : null } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Podatke za prijavu trenutno nije moguće učitati. Proverite vezu i pokušajte ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  }, [id, izvor, session]);
  const editor = useOwnedEditor(read), data = editor.data;
  const focusToken = session.focusToken, readRevision = session.readRevision;
  const currentAccount = () => sesijaSada().user?.id === user?.id && sesijaSada().accountRevision === accountRevision && ulogaSada() === role;
  const current = () => session.focused && session.focusToken === focusToken && session.readRevision === readRevision && currentAccount();
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight) void editor.refresh(); };
  const back = () => {
    if (!current()) return;
    if (session.navigated) return;
    session.navigated = true;
    if (router.canGoBack()) router.back();
    else if (id) router.replace({ pathname: '/prilike/[id]', params: { id } });
    else router.replace('/prilike');
  };
  const submit = () => {
    if (!current() || !data || !session.draft || session.pending?.inFlight) return;
    const draft = session.draft;
    if (!session.pending) {
      const price = /^\d+$/.test(draft.price) ? Number(draft.price) : NaN;
      const people = /^\d+$/.test(draft.people) ? Number(draft.people) : NaN;
      if (!Number.isSafeInteger(price) || price < 1 || price > 2_147_483_647 || !Number.isSafeInteger(people) ||
          people < 1 || people > data.need.pokrivenost.preostalo) { setValidation('Unesite celu cenu u RSD i broj ljudi koji staje u preostala mesta.'); return; }
      if (data.profile.stanje !== 'ACTIVE' || data.opportunity.primaNovePrijave !== true) { setValidation('Proverite aktuelni Zadatak i aktivan radni profil.'); return; }
      const deadline = data.opportunity.rokZaPrijaveIso;
      if (typeof deadline === 'string' && Date.parse(deadline) <= Date.now()) { setValidation('Rok za prijave je istekao. Osvežite Zadatak.'); return; }
    }
    void editor.save(async () => {
      setValidation(null);
      if (!session.pending) session.pending = { need: data.need, opportunity: data.opportunity, profile: data.profile, result: null, inFlight: false, reconciled: false,
        command: Object.freeze({ clientRequestId: noviZahtevId('prijava'), potrebaId: data.need.id, potrebaRevizija: data.need.revizija,
          radnikProfilId: data.profile.id, pokrivenaMesta: Number(draft.people), cenaRsd: Number(draft.price),
          predlozeniPocetak: draft.start, predlozeniKraj: draft.end, napomena: draft.note.trim() || null }) };
      const pending = session.pending;
      pending.inFlight = true; pending.reconciled = false;
      let result: Ishod<Receipt>;
      try { result = await izvor.podnesiPrijavu(pending.command); }
      catch { result = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod slanja nije potvrđen. Proverite stanje.' }; }
      finally { pending.inFlight = false; }
      pending.result = result;
      if (session.focused && currentAccount()) render(v => v + 1);
      return result.ok ? { ok: true, podatak: { ...data, receipt: result.podatak } } : result;
    });
  };
  if (!data || !session.draft) return <SelectionUnavailable loading={editor.loading} message={editor.error ?? 'Podaci za prijavu nisu dostupni.'}
    retry={refresh} back={back} />;
  const pending = session.pending;
  const rejection = pending?.result && !pending.result.ok && Object.prototype.hasOwnProperty.call(applicationSelectionErrors, pending.result.kod);
  const reset = pending && rejection && !editor.uncertain ? () => {
    if (!current() || editor.busy || pending.inFlight || session.pending !== pending || !pending.result || pending.result.ok) return;
    session.pending = null;
    session.draft = { ...session.draft!, price: data.opportunity.rezimCene === 'MY_PRICE'
      ? String(data.opportunity.ponudjenaCena?.iznos ?? '') : session.draft!.price };
    setValidation(null); void editor.refresh();
  } : undefined;
  return <ApplicationSelectionPresentation need={pending?.need ?? data.need} opportunity={pending?.opportunity ?? data.opportunity}
    draft={session.draft} change={draft => { if (current() && !editor.busy && !session.pending) { session.draft = draft; setValidation(null); render(v => v + 1); } }}
    busy={editor.busy || !!pending?.inFlight} pending={!!pending} uncertain={editor.uncertain || (!!pending && !pending.reconciled && !data.receipt)} confirmed={!!data.receipt}
    error={validation ?? editor.error ?? (pending && !data.receipt && !editor.uncertain ? 'Aktuelne Prijave su proverene. Za potvrdu ishoda ponovite isti sačuvani zahtev.' : null)}
    canSubmit={data.profile.stanje === 'ACTIVE' && data.opportunity.primaNovePrijave === true}
    submit={submit} back={back} refresh={refresh} reset={reset}
    openApplications={() => { if (!current() || !data.receipt || session.navigated) return; session.navigated = true; router.replace('/moje-prijave'); }} />;
}
