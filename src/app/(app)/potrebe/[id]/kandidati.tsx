import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../../contracts/projections';
import type { Ishod, IzborKomanda } from '../../../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead, readSelectedAgreement } from '../../../../data/applicationSelectionClientService';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../../../../store/uloga';
import { CandidateListPresentation, CandidateSelectionPresentation, SelectionUnavailable } from '../../../../ui/v2/ApplicationSelectionPresentation';
type Receipt = { dogovorId: string };
type Pending = { command: IzborKomanda; need: PotrebaProjekcija; candidate: KandidatProjekcija; result: Ishod<Receipt> | null; inFlight: boolean; reconciled: boolean };
type Loaded = { need: PotrebaProjekcija; candidates: KandidatProjekcija[]; receipt: Receipt | null };
export default function Kandidati() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const izvor = useIzvor(), router = useRouter(), role = useUloga();
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ pending: null as Pending | null, navigated: false, focused: false, focusToken: 0, readRevision: 0, reading: false }), [id, izvor, user?.id, accountRevision, role]);
  const [, render] = useState(0);
  const [opened, setOpened] = useState<{ data: Loaded; candidate: KandidatProjekcija } | null>(null);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.focusToken++; render(v => v + 1);
    return () => { session.focused = false; };
  }, [session]));
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision; session.reading = true;
    session.navigated = false;
    if (!id) { session.reading = false; return { ok: false, kod: 'UNAVAILABLE', poruka: 'Zadatak nije dostupan.' }; }
    try {
      const [need, candidates] = await boundedApplicationSelectionRead(Promise.all([izvor.potreba(id), izvor.prijaveZaPotrebu(id)]));
      if (!need) return { ok: false, kod: 'UNAVAILABLE', poruka: 'Zadatak nije dostupan.' };
      // RPC needRevision is the current Need revision for every row, including
      // STALE. Its separate responseNeedRevision is the older submitted snapshot.
      // Never combine independent reads from different current Need revisions.
      if (candidates.some(k => k.potrebaRevizija !== need.revizija)) return { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Zadatak se upravo promenio. Učitajte Prijave ponovo.' };
      if (generation !== session.readRevision) return { ok: false, kod: 'STALE_READ', poruka: 'Učitajte aktuelno stanje.' };
      if (session.pending) session.pending.reconciled = !session.pending.inFlight;
      const result = session.pending?.result;
      return { ok: true, podatak: { need, candidates, receipt: result?.ok ? result.podatak : null } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Prijave trenutno nije moguće učitati. Proverite vezu i pokušajte ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  }, [id, izvor, session]);
  const editor = useOwnedEditor(read), data = editor.data;
  const pending = session.pending;
  const candidate = pending?.candidate ?? (opened?.data === data ? opened.candidate : null);
  const focusToken = session.focusToken, readRevision = session.readRevision;
  const currentAccount = () => sesijaSada().user?.id === user?.id && sesijaSada().accountRevision === accountRevision && ulogaSada() === role;
  const current = () => session.focused && session.focusToken === focusToken && session.readRevision === readRevision && currentAccount();
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight) void editor.refresh(); };
  const back = () => {
    if (!current()) return;
    if (opened && !pending) { setOpened(null); return; }
    if (session.navigated) return; session.navigated = true;
    if (router.canGoBack()) router.back(); else if (id) router.replace({ pathname: '/potrebe/[id]/pregled', params: { id } });
    else router.replace('/potrebe');
  };
  const choose = () => {
    const k = candidate;
    if (!current() || session.pending?.inFlight || !data || !k || (!pending && (!k.mozeIzabrati || k.stanje !== 'SELECTABLE' || k.potrebaRevizija !== data.need.revizija))) return;
    void editor.save(async () => {
      if (!session.pending) session.pending = { need: data.need, candidate: k, result: null, inFlight: false, reconciled: false,
        command: Object.freeze({ potrebaId: data.need.id, potrebaRevizija: data.need.revizija, prijavaId: k.prijavaId,
          prijavaVerzija: k.verzija, prijavaHash: k.hash, mesta: k.pokrivaMesta, clientRequestId: noviZahtevId('izbor') }) };
      const request = session.pending;
      request.inFlight = true; request.reconciled = false;
      let result: Ishod<Receipt>;
      try { result = await izvor.izaberiPrijavu(request.command); }
      catch { result = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod izbora nije potvrđen. Proverite stanje.' }; }
      finally { request.inFlight = false; }
      request.result = result;
      if (session.focused && currentAccount()) render(v => v + 1);
      return result.ok ? { ok: true, podatak: { ...data, receipt: result.podatak } } : result;
    });
  };
  if (!data) return <SelectionUnavailable loading={editor.loading} message={editor.error ?? 'Prijave nisu dostupne.'} retry={refresh} back={back} />;
  if (!candidate) return <CandidateListPresentation need={data.need} candidates={data.candidates} back={back} refresh={refresh}
    open={k => { if (current() && !editor.busy) setOpened({ data, candidate: k }); }} />;
  const rejection = pending?.result && !pending.result.ok && Object.prototype.hasOwnProperty.call(applicationSelectionErrors, pending.result.kod);
  return <CandidateSelectionPresentation need={pending?.need ?? data.need} candidate={candidate} back={back}
    readAgreement={async () => {
      if (!current()) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite Prijavu.' };
      const result = await readSelectedAgreement(data.need.id, candidate.prijavaId);
      return current() ? result : { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite Prijavu.' };
    }} openLinkedAgreement={agreementId => {
      if (!current() || session.navigated) return;
      session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } });
    }}
    publicProfile={async () => {
      if (!current()) return null;
      const profile = await izvor.javniProfil(candidate.radnikProfilId);
      return current() ? profile : null;
    }}
    choose={choose} busy={editor.busy || !!pending?.inFlight} pending={!!pending} uncertain={editor.uncertain || (!!pending && !pending.reconciled && !data.receipt)} refresh={refresh}
    error={editor.error ?? (pending && !data.receipt && !editor.uncertain ? 'Aktuelno stanje je učitano. Za potvrdu prvobitnog izbora ponovite isti zahtev.' : null)}
    confirmed={!!data.receipt} openAgreement={() => {
      if (!current() || !data.receipt || session.navigated) return;
      session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: data.receipt.dogovorId } });
    }} reset={rejection && !editor.uncertain ? () => {
      if (!current() || editor.busy || !pending || pending.inFlight || session.pending !== pending || !pending.result || pending.result.ok) return;
      session.pending = null; setOpened(null); void editor.refresh();
    } : undefined} />;
}
