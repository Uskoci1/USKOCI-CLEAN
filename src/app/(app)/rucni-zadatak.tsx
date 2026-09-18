import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  REQUIRED_NEED_FACT_V2_KEYS,
  type NeedFactV2Key,
} from '../../contracts/needFactsV2';
import { aiNeedV2Izvor } from '../../data';
import { factCorrectionValue, factLabel } from '../../data/aiNeedV2Ui';
import {
  canBootstrapManualNeedFact,
  manualNeedFactClientService,
  manualNeedFactFromText,
  manualNeedFactMatchesReadback,
} from '../../data/manualNeedFactClientService';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import { Press } from '../../ui/Press';
import { brandAction, sys } from '../../ui/system/tokens';
import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';
import { V2Icon } from '../../ui/v2/icons';

const MANUAL_FIELDS: readonly NeedFactV2Key[] = [
  'need.title',
  'need.description',
  'need.category',
  'need.people_needed',
  'need.price_mode',
  'need.price_rsd',
  'need.schedule_kind',
  'need.starts_at',
  'need.ends_at',
  'need.required_skills',
  'need.required_tools',
  'need.required_vehicles',
  'need.required_licenses',
  'need.minimum_experience_years',
  'need.critical_conditions',
];
/** Presentation grouping only (PKG-011): every field keeps its own per-fact save through the same manual writer. */
const SECTIONS: readonly { title: string; hint: string; keys: readonly NeedFactV2Key[] }[] = [
  { title: 'Šta treba uraditi', hint: 'Naslov, opis i vrsta posla koje će videti Uskočeri.', keys: ['need.title', 'need.description', 'need.category'] },
  { title: 'Ljudi i cena', hint: 'Koliko ljudi tražite i da li navodite cenu ili tražite ponude.', keys: ['need.people_needed', 'need.price_mode', 'need.price_rsd'] },
  { title: 'Termin', hint: 'Kada treba da se uradi. Tačan početak i kraj samo za tačan termin.', keys: ['need.schedule_kind', 'need.starts_at', 'need.ends_at'] },
  { title: 'Uslovi', hint: 'Opciono: veštine, oprema, vozila, dozvole, iskustvo i bitni uslovi.', keys: ['need.required_skills', 'need.required_tools', 'need.required_vehicles', 'need.required_licenses', 'need.minimum_experience_years', 'need.critical_conditions'] },
];

type PendingManual = Readonly<{ id: string; value: unknown; displayValue: string }>;
type FieldState = Readonly<{ value: string; error: string | null }>;
type FieldStates = Partial<Record<NeedFactV2Key, FieldState>>;

const changed = (): Ishod<never> => ({ ok: false, kod: 'MANUAL_TASK_CHANGED', poruka: 'Ponovo otvorite ručni unos za trenutni nalog.' });
const valueFingerprint = (value: unknown, displayValue: string) => JSON.stringify([value, displayValue]);

function currentFact(conversation: AiNeedV2Conversation, key: NeedFactV2Key): AiNeedV2Fact | undefined {
  return conversation.facts.find(fact => fact.key === key);
}

export default function ManualTaskRoute() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  const conversationId = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  return <OwnedManualTask key={`${user?.id ?? ''}:${accountRevision}:${intent}:${conversationId ?? ''}`} conversationId={conversationId} />;
}

function OwnedManualTask({ conversationId }: { conversationId: string | null }) {
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  const accountId = user?.id;
  const focus = useRef<object | null>(null);
  const navigating = useRef(false);
  const pending = useRef(new Map<NeedFactV2Key, PendingManual>());
  const [fields, setFields] = useState<FieldStates>({});

  useFocusEffect(useCallback(() => {
    const scope = {};
    focus.current = scope;
    navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision, intent, conversationId]));

  const read = useCallback(async (): Promise<Ishod<AiNeedV2Conversation>> => {
    const scope = focus.current;
    const isCurrent = () => scope !== null && focus.current === scope && !!accountId
      && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision
      && ulogaSada() === intent;
    if (!conversationId || !isCurrent()) return changed();
    const conversation = await aiNeedV2Izvor.loadConversation(conversationId);
    if (!isCurrent() || !conversation || conversation.conversationId !== conversationId) return changed();
    if (conversation.status !== 'OPEN') return { ok: false, kod: 'MANUAL_TASK_CLOSED', poruka: 'Ovaj unos više nije otvoren.' };
    return { ok: true, podatak: conversation };
  }, [accountId, accountRevision, conversationId, intent]);

  const editor = useOwnedEditor(read);
  const conversation = editor.data;
  const view = useMemo(() => ({}), [conversation, fields]);
  const currentView = useRef(view);
  currentView.current = view;
  const renderedFocus = focus.current;
  const isCurrent = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => isCurrent() && !!conversation && conversation.status === 'OPEN'
    && conversation.safety !== 'BLOCK' && !editor.loading && !editor.busy && !editor.uncertain && !navigating.current;
  const navigate = (action: () => void) => { if (!isCurrent() || navigating.current) return; navigating.current = true; action(); };

  useEffect(() => {
    if (!conversation) return;
    // A transport timeout does not retire a command. Only exact canonical
    // readback of the same human-confirmed value can clear the retained ID.
    const reconciled = new Set<NeedFactV2Key>();
    for (const [key, command] of pending.current) {
      const fact = currentFact(conversation, key);
      if (manualNeedFactMatchesReadback(fact, key, command.value, command.displayValue)) {
        pending.current.delete(key);
        reconciled.add(key);
      }
    }
    setFields(previous => {
      const next: FieldStates = { ...previous };
      for (const key of MANUAL_FIELDS) {
        const fact = currentFact(conversation, key);
        if (reconciled.has(key) && fact) {
          next[key] = { value: factCorrectionValue(fact), error: null };
          continue;
        }
        if (next[key] !== undefined || pending.current.has(key)) continue;
        next[key] = { value: fact ? factCorrectionValue(fact) : '', error: null };
      }
      return next;
    });
  }, [conversation]);

  const missing = conversation?.review.missingRequired ?? REQUIRED_NEED_FACT_V2_KEYS;
  const missingSet = new Set(missing);
  const locationMissing = missingSet.has('need.task_country_code') || missingSet.has('need.task_geography');
  const requiredScalarMissing = missing.filter(key => canBootstrapManualNeedFact(key));
  const readyForReview = !!conversation && missing.length === 0 && conversation.safety !== 'BLOCK';

  const setField = (key: NeedFactV2Key, value: string) => {
    if (!canAct() || pending.current.has(key)) return;
    setFields(previous => ({ ...previous, [key]: { value, error: null } }));
  };

  const save = async (key: NeedFactV2Key) => {
    if (!canAct() || !conversationId || !conversation || !canBootstrapManualNeedFact(key)) return;
    const text = fields[key]?.value ?? '';
    const parsed = manualNeedFactFromText(key, text);
    if (!parsed.ok) {
      setFields(previous => ({ ...previous, [key]: { value: text, error: parsed.message } }));
      return;
    }

    const old = pending.current.get(key);
    if (old && valueFingerprint(old.value, old.displayValue) !== valueFingerprint(parsed.value, parsed.displayValue)) {
      setFields(previous => ({ ...previous, [key]: {
        value: text,
        error: 'Prethodno čuvanje nema potvrđen ishod. Vratite prethodnu vrednost i ponovite isto čuvanje ili osvežite prikaz.',
      } }));
      return;
    }
    const command = old ?? { id: noviUuidZahtevId(), value: parsed.value, displayValue: parsed.displayValue };
    pending.current.set(key, command);

    await editor.save(async () => {
      const result = await manualNeedFactClientService.save({
        conversationId,
        clientRequestId: command.id,
        key,
        value: command.value,
        displayValue: command.displayValue,
      });
      if (!isCurrent()) return changed();
      if (!result.ok) return result;
      pending.current.delete(key);
      setFields(previous => ({ ...previous, [key]: { value: text, error: null } }));
      return read();
    });
  };

  const refresh = () => {
    if (!isCurrent() || editor.loading || editor.busy || navigating.current) return;
    void editor.refresh();
  };
  const back = () => navigate(() => conversationId
    ? router.replace({ pathname: '/nova', params: { conversationId } })
    : router.replace('/nova'));
  const openLocation = () => {
    if (!canAct() || !conversationId) return;
    navigate(() => router.push({ pathname: '/mesto-zadatka', params: { conversationId } }));
  };
  const openPhotos = () => {
    if (!canAct() || !conversationId) return;
    navigate(() => router.push({ pathname: '/fotografije-zadatka', params: { conversationId } }));
  };
  const review = () => {
    if (!canAct() || !conversationId || !readyForReview) return;
    navigate(() => router.replace({ pathname: '/pregled-zadatka', params: { conversationId } }));
  };

  if (!conversation) {
    return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}><View style={s.empty}>
      <View style={s.card}>
        <T accessibilityRole="header" variant="title" style={s.ink}>{editor.loading ? 'Učitavamo ručni unos' : 'Ručni unos nije dostupan'}</T>
        <T accessibilityRole={editor.error ? 'alert' : undefined} variant="body" tone="muted">{editor.error ?? 'Otvorite Novi zadatak ponovo.'}</T>
        {conversationId ? <V2Action label="Osveži" onPress={refresh} style={brandAction} /> : null}
        <V2Action label="Nazad" kind="quiet" onPress={back} />
      </View>
    </View></SafeAreaView>;
  }

  const requiredOf = (key: NeedFactV2Key) => NEED_FACT_V2_DEFINITIONS[key].requiredForDraft
    || (key === 'need.price_rsd' && currentFact(conversation, 'need.price_mode')?.value === 'MY_PRICE')
    || ((key === 'need.starts_at' || key === 'need.ends_at') && currentFact(conversation, 'need.schedule_kind')?.value === 'FIXED_WINDOW');
  const savedCount = MANUAL_FIELDS.filter(key => !!currentFact(conversation, key)).length;

  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <View style={s.topBar}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" haptic="select" onPress={back} style={s.back}><V2Icon name="back" /></Press>
      <View style={s.topCopy}>
        <T variant="meta" style={s.eyebrow}>Meni treba · ručni unos</T>
        <T accessibilityRole="header" variant="title" style={s.ink}>Ručni unos zadatka</T>
      </View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <T variant="meta" tone="muted">Isti V2 nacrt i isti završni pregled kao AI put — bez slanja AI provajderu. Svaki podatak čuvaš zasebno.</T>
      {editor.error ? <View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{editor.error}</T>
        <V2Action kind="quiet" label="Proveri ishod" disabled={editor.loading || editor.busy} onPress={refresh} style={s.quietLeft} /></View> : null}

      {SECTIONS.map(section => <View key={section.title} style={s.card}>
        <T variant="heading" style={s.ink}>{section.title}</T>
        <T variant="meta" tone="muted">{section.hint}</T>
        {section.keys.map(key => {
          const state = fields[key] ?? { value: '', error: null };
          const existing = currentFact(conversation, key);
          const isPending = pending.current.has(key);
          const required = requiredOf(key);
          const multiline = key === 'need.description' || key.endsWith('skills') || key.endsWith('tools') || key.endsWith('vehicles')
            || key.endsWith('licenses') || key === 'need.critical_conditions';
          return <View key={key} style={s.field}>
            <View style={s.row}><T variant="bodyStrong" style={[s.ink, s.grow]}>{factLabel(key)}{required ? ' *' : ''}</T>
              {existing ? <View style={[s.chip, s.chipSaved]}><T variant="label" style={s.chipSavedText}>Sačuvano</T></View>
                : missingSet.has(key) ? <View style={[s.chip, s.chipMissing]}><T variant="label" style={s.chipMissingText}>Nedostaje</T></View> : null}</View>
            <TextInput
              accessibilityLabel={`Ručni unos: ${factLabel(key)}`}
              value={state.value}
              editable={canAct() && !isPending}
              multiline={multiline}
              onChangeText={value => setField(key, value)}
              placeholder={key === 'need.price_mode' ? 'moja cena ili ponude'
                : key === 'need.schedule_kind' ? 'tačan termin, fleksibilno, danas, sutra...'
                  : key === 'need.starts_at' || key === 'need.ends_at' ? 'GGGG-MM-DD HH:MM'
                    : key.includes('required_') || key === 'need.critical_conditions' ? 'Odvojite stavke zarezom' : undefined}
              placeholderTextColor={sys.color.muted}
              style={[s.input, multiline && s.multiline, key === 'need.description' && { minHeight: 96 }, state.error && s.inputError]}
            />
            {state.error ? <T accessibilityRole="alert" variant="meta" style={s.error}>{state.error}</T> : null}
            {isPending ? <T variant="meta" tone="muted">Ishod prethodnog čuvanja nije potvrđen. Osvežite stanje; isti zahtev se ponavlja samo sa istim ID-em.</T> : null}
            <V2Action label={existing ? 'Sačuvaj izmenu' : 'Sačuvaj podatak'} kind={existing ? 'quiet' : 'secondary'} disabled={!canAct()} onPress={() => { void save(key); }} style={s.quietLeft} />
          </View>;
        })}
      </View>)}

      <View style={s.card}>
        <View style={s.row}><T variant="heading" style={[s.ink, s.grow]}>Mesto / način rada *</T>
          {locationMissing ? <View style={[s.chip, s.chipMissing]}><T variant="label" style={s.chipMissingText}>Nedostaje</T></View>
            : <View style={[s.chip, s.chipSaved]}><T variant="label" style={s.chipSavedText}>Sačuvano</T></View>}</View>
        <T variant="meta" tone="muted">Država, tip lokacije i potvrđene tačke ostaju u postojećem bezbednom editoru lokacije.</T>
        <V2Action label={locationMissing ? 'Dodaj lokaciju' : 'Izmeni lokaciju'} disabled={!canAct()} onPress={openLocation} />
      </View>

      <View style={s.card}>
        <T variant="heading" style={s.ink}>Fotografije</T>
        <T variant="meta" tone="muted">Opcionalne fotografije ostaju u postojećem privatnom/media toku; ručni unos ne pravi drugi storage put.</T>
        <V2Action label="Fotografije zadatka" kind="quiet" disabled={!canAct()} onPress={openPhotos} style={s.quietLeft} />
      </View>

      <View style={[s.card, readyForReview ? s.readyCard : null]}>
        <T variant="meta" tone="muted">{`Sačuvano ${savedCount} od ${MANUAL_FIELDS.length} podataka`}</T>
        <T variant="body" style={s.ink}>{readyForReview
          ? 'Obavezni podaci su u istom canonical V2 nacrtu. Sledeći korak je zajednički pregled pre eksplicitne objave.'
          : requiredScalarMissing.length || locationMissing
            ? `Još nedostaje: ${missing.map(factLabel).join(', ')}.`
            : 'Proverite nedostajuće uslove pre završnog pregleda.'}</T>
        <V2Action label="Pregledaj zadatak" disabled={!canAct() || !readyForReview} onPress={review} style={brandAction} />
        <V2Action label="Osveži podatke" kind="quiet" disabled={editor.loading || editor.busy} onPress={refresh} style={s.quietLeft} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  topCopy: { flex: 1, minWidth: 0, gap: 1 }, eyebrow: { color: sys.color.green, fontWeight: '600' },
  ink: { color: sys.color.ink }, grow: { flex: 1, minWidth: 0 },
  content: { padding: 20, paddingTop: 4, gap: 14, paddingBottom: 48 },
  empty: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { gap: 10, padding: 18, backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line },
  readyCard: { borderColor: sys.color.green },
  notice: { gap: 8, padding: 14, backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.control },
  field: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderColor: sys.color.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { borderRadius: sys.radius.badge, paddingHorizontal: 8, paddingVertical: 4 },
  chipSaved: { backgroundColor: sys.color.greenSoft }, chipSavedText: { color: sys.color.green, letterSpacing: 0.2 },
  chipMissing: { backgroundColor: sys.color.warnSoft }, chipMissingText: { color: sys.color.warn, letterSpacing: 0.2 },
  input: { ...sys.type.body, color: sys.color.ink, minHeight: 48, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface,
    borderRadius: sys.radius.control, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 72, textAlignVertical: 'top' }, inputError: { borderColor: sys.color.danger },
  error: { color: sys.color.danger },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
