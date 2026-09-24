import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { RadnikProfilProjekcija } from '../../../contracts/projections';
import type { AzurirajProfilKomanda, Ishod } from '../../../data/ports';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { useIzvor } from '../../../store/uloga';
import { brandAction } from '../../../ui/system/tokens';
import { V2Action } from '../../../ui/v2/V2Action';
import { WorkerProfileFooter, WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus, type WorkerProfileFocusRequest } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { workerCommand, workerDraft, workerReadbackMatches, type WorkerDraft } from '../../../ui/workerProfile/workerProfileDraft';

type Snapshot = { profile: RadnikProfilProjekcija | null; read: number };
type Draft = { value: WorkerDraft; initial: WorkerDraft; profileId: string | null };
type Attempt = { command: AzurirajProfilKomanda; expected: AzurirajProfilKomanda; profileId: string | null; afterRead: number };
const failed = (): Ishod<Snapshot> => ({ ok: false, kod: 'PROFILE_UNCONFIRMED',
  poruka: 'Čuvanje nije potvrđeno. Pogledaj sačuvani profil pre nego što probaš ponovo.' });
async function bounded<T>(request: () => Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), milliseconds); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export default function ProfilRadnikEkran() {
  const session = useSesija();
  return <OwnedWorkerProfile key={`${session.user?.id}:${session.accountRevision}`}
    accountId={session.user?.id} accountRevision={session.accountRevision} />;
}
function OwnedWorkerProfile({ accountId, accountRevision }: { accountId?: string; accountRevision: number }) {
  const izvor = useIzvor();
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const lifecycle = useRef({ focus: null as object | null, active: !AppState.currentState || AppState.currentState === 'active', generation: 0 });
  const [foreground, setForeground] = useState(lifecycle.current.active), [resumeRequired, setResumeRequired] = useState(false);
  const [focusEpoch, setFocusEpoch] = useState(0);
  useFocusEffect(useCallback(() => {
    const token = {}; lifecycle.current.focus = token; setFocusEpoch(value => value + 1);
    return () => { if (lifecycle.current.focus === token) { lifecycle.current.focus = null; lifecycle.current.generation++; } };
  }, []));
  useEffect(() => { const subscription = AppState.addEventListener('change', state => {
    lifecycle.current.active = state === 'active'; lifecycle.current.generation++;
    setForeground(lifecycle.current.active); setResumeRequired(true);
  }); return () => { subscription.remove(); lifecycle.current.active = false; }; }, []);
  const readSequence = useRef(0);
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    if (!owns()) return failed();
    const sequence = ++readSequence.current;
    try {
      const profile = await bounded(() => izvor.mojRadnikProfil(), 15_000);
      if (!owns()) return failed();
      return { ok: true, podatak: { profile, read: sequence } };
    } catch { return { ok: false, kod: 'PROFILE_READ_FAILED', poruka: 'Profil nije učitan. Proveri vezu pa probaj ponovo.' }; }
  }, [izvor, owns]);
  const editor = useOwnedEditor(read);
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null), draftGeneration = useRef(0);
  const [pending, setPending] = useState<Attempt | null>(null), pendingRef = useRef<Attempt | null>(null);
  const [transportBusy, setTransportBusy] = useState(false), transportRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null), [validation, setValidation] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<WorkerProfileFocusRequest | null>(null), focusRequestSequence = useRef(0);
  const setLocal = (next: Draft) => { draftGeneration.current++; draftRef.current = next; setDraft(next); };
  useEffect(() => {
    if (!editor.data || transportBusy) return;
    const { profile, read: sequence } = editor.data, attempt = pendingRef.current;
    const confirmed = attempt && sequence > attempt.afterRead && workerReadbackMatches(profile, attempt.expected, attempt.profileId);
    const pristine = draftRef.current && JSON.stringify(draftRef.current.value) === JSON.stringify(draftRef.current.initial);
    if (!draftRef.current || confirmed || (!attempt && pristine)) {
      const value = workerDraft(profile); setLocal({ value, initial: value, profileId: profile?.id ?? null });
    }
    if (confirmed) {
      pendingRef.current = null; setPending(null); setValidation(null);
      setMessage(attempt.command.zavrsi ? 'Profil je aktivan. Sačuvani podaci su potvrđeni.'
        : attempt.profileId === null ? 'Profil je sačuvan i provereno učitan. Nastavi sa podešavanjem.'
          : 'Izmene profila su sačuvane i proverene.');
    }
  }, [editor.data, transportBusy]);
  useEffect(() => {
    if (!foreground || !resumeRequired || transportBusy || !lifecycle.current.focus) return;
    let current = true;
    const generation = lifecycle.current.generation;
    void editor.refresh().then(() => {
      if (current && owns() && lifecycle.current.active && generation === lifecycle.current.generation) setResumeRequired(false);
    });
    return () => { current = false; };
  }, [foreground, resumeRequired, transportBusy, editor.refresh, focusEpoch, owns]);
  const focus = lifecycle.current.focus, generation = lifecycle.current.generation, renderedDraft = draftGeneration.current;
  const current = () => owns() && !!focus && lifecycle.current.focus === focus && lifecycle.current.active && lifecycle.current.generation === generation;
  const enabled = current() && !resumeRequired && !transportBusy && !editor.busy && !editor.loading && !editor.error && !editor.uncertain;
  const back = () => { if (!current()) return; if (router.canGoBack()) router.back(); else router.replace('/profil'); };
  const change = (value: WorkerDraft) => {
    if (!enabled || transportRef.current || pendingRef.current || renderedDraft !== draftGeneration.current || !draftRef.current || !current()) return;
    setLocal({ ...draftRef.current, value }); setMessage(null); setValidation(null); setFocusRequest(null);
  };
  const save = async (activate: boolean) => {
    if (!enabled || !current() || transportRef.current || !draftRef.current || renderedDraft !== draftGeneration.current) return;
    const built = pendingRef.current ? { command: pendingRef.current.command, expected: pendingRef.current.expected } : workerCommand(draftRef.current.value, draftRef.current.initial, activate);
    if (!built.command) { setValidation(built.error ?? 'Proveri unos.'); return; }
    const attempt = pendingRef.current ?? { command: built.command, expected: built.expected!, profileId: draftRef.current.profileId, afterRead: readSequence.current };
    await editor.save(async () => {
      transportRef.current = true; setTransportBusy(true); pendingRef.current = attempt; setPending(attempt); setMessage(null); setValidation(null);
      try {
        // The existing writer bounds each of its four authenticated operations
        // to 15s. Keep its whole pipeline owned until it settles; never replay it.
        const result = await bounded(() => izvor.azurirajRadnikProfil(attempt.command), 65_000);
        if (!current()) return failed();
        if (!result.ok) return failed();
        const refreshed = await read();
        if (!current() || !refreshed.ok || !workerReadbackMatches(refreshed.podatak.profile, attempt.expected, attempt.profileId)) return failed();
        return refreshed;
      } catch { return failed(); }
      finally {
        transportRef.current = false;
        if (owns()) { setTransportBusy(false); if (!current()) setResumeRequired(true); }
      }
    });
  };
  const refresh = () => { if (current() && !transportRef.current) { setMessage(null); void editor.refresh(); } };
  const editAfterRead = () => {
    if (!enabled || !current() || transportRef.current || !editor.data || !pendingRef.current || editor.data.read <= pendingRef.current.afterRead) return;
    pendingRef.current = null; setPending(null); setMessage(null); setValidation(null); draftGeneration.current++;
  };
  const navigate = (path: '/profil/lokacija' | '/profil/dostupnost' | '/podrska') => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) {
      setValidation('Sačuvaj unos pre otvaranja drugog podešavanja.'); return;
    }
    router.navigate(path);
  };
  const guide = (target: WorkerProfileFocusRequest['target'], copy: string) => {
    if (!enabled || !current() || pendingRef.current || transportRef.current) return;
    setValidation(copy); setMessage(null);
    setFocusRequest({ target, token: ++focusRequestSequence.current });
  };
  const visible = foreground && !resumeRequired && !!editor.data && !!draft && !!focus;
  const profile = editor.data?.profile ?? null;
  const status = profile?.stanje ?? null;
  const firstSave = profile === null;
  const localDirty = !!draft && JSON.stringify(draft.value) !== JSON.stringify(draft.initial);
  const value = draft?.value;
  const basicsReady = !!value && value.ime.trim().length >= 2 && value.vestine.length > 0;
  const locationReady = !!value && value.grad.trim().length >= 2 && /^\d{1,3}$/.test(value.radius)
    && Number(value.radius) >= 1 && Number(value.radius) <= 200;
  const capacityReady = !!value && /^[0-9]{1,2}$/.test(value.capacity) && Number(value.capacity) >= 1 && Number(value.capacity) <= 50;
  const primary = (() => {
    if (status === 'ACTIVE' || status === 'SUSPENDED') return { label: 'Sačuvaj izmene', run: () => { void save(false); } };
    if (firstSave) return { label: 'Sačuvaj profil', run: () => { void save(false); } };
    if (status !== 'DRAFT') return { label: 'Osveži radni profil', run: refresh };
    if (localDirty) return { label: 'Sačuvaj izmene', run: () => { void save(false); } };
    if (value?.capacityRevision === null) return { label: 'Učitaj kapacitet profila', run: refresh };
    if (!locationReady) return { label: 'Podesi područje rada', run: () => navigate('/profil/lokacija') };
    if (!basicsReady) return { label: 'Dopuni osnovne podatke', run: () => guide((value?.ime.trim().length ?? 0) >= 2 ? 'skill' : 'name',
      'Pre aktivacije unesi ime od najmanje 2 znaka i bar jednu veštinu.') };
    if (!capacityReady) return { label: 'Unesi kapacitet tima', run: () => guide('capacity', 'Unesi kapacitet od 1 do 50 ljudi.') };
    return { label: 'Proveri i aktiviraj profil', run: () => { void save(true); } };
  })();
  // The other way to fill this in, not the first thing on it: a row near the end of the form, behind the same guards.
  const openConversation = () => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) {
      setValidation('Sačuvaj unos pre otvaranja razgovora.'); return;
    }
    router.push('/profil/razgovor');
  };
  // The answer to a save stands in the footer, above the button that was pressed (it used to sit at the top of the scroll).
  return <WorkerProfileFrame back={back} footer={visible ? <WorkerProfileFooter message={message} error={validation ?? editor.error}
    held={!!pending && !transportBusy}>
    {pending && (editor.uncertain || editor.error) ? <V2Action label="Pogledaj sačuvani profil" disabled={transportBusy} onPress={refresh} style={brandAction} />
      : <V2Action label={transportBusy ? 'Čuvamo profil…' : pending ? 'Ponovi isto čuvanje' : primary.label}
        disabled={!enabled} loading={transportBusy} success={!!message} onPress={() => { if (pending) void save(false); else primary.run(); }}
        style={brandAction} />}
    {!pending && status === 'DRAFT' && primary.label !== 'Sačuvaj izmene' ? <V2Action label="Sačuvaj kao nacrt" kind="quiet" disabled={!enabled} onPress={() => { void save(false); }} /> : null}
    {pending && enabled ? <V2Action label="Uredi unos posle provere" kind="quiet" onPress={editAfterRead} /> : null}
  </WorkerProfileFooter> : undefined}>
    {!visible ? <WorkerProfileStatus loading={!foreground || resumeRequired || editor.loading || transportBusy} error={editor.error} retry={refresh} />
      : <WorkerProfileForm draft={draft!.value} change={change} disabled={!enabled || !!pending} status={status} navigate={navigate} focusRequest={focusRequest}
        checks={{ basics: basicsReady, area: locationReady, capacity: capacityReady }} openConversation={openConversation} />}
  </WorkerProfileFrame>;
}
