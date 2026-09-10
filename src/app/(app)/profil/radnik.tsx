import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { RadnikProfilProjekcija } from '../../../contracts/projections';
import type { AzurirajProfilKomanda, Ishod } from '../../../data/ports';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../../../store/uloga';
import { T } from '../../../ui/Text';
import { v2 } from '../../../ui/v2/tokens';
import { V2Action } from '../../../ui/v2/V2Action';
import { WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { workerCommand, workerDraft, workerReadbackMatches, type WorkerDraft } from '../../../ui/workerProfile/workerProfileDraft';

type Snapshot = { profile: RadnikProfilProjekcija | null; read: number };
type Draft = { value: WorkerDraft; initial: WorkerDraft; profileId: string | null };
type Attempt = { command: AzurirajProfilKomanda; expected: AzurirajProfilKomanda; profileId: string | null; afterRead: number };
const failed = (): Ishod<Snapshot> => ({ ok: false, kod: 'PROFILE_UNCONFIRMED',
  poruka: 'Čuvanje nije potvrđeno. Proverite sačuvani profil pre ponovnog pokušaja.' });
async function bounded<T>(request: () => Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), milliseconds); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export default function ProfilRadnikEkran() {
  const session = useSesija(), intent = useUloga();
  return <OwnedWorkerProfile key={`${session.user?.id}:${session.accountRevision}:${intent}`}
    accountId={session.user?.id} accountRevision={session.accountRevision} />;
}
function OwnedWorkerProfile({ accountId, accountRevision }: { accountId?: string; accountRevision: number }) {
  const izvor = useIzvor(), intent = useUloga();
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision && ulogaSada() === intent, [accountId, accountRevision, intent]);
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
    } catch { return { ok: false, kod: 'PROFILE_READ_FAILED', poruka: 'Profil nije učitan. Proverite vezu i pokušajte ponovo.' }; }
  }, [izvor, owns]);
  const editor = useOwnedEditor(read);
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null), draftGeneration = useRef(0);
  const [pending, setPending] = useState<Attempt | null>(null), pendingRef = useRef<Attempt | null>(null);
  const [transportBusy, setTransportBusy] = useState(false), transportRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null), [validation, setValidation] = useState<string | null>(null);
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
      setMessage(attempt.command.zavrsi ? 'Profil je aktivan. Sačuvani podaci su potvrđeni.' : 'Izmene profila su sačuvane i proverene.');
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
    setLocal({ ...draftRef.current, value }); setMessage(null); setValidation(null);
  };
  const save = async (activate: boolean) => {
    if (!enabled || !current() || transportRef.current || !draftRef.current || renderedDraft !== draftGeneration.current) return;
    const built = pendingRef.current ? { command: pendingRef.current.command, expected: pendingRef.current.expected } : workerCommand(draftRef.current.value, draftRef.current.initial, activate);
    if (!built.command) { setValidation(built.error ?? 'Proverite unos.'); return; }
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
  const navigate = (path: '/profil/lokacija' | '/profil/dostupnost' | '/raspored') => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) {
      setValidation('Sačuvajte unos pre otvaranja drugog podešavanja.'); return;
    }
    router.navigate(path);
  };
  const visible = foreground && !resumeRequired && !!editor.data && !!draft && !!focus;
  const status = editor.data?.profile?.stanje ?? null;
  return <WorkerProfileFrame back={back} footer={visible ? <>
    {pending && (editor.uncertain || editor.error) ? <V2Action label="Proverite sačuvani profil" disabled={transportBusy} onPress={refresh} />
      : <V2Action label={transportBusy ? 'Čuvamo profil…' : pending ? 'Ponovi isto čuvanje' : status === 'ACTIVE' || status === 'SUSPENDED' ? 'Sačuvaj izmene' : 'Proveri i aktiviraj profil'}
        disabled={!enabled} onPress={() => { void save(status !== 'ACTIVE' && status !== 'SUSPENDED'); }}
        style={{ backgroundColor: v2.color.orange, borderWidth: 0 }} />}
    {!pending && status !== 'ACTIVE' && status !== 'SUSPENDED' ? <V2Action label="Sačuvaj kao nacrt" kind="quiet" disabled={!enabled} onPress={() => { void save(false); }} /> : null}
    {pending && enabled ? <V2Action label="Uredi unos posle provere" kind="quiet" onPress={editAfterRead} /> : null}
  </> : undefined}>
    {!visible ? <WorkerProfileStatus loading={!foreground || resumeRequired || editor.loading || transportBusy} error={editor.error} retry={refresh} /> : <>
      {message ? <T accessibilityRole="alert" style={{ ...v2.text.body, color: v2.color.teal }}>{message}</T> : null}
      {validation || editor.error ? <T accessibilityRole="alert" style={{ ...v2.text.body, color: v2.color.danger }}>{validation ?? editor.error}</T> : null}
      {pending && !transportBusy ? <T style={{ ...v2.text.label, color: v2.color.muted }}>Vaš unos je zadržan. Prikaz potvrđuje samo podatke koji su ponovo pročitani sa servera.</T> : null}
      <WorkerProfileForm draft={draft!.value} change={change} disabled={!enabled || !!pending} status={status} navigate={navigate} />
    </>}
  </WorkerProfileFrame>;
}
