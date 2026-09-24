import { useCallback, useMemo, useState } from 'react';
import { ProfilePhoto } from '../../../../ui/media/ContextPhotos';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../../contracts/projections';
import type { Ishod, IzborKomanda } from '../../../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead, readSelectedAgreement } from '../../../../data/applicationSelectionClientService';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { useIzvor } from '../../../../store/uloga';
import { CandidateListPresentation, CandidateSelectionPresentation, SelectionUnavailable, type CandidateSort } from '../../../../ui/v2/ApplicationSelectionPresentation';
import { useSafetyEntry } from '../../../../ui/safety/useSafetyEntry';
import { Avatar, type AvatarSize } from '../../../../ui/system/Avatar';
type Receipt = { dogovorId: string };
type Pending = { command: IzborKomanda; need: PotrebaProjekcija; candidate: KandidatProjekcija; result: Ishod<Receipt> | null; inFlight: boolean; reconciled: boolean };
type Loaded = { need: PotrebaProjekcija; candidates: KandidatProjekcija[]; receipt: Receipt | null };
type Viewed = { state: 'PENDING' | 'CONFIRMED' | 'UNCONFIRMED' };
export default function Kandidati() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const izvor = useIzvor(), router = useRouter();
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ pending: null as Pending | null, viewed: new Map<string, Viewed>(), navigated: false, focused: false, focusToken: 0, readRevision: 0, reading: false }), [id, izvor, user?.id, accountRevision]);
  const [, render] = useState(0);
  const [opened, setOpened] = useState<{ data: Loaded; candidate: KandidatProjekcija } | null>(null);
  // The order chosen on the list outlives opening one offer and coming back; it belongs to this Task and
  // this account only, and it is a view of rows already read, never a new request.
  const sortScope = `${id ?? ''}:${user?.id ?? ''}:${accountRevision}`;
  const [sorted, setSorted] = useState<{ scope: string; sort: CandidateSort } | null>(null);
  // A person's photo by their verified public profile id; without one (or while it cannot be read) the one Avatar with the
  // letters the candidate read already carries. One function for the life of the screen, so the memoised rows keep.
  const photo = useCallback((k: KandidatProjekcija, size: AvatarSize) => <ProfilePhoto profileId={k.radnikProfilId} size={size} initial={null}
    fallback={<Avatar size={size} initials={k.inicijali || null} />} />, []);
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
      if (candidates.some(k => k.potrebaRevizija !== need.revizija)) return { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Zadatak se upravo promenio. Učitaj Prijave ponovo.' };
      if (generation !== session.readRevision) return { ok: false, kod: 'STALE_READ', poruka: 'Učitaj aktuelno stanje.' };
      if (session.pending) session.pending.reconciled = !session.pending.inFlight;
      const result = session.pending?.result;
      return { ok: true, podatak: { need, candidates, receipt: result?.ok ? result.podatak : null } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Prijave trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  }, [id, izvor, session]);
  const editor = useOwnedEditor(read), data = editor.data;
  const pending = session.pending;
  const candidate = pending?.candidate ?? (opened?.data === data ? opened.candidate : null);
  // F05: a candidate is a person; the server resolves the safety target before bezbednost opens.
  const safety = useSafetyEntry(candidate?.radnikProfilId, { needId: id ?? null });
  const focusToken = session.focusToken, readRevision = session.readRevision;
  const currentAccount = () => sesijaSada().user?.id === user?.id && sesijaSada().accountRevision === accountRevision;
  const current = () => session.focused && session.focusToken === focusToken && session.readRevision === readRevision && currentAccount();
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight) void editor.refresh(); };
  const back = () => {
    if (!current()) return;
    if (opened && !pending) { setOpened(null); return; }
    if (session.navigated) return; session.navigated = true;
    if (router.canGoBack()) router.back(); else if (id) router.replace({ pathname: '/potrebe/[id]/pregled', params: { id } });
    else router.replace('/potrebe');
  };
  // The offer's confirmation waits on the returned command; every guard below still decides alone whether it runs.
  const choose = () => {
    const k = candidate;
    if (!current() || session.pending?.inFlight || !data || !k || (!pending && (!k.mozeIzabrati || k.stanje !== 'SELECTABLE' || k.potrebaRevizija !== data.need.revizija))) return;
    return editor.save(async () => {
      if (!session.pending) session.pending = { need: data.need, candidate: k, result: null, inFlight: false, reconciled: false,
        command: Object.freeze({ potrebaId: data.need.id, potrebaRevizija: data.need.revizija, prijavaId: k.prijavaId,
          prijavaVerzija: k.verzija, prijavaHash: k.hash, mesta: k.pokrivaMesta, clientRequestId: noviZahtevId('izbor') }) };
      const request = session.pending;
      request.inFlight = true; request.reconciled = false;
      let result: Ishod<Receipt>;
      try { result = await izvor.izaberiPrijavu(request.command); }
      catch { result = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod izbora nije potvrđen. Proveri stanje.' }; }
      finally { request.inFlight = false; }
      request.result = result;
      if (session.focused && currentAccount()) render(v => v + 1);
      return result.ok ? { ok: true, podatak: { ...data, receipt: result.podatak } } : result;
    });
  };
  const openOffer = (k: KandidatProjekcija) => {
    if (!current() || session.navigated || session.reading || editor.busy || editor.loading || !data ||
        !data.candidates.includes(k)) return;
    setOpened({ data, candidate: k });
    const previous = session.viewed.get(k.prijavaId);
    if (previous && previous.state !== 'UNCONFIRMED') return;
    const attempt: Viewed = { state: 'PENDING' };
    session.viewed.set(k.prijavaId, attempt);
    // Only this explicit offer-opening action writes viewed state. Reopening an
    // unconfirmed offer may repeat its exact idempotent target; reads never do.
    void (async () => {
      try {
        const result = await izvor.oznaciPrijavuVidjenom(k.prijavaId);
        attempt.state = result.ok ? 'CONFIRMED' : 'UNCONFIRMED';
      } catch { attempt.state = 'UNCONFIRMED'; }
      // The result remains scoped to this original account/session object.
      // A late result cannot navigate, change selection, or update another view.
      if (current() && session.viewed.get(k.prijavaId) === attempt) render(value => value + 1);
    })();
  };
  // The row at the top of the list opens the Task itself, whichever screen the list was opened from.
  const openTask = () => {
    if (!current() || session.navigated || !id) return;
    session.navigated = true; router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id } });
  };
  if (!data) return <SelectionUnavailable loading={editor.loading} message={editor.error ?? 'Prijave nisu dostupne.'} retry={refresh} back={back} />;
  // Step 7 (2026-09-24): the list stays under an opened offer, which is a sheet over it; closing the sheet is `back`.
  const list = <CandidateListPresentation need={data.need} candidates={data.candidates} back={back} refresh={refresh}
    open={openOffer} openTask={openTask} sort={sorted?.scope === sortScope ? sorted.sort : 'ARRIVAL'}
    onSort={sort => setSorted({ scope: sortScope, sort })} photo={photo} />;
  if (!candidate) return list;
  const rejection = pending?.result && !pending.result.ok && Object.prototype.hasOwnProperty.call(applicationSelectionErrors, pending.result.kod);
  return <>{list}<CandidateSelectionPresentation need={pending?.need ?? data.need} candidate={candidate} back={back}
    photo={photo(candidate, 56)} safety={safety}
    // The profile sheet's 96 px portrait, as the task's poster sheet draws it: the photo or its own large stand-in.
    publicPhoto={(profileId, size) => <ProfilePhoto profileId={profileId} size={size ?? 96} initial={null} />}
    readAgreement={async () => {
      if (!current()) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvori Prijavu.' };
      const result = await readSelectedAgreement(data.need.id, candidate.prijavaId);
      return current() ? result : { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvori Prijavu.' };
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
    error={editor.error ?? (pending && !data.receipt && !editor.uncertain ? 'Aktuelno stanje je učitano. Za potvrdu prvobitnog izbora ponovi isti zahtev.'
      : session.viewed.get(candidate.prijavaId)?.state === 'UNCONFIRMED'
        ? 'Ponuda je otvorena, ali oznaka viđenosti nije potvrđena. Zatvori ponudu i otvori je ponovo da pokušaš još jednom.' : null)}
    confirmed={!!data.receipt} openAgreement={() => {
      if (!current() || !data.receipt || session.navigated) return;
      session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: data.receipt.dogovorId } });
    }} reset={rejection && !editor.uncertain ? () => {
      if (!current() || editor.busy || !pending || pending.inFlight || session.pending !== pending || !pending.result || pending.result.ok) return;
      session.pending = null; setOpened(null); void editor.refresh();
    } : undefined} /></>;
}
