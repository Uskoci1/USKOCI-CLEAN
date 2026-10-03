import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { safetyClientService, SAFETY_CATEGORIES, type SafetyCategory, type SafetyReportCommand, type SafetyReportReceipt } from '../../data/safetyClientService';
import { safetyTargetNameBuilt } from '../../data/safetyTargetNameGate';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';

import { SettingsText as T, SettingsScreen, SettingsAction } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { withInter } from '../interFont';
import { sys } from '../system/tokens';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { vreme } from '../../lib/vreme';
import { useSafetyTargetName } from './useSafetyTargetName';

const safetyCategoryCopy: Record<SafetyCategory, string> = {
  HARASSMENT: 'Uznemiravanje', FRAUD: 'Prevara', UNSAFE_WORK: 'Nebezbedan rad', DISCRIMINATION: 'Diskriminacija', OTHER: 'Drugo',
};
type Context = { targetAccountId: string; needId: string | null; agreementId: string | null };
const back = () => router.canGoBack() ? router.back() : router.replace('/profil');
const blockConsequence = 'Blokiranje zaustavlja običan kontakt i nova povezivanja. Završetak, otkazivanje i prijava problema u postojećem Dogovoru ostaju dostupni.';

/**
 * `profileId` (EX-07 S06) is the profile the person came from, handed on by the route only in a build compiled with the safety-target-name flag. It is an identifier,
 * never a name: the screen asks the server for the name of that profile (see useSafetyTargetName) and keeps its generic copy when there is none.
 */
export function SafetyScreen({ profileId, ...p }: Context & { profileId?: string }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const confirmation = useConfirmSheet(), closeConfirmation = confirmation.close;
  const questionGeneration = useRef(0);
  const [, redrawQuestion] = useState(0);
  const retireConfirmation = useCallback(() => {
    questionGeneration.current++; closeConfirmation(); redrawQuestion(value => value + 1);
  }, [closeConfirmation]);
  const read = useCallback(() => { retireConfirmation(); return safetyClientService.readBlock(p.targetAccountId); }, [p.targetAccountId, retireConfirmation]);
  const editor = useOwnedEditor(read), blockCommand = useRef<{
    accountId: string; accountRevision: number; targetAccountId: string; revision: number; blocked: boolean; id: string;
  } | null>(null);
  // A question belongs to the account, context and read that displayed it, including when the screen is retained on blur.
  useFocusEffect(useCallback(() => () => retireConfirmation(),
    [accountId, accountRevision, p.targetAccountId, p.needId, p.agreementId, retireConfirmation]));
  const renderedGeneration = questionGeneration.current;
  const currentChoice = () => questionGeneration.current === renderedGeneration && !!accountId &&
    sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision &&
    !!editor.data && editor.data.accountId === accountId && editor.data.targetAccountId === p.targetAccountId &&
    !editor.loading && !editor.busy && !editor.uncertain;
  const retainedCommand = () => {
    const command = blockCommand.current;
    return command && command.accountId === accountId && command.accountRevision === accountRevision &&
      command.targetAccountId === p.targetAccountId && command.revision === editor.data?.revision ? command : null;
  };
  const changeBlock = () => {
    if (!currentChoice()) return;
    const value = editor.data!;
    return editor.save(() => {
      const c = retainedCommand() ?? { accountId: accountId!, accountRevision, targetAccountId: p.targetAccountId,
        revision: value.revision, blocked: !value.blocked, id: noviUuidZahtevId() };
      blockCommand.current = c;
      return safetyClientService.setBlock({ targetAccountId: p.targetAccountId, blocked: c.blocked,
        expectedRevision: c.revision, clientRequestId: c.id });
    });
  };
  const askBlock = () => {
    if (!currentChoice()) return;
    // A reconciled retry keeps the already confirmed exact command; it is not a new block choice.
    if (editor.data!.blocked || retainedCommand()) { void changeBlock(); return; }
    confirmation.ask({ title: 'Blokirati korisnika?', message: blockConsequence, confirmLabel: 'Blokiraj korisnika',
      tone: 'danger', onConfirm: changeBlock });
  };
  // Match SupportFrame: resize the existing settings scroll surface above the keyboard without rebuilding the form.
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SettingsScreen title="Bezbednost" onBack={back}>
    {profileId && safetyTargetNameBuilt() ? <TargetName profileId={profileId} targetAccountId={p.targetAccountId} /> : null}
    <T variant="note" tone="muted">Privatna prijava i blokiranje imaju odvojene uloge. Odaberi ono što ti je potrebno.</T>
    <View style={s.section}>
      <T variant="bodyStrong" accessibilityRole="header">Kontakt sa korisnikom</T>
      <T variant="copy">{blockConsequence}</T>
      <T variant="note" tone="muted">Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.</T>
      {editor.loading ? <T>Proveravamo blokiranje…</T> : null}
      {editor.error ? <T tone="danger" accessibilityRole="alert">{editor.error}</T> : null}
      {editor.data ? <>
        <T accessibilityLiveRegion="polite">{editor.data.blocked ? 'Korisnik je blokiran.' : 'Korisnik nije blokiran.'}</T>
        <SettingsAction label={editor.busy ? 'Čuvam izbor…' : editor.data.blocked ? 'Odblokiraj korisnika' : 'Blokiraj korisnika'}
          kind={editor.data.blocked ? 'secondary' : 'destructive'} disabled={editor.loading || editor.busy || editor.uncertain}
          onPress={askBlock} />
      </> : null}
      {editor.error ? <SettingsAction label="Proveri blokiranje" kind="quiet" disabled={editor.busy || editor.loading} onPress={() => { void editor.refresh(); }} /> : null}
    </View>
    <PrivateReport {...p} />
    {/* This screen is where a person arrives when something has gone wrong with another person, and
        it had no way through to support at all — the only paths in were the profile row and a
        publication review. */}
    <View style={[s.section, s.separated]}>
      <T variant="bodyStrong" accessibilityRole="header">Treba ti operater?</T>
      <T variant="note" tone="muted">Privatnu prijavu prima podrška, i ona već otvara zahtev. Poseban zahtev otvori samo za drugo pitanje.</T>
      <SettingsAction label="Otvori zahtev podršci" kind="quiet"
        onPress={() => router.push('/podrska/novi')} />
    </View>
    {confirmation.sheet}
    </SettingsScreen>
  </KeyboardAvoidingView>;
}

/** The name of the person this screen is about, from the server's answer for the profile they came from; nothing at all while it is unknown (the generic copy below stays). */
function TargetName({ profileId, targetAccountId }: { profileId: string; targetAccountId: string }) {
  const name = useSafetyTargetName(profileId, targetAccountId);
  return name ? <T variant="heading" accessibilityRole="header" numberOfLines={2} testID="safety-target-name">{name}</T> : null;
}

function PrivateReport(context: Context) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '';
  // Only the opaque command ID is persisted. Report content never goes to local
  // storage, public projection, push, bilateral chat, analytics or console.
  const storageKey = `uskoci:safety-command:v1:${accountId}:${context.targetAccountId}:${context.needId ?? ''}:${context.agreementId ?? ''}`;
  const scope = useRef<{ busy: boolean; current: () => boolean } | null>(null);
  const key = useRef<string | null>(null), frozen = useRef<SafetyReportCommand | null>(null);
  const [category, setCategory] = useState<SafetyCategory | null>(null), [reason, setReason] = useState(''), [narrative, setNarrative] = useState('');
  const [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false), [receipt, setReceipt] = useState<SafetyReportReceipt | null>(null);
  const readReceipt = useCallback(async (current: () => boolean, requestId: string) => {
    const result = await safetyClientService.readReportCommand(requestId);
    if (!current()) return;
    if (result.ok && result.podatak.receipt) { setReceipt(result.podatak.receipt); setPending(false); setError(null); setReason(''); setNarrative(''); frozen.current = null; }
    else { setPending(true); setError(result.ok ? 'Potvrda još nije stigla. Možeš ponovo proveriti ili poslati isti zahtev.' : result.poruka); }
  }, []);
  useFocusEffect(useCallback(() => {
    const s = { busy: true, current: () => scope.current === s && !!accountId && sesijaSada().user?.id === accountId &&
      sesijaSada().accountRevision === accountRevision };
    scope.current = s; setBusy(true); setLoaded(false); setError(null); setReceipt(null); setPending(false); key.current = null; frozen.current = null;
    setCategory(null); setReason(''); setNarrative('');
    void (async () => {
      try { const stored = await AsyncStorage.getItem(storageKey); if (!s.current()) return;
        if (stored !== null && !uuid(stored)) { setError('Potvrda prethodne prijave nije čitljiva. Ponovo otvori ovaj ekran.'); return; }
        key.current = stored; if (stored) await readReceipt(s.current, stored); if (s.current()) setLoaded(true);
      } catch { if (s.current()) setError('Prethodna prijava nije proverena. Ponovo otvori ekran.'); }
      finally { if (s.current()) { s.busy = false; setBusy(false); } }
    })();
    return () => { if (scope.current === s) scope.current = null; frozen.current = null; setReason(''); setNarrative(''); setReceipt(null); };
  }, [accountId, accountRevision, storageKey, readReceipt]));
  const rendered = scope.current;
  const begin = () => { const s = scope.current; if (!s || s !== rendered || !s.current() || s.busy) return null;
    s.busy = true; setBusy(true); setError(null); return s; };
  const finish = (s: NonNullable<typeof rendered>) => { if (s.current()) { s.busy = false; setBusy(false); } };
  async function send() {
    if (!loaded || receipt || (!frozen.current && (!category || !reason.trim()))) return;
    const s = begin(); if (!s) return;
    try {
      const id = key.current ?? noviUuidZahtevId();
      await AsyncStorage.setItem(storageKey, id); if (!s.current()) return;
      key.current = id;
      const command = frozen.current ?? { ...context, category: category!, reason: reason.trim(), narrative: narrative.trim(), clientRequestId: id };
      frozen.current = command; setPending(true);
      const result = await safetyClientService.report(command); if (!s.current()) return;
      if (result.ok) { setReceipt(result.podatak); setPending(false); setReason(''); setNarrative(''); frozen.current = null; }
      else setError(result.poruka);
    } catch { if (s.current()) setError('Prijava nije potvrđena. Proveri potvrdu pre novog pokušaja.'); }
    finally { finish(s); }
  }
  async function check() { const s = begin(); if (!s) return;
    try { if (key.current) await readReceipt(s.current, key.current); }
    finally { finish(s); }
  }
  async function newReport() { if (!receipt) return; const s = begin(); if (!s) return;
    try { await AsyncStorage.removeItem(storageKey); if (!s.current()) return;
      key.current = null; frozen.current = null; setCategory(null); setReason(''); setNarrative(''); setReceipt(null); setPending(false);
    } catch { if (s.current()) setError('Novi obrazac trenutno nije dostupan. Pokušaj ponovo.'); }
    finally { finish(s); }
  }
  const editable = loaded && !busy && !frozen.current && !receipt;
  return <View style={[s.section, s.separated]}><T variant="bodyStrong" accessibilityRole="header">Privatna prijava</T>
    <T variant="note" tone="muted">Prijavu prima podrška. Drugi korisnik ne vidi kategoriju, razlog ni opis. Ovo je odvojeno od problema u Dogovoru.</T>
    {receipt ? <View style={{ gap: 12 }}><T accessibilityLiveRegion="polite">Prijava je primljena.</T>
      <T variant="meta" tone="muted">{vreme(receipt.createdAt)}</T>
      <SettingsAction label="Nova privatna prijava" kind="quiet" disabled={busy} onPress={() => { void newReport(); }} /></View> : <>
      <View accessibilityRole="radiogroup">{SAFETY_CATEGORIES.map((value, index) => <Press key={value} accessibilityRole="radio"
        accessibilityLabel={safetyCategoryCopy[value]} accessibilityState={{ selected: category === value, checked: category === value, disabled: !editable }}
        disabled={!editable} onPress={() => { if (scope.current === rendered && rendered?.current()) setCategory(value); }}
        style={[radioStyles.row, index === SAFETY_CATEGORIES.length - 1 && radioStyles.last]}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[radioStyles.marker, { borderColor: category === value ? sys.color.green : sys.color.lineStrong }]}>
          {category === value ? <View testID="safety-category-selected" style={radioStyles.dot} /> : null}
        </View>
        <T style={radioStyles.label}>{safetyCategoryCopy[value]}</T>
      </Press>)}</View>
      <View style={s.field}>
        <T variant="note" tone="muted">Kratak razlog</T><TextInput accessibilityLabel="Kratak razlog privatne prijave" value={reason} maxLength={200}
          onChangeText={value => { if (editable && scope.current === rendered && rendered?.current()) setReason(value); }} editable={editable} style={input} />
      </View>
      <View style={s.field}>
        <T variant="note" tone="muted">Dodatni opis, ako želiš</T><TextInput accessibilityLabel="Dodatni privatni opis" value={narrative} maxLength={2000}
          onChangeText={value => { if (editable && scope.current === rendered && rendered?.current()) setNarrative(value); }} editable={editable} multiline textAlignVertical="top" style={[input, { minHeight: 120 }]} />
      </View>
      <SettingsAction label={busy ? 'Proveravamo prijavu…' : pending ? 'Ponovi isti zahtev' : 'Pošalji privatnu prijavu'}
        disabled={!loaded || busy || (!frozen.current && (!category || !reason.trim()))} onPress={() => { void send(); }} />
      {/* A grey button carries its reason (owner's rule); a failed restore already speaks through `error` below. */}
      {loaded && !busy && !frozen.current && (!category || !reason.trim()) ? <T variant="meta" tone="muted">
        {!category && !reason.trim() ? 'Izaberi kategoriju i upiši kratak razlog da bi slanje bilo dostupno.'
          : !category ? 'Izaberi kategoriju da bi slanje bilo dostupno.' : 'Upiši kratak razlog da bi slanje bilo dostupno.'}</T> : null}
    </>}
    {error ? <T tone="danger" accessibilityRole="alert">{error}</T> : null}
    {pending ? <SettingsAction label="Proveri potvrdu prijave" kind="secondary" disabled={busy} onPress={() => { void check(); }} /> : null}
  </View>;
}
const input = withInter({ borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.control, padding: 14, minHeight: 52, color: sys.color.ink, fontSize: sys.type.body.fontSize });

const s = StyleSheet.create({
  screen: { flex: 1 },
  section: { gap: sys.space.md },
  separated: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: sys.space.md },
  field: { gap: sys.space.sm },
});
const radioStyles = StyleSheet.create({
  row: { minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  last: { borderBottomWidth: 0 },
  marker: { width: 22, height: 22, flexShrink: 0, borderWidth: 2, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  label: { flex: 1, minWidth: 0 },
});
