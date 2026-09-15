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
} from '../../data/manualNeedFactClientService';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';
import { v2 } from '../../ui/v2/tokens';

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
    setFields(previous => {
      const next: FieldStates = { ...previous };
      for (const key of MANUAL_FIELDS) {
        if (next[key] !== undefined || pending.current.has(key)) continue;
        const fact = currentFact(conversation, key);
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
    return <SafeAreaView style={s.canvas}><View style={s.empty}>
      <T accessibilityRole="header" style={s.title}>{editor.loading ? 'Učitavamo ručni unos' : 'Ručni unos nije dostupan'}</T>
      <T accessibilityRole={editor.error ? 'alert' : undefined} style={s.body}>{editor.error ?? 'Otvorite Novi zadatak ponovo.'}</T>
      {conversationId ? <V2Action label="Osveži" onPress={refresh} /> : null}
      <V2Action label="Nazad" kind="quiet" onPress={back} />
    </View></SafeAreaView>;
  }

  return <SafeAreaView style={s.canvas}>
    <View style={s.header}>
      <V2Action kind="quiet" label="Nazad" onPress={back} />
      <View style={{ flex: 1 }}><T accessibilityRole="header" style={s.title}>Ručni unos zadatka</T>
        <T style={s.meta}>Isti V2 nacrt i isti završni pregled kao AI put — bez slanja AI provajderu.</T></View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {editor.error ? <View style={s.notice}><T accessibilityRole="alert" style={s.error}>{editor.error}</T>
        <V2Action kind="quiet" label="Proveri ishod" disabled={editor.loading || editor.busy} onPress={refresh} /></View> : null}

      {MANUAL_FIELDS.map(key => {
        const definition = NEED_FACT_V2_DEFINITIONS[key];
        const state = fields[key] ?? { value: '', error: null };
        const existing = currentFact(conversation, key);
        const isPending = pending.current.has(key);
        const required = definition.requiredForDraft || (key === 'need.price_rsd' && currentFact(conversation, 'need.price_mode')?.value === 'MY_PRICE')
          || ((key === 'need.starts_at' || key === 'need.ends_at') && currentFact(conversation, 'need.schedule_kind')?.value === 'FIXED_WINDOW');
        return <View key={key} style={s.field}>
          <View style={s.row}><T style={[s.label, { flex: 1 }]}>{factLabel(key)}{required ? ' *' : ''}</T>
            {existing ? <T style={s.saved}>SAČUVANO</T> : missingSet.has(key) ? <T style={s.missing}>NEDOSTAJE</T> : null}</View>
          <TextInput
            accessibilityLabel={`Ručni unos: ${factLabel(key)}`}
            value={state.value}
            editable={canAct() && !isPending}
            multiline={key === 'need.description' || key.endsWith('skills') || key.endsWith('tools') || key.endsWith('vehicles')
              || key.endsWith('licenses') || key === 'need.critical_conditions'}
            onChangeText={value => setField(key, value)}
            placeholder={key === 'need.price_mode' ? 'moja cena ili ponude'
              : key === 'need.schedule_kind' ? 'tačan termin, fleksibilno, danas, sutra...'
                : key === 'need.starts_at' || key === 'need.ends_at' ? 'GGGG-MM-DD HH:MM'
                  : key.includes('required_') || key === 'need.critical_conditions' ? 'Odvojite stavke zarezom' : undefined}
            style={[s.input, (key === 'need.description' ? { minHeight: 96 } : null)]}
          />
          {state.error ? <T accessibilityRole="alert" style={s.error}>{state.error}</T> : null}
          {isPending ? <T style={s.meta}>Ishod prethodnog čuvanja nije povučen iz memorije. Isti zahtev će se ponoviti sa istim ID-em.</T> : null}
          <V2Action label={existing ? 'Sačuvaj izmenu' : 'Sačuvaj podatak'} disabled={!canAct()} onPress={() => { void save(key); }} />
        </View>;
      })}

      <View style={s.field}>
        <View style={s.row}><T style={[s.label, { flex: 1 }]}>Mesto / način rada *</T>
          {locationMissing ? <T style={s.missing}>NEDOSTAJE</T> : <T style={s.saved}>SAČUVANO</T>}</View>
        <T style={s.body}>Država, tip lokacije i potvrđene tačke ostaju u postojećem bezbednom editoru lokacije.</T>
        <V2Action label={locationMissing ? 'Dodaj lokaciju' : 'Izmeni lokaciju'} disabled={!canAct()} onPress={openLocation} />
      </View>

      <View style={s.field}>
        <T style={s.label}>Fotografije</T>
        <T style={s.body}>Opcionalne fotografije ostaju u postojećem privatnom/media toku; ručni unos ne pravi drugi storage put.</T>
        <V2Action label="Fotografije zadatka" kind="quiet" disabled={!canAct()} onPress={openPhotos} />
      </View>

      <View style={s.notice}>
        <T style={s.body}>{readyForReview
          ? 'Obavezni podaci su u istom canonical V2 nacrtu. Sledeći korak je zajednički pregled pre eksplicitne objave.'
          : requiredScalarMissing.length || locationMissing
            ? `Još nedostaje: ${missing.map(factLabel).join(', ')}.`
            : 'Proverite nedostajuće uslove pre završnog pregleda.'}</T>
        <V2Action label="Pregledaj zadatak" disabled={!canAct() || !readyForReview} onPress={review} />
        <V2Action label="Osveži podatke" kind="quiet" disabled={editor.loading || editor.busy} onPress={refresh} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: v2.color.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: v2.space.sm, paddingHorizontal: v2.space.md,
    paddingVertical: v2.space.sm, backgroundColor: v2.color.header },
  content: { padding: v2.space.lg, gap: v2.space.lg, paddingBottom: 48 },
  empty: { flex: 1, justifyContent: 'center', padding: v2.space.xl, gap: v2.space.md },
  title: { ...v2.text.title, color: v2.color.ink },
  body: { ...v2.text.body, color: v2.color.ink },
  meta: { ...v2.text.label, color: v2.color.muted },
  label: { ...v2.text.label, color: v2.color.ink },
  field: { gap: v2.space.sm, padding: v2.space.md, backgroundColor: v2.color.surface, borderRadius: v2.radius.card,
    borderWidth: 1, borderColor: v2.color.line },
  notice: { gap: v2.space.sm, padding: v2.space.md, backgroundColor: v2.color.context, borderRadius: v2.radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: v2.space.sm },
  input: { ...v2.text.body, color: v2.color.ink, minHeight: 48, borderWidth: 1, borderColor: v2.color.controlLine,
    borderRadius: v2.radius.input, paddingHorizontal: v2.space.md, paddingVertical: v2.space.sm, textAlignVertical: 'top' },
  error: { ...v2.text.label, color: '#A4362B' },
  missing: { ...v2.text.label, color: '#A4362B' },
  saved: { ...v2.text.label, color: v2.color.teal },
});
