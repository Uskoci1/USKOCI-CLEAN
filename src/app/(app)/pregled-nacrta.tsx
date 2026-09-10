import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  CheckCircle,
  LockKey,
  PencilSimple,
  ShieldCheck,
  Warning,
} from 'phosphor-react-native';

import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { aiNeedV2Izvor, izvor } from '../../data';
import type { Ishod } from '../../data/ports';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import {
  canEditFactInline,
  correctionFromText,
  factLabel,
  safetyMessage,
  sortFacts,
} from '../../data/aiNeedV2Ui';
import { palette, radius, space, touch } from '../../theme/tokens';
import { Button, Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';
import { v2 } from '../../ui/v2/tokens';
import { V2Action } from '../../ui/v2/V2Action';
import { V2Icon } from '../../ui/v2/icons';

type EditState = {
  fact: AiNeedV2Fact;
  text: string;
  error: string | null;
};
type ReviewSnapshot = { conversation: AiNeedV2Conversation; need: PotrebaProjekcija | null };

export default function PregledNacrtaR07() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  const accountId = user?.id;
  const routeIdentity = useMemo(() => ({}), [conversationId, accountId, accountRevision, intent]);
  const currentRoute = useRef(routeIdentity);
  currentRoute.current = routeIdentity;
  const focused = useRef(false);
  const focusScope = useRef<object | null>(null);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; focusScope.current = {}; navigating.current = false;
    return () => { focused.current = false; focusScope.current = null; };
  }, [routeIdentity]));
  const read = useCallback(async (): Promise<Ishod<ReviewSnapshot>> => {
    if (!conversationId) return { ok: false, kod: 'REVIEW_REQUIRED', poruka: 'Nacrt nije izabran.' };
    const readScope = focusScope.current;
    const current = () => focused.current && focusScope.current === readScope && currentRoute.current === routeIdentity &&
      sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    try {
      const conversation = await aiNeedV2Izvor.loadConversation(conversationId);
      if (!current()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      if (!conversation || conversation.conversationId !== conversationId) {
        return { ok: false, kod: 'REVIEW_UNAVAILABLE', poruka: 'Nacrt nije dostupan ovom nalogu.' };
      }
      const need = conversation.review.boundNeedId ? await izvor.potreba(conversation.review.boundNeedId) : null;
      if (!current()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      if (conversation.review.boundNeedId && (!need || need.id !== conversation.review.boundNeedId)) {
        return { ok: false, kod: 'BOUND_NEED_UNAVAILABLE', poruka: 'Zadatak trenutno nije dostupan. Učitajte pregled ponovo.' };
      }
      return { ok: true, podatak: { conversation, need } };
    } catch {
      return { ok: false, kod: 'REVIEW_READ_FAILED', poruka: 'Pregled trenutno nije moguće učitati. Proverite vezu i pokušajte ponovo.' };
    }
  }, [conversationId, routeIdentity, accountId, accountRevision, intent]);
  const editor = useOwnedEditor(read);
  const stanje = editor.data?.conversation ?? null;
  const vezanZadatak = editor.data?.need ?? null;
  const loading = editor.loading;
  const saving = editor.busy;
  const greska = editor.error;
  const [edit, setEdit] = useState<EditState | null>(null);
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);
  useEffect(() => { setEdit(null); setExpandedFactId(null); }, [editor.data]);

  // Navigation and local edit callbacks belong to the same visible, focused review.
  const viewIdentity = useMemo(() => ({}), [editor.data, conversationId, accountId, accountRevision, intent]);
  const currentView = useRef(viewIdentity);
  currentView.current = viewIdentity;
  const renderedFocus = focusScope.current;
  const isCurrent = () => focused.current && renderedFocus !== null && focusScope.current === renderedFocus && currentView.current === viewIdentity &&
    !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => isCurrent() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain
    && editor.data?.conversation.status === 'OPEN';
  const navigate = (action: () => void) => {
    if (!isCurrent() || navigating.current) return;
    navigating.current = true; action();
  };
  const requestId = useMemo(() => `ru2-r07-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [conversationId, accountId, accountRevision]);
  const editRequestId = useMemo(() => `ru4-edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [conversationId, accountId, accountRevision]);

  const facts = useMemo(() => sortFacts(stanje?.facts ?? []), [stanje?.facts]);
  const confirmed = facts.filter(fact => fact.status === 'CONFIRMED').length;
  const pendingFacts = facts.length - confirmed;
  const safetyCopy = stanje ? safetyMessage(stanje.safety) : null;
  const boundNeedId = stanje?.review.boundNeedId ?? null;
  const editMode = Boolean(boundNeedId && vezanZadatak && stanje?.status === 'OPEN');
  const alreadySaved = editMode ? null : boundNeedId;
  const saveAllowed = Boolean(stanje?.status === 'OPEN' && stanje.review.canSaveDraft && stanje.safety !== 'BLOCK'
    && pendingFacts === 0 && !alreadySaved);
  const blocked = saving || editor.uncertain || loading || stanje?.status !== 'OPEN';

  const potvrdi = async (fact: AiNeedV2Fact) => {
    if (!canAct() || !stanje?.facts.includes(fact)) return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.confirmFact(fact.id);
      if (!result.ok) return result;
      if (!isCurrent()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      return read();
    });
  };
  const sacuvajIspravku = async () => {
    if (!canAct() || !edit || !stanje?.facts.includes(edit.fact)) return;
    const parsed = correctionFromText(edit.fact, edit.text);
    if (!parsed.ok) { setEdit({ ...edit, error: parsed.message }); return; }
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.correctFact(edit.fact.id, parsed.value, parsed.displayValue);
      if (!result.ok) return result;
      if (!isCurrent()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      return read();
    });
  };
  const sacuvajNacrt = async () => {
    if (!canAct() || !conversationId || !saveAllowed || editMode || edit) return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.saveDraft(conversationId, requestId);
      if (!result.ok) return result;
      if (isCurrent() && !navigating.current) {
        navigating.current = true;
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: result.podatak.needId } });
      }
      return { ok: true, podatak: editor.data! };
    });
  };
  const sacuvajIzmene = async () => {
    if (!canAct() || !conversationId || !boundNeedId || !vezanZadatak || !editMode || !saveAllowed || edit) return;
    // Send the revision loaded with this visible review. Never adopt a newer
    // revision at confirmation time; the server must reject a stale review.
    const reviewedRevision = vezanZadatak.revizija;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.confirmEdit(boundNeedId, reviewedRevision, conversationId, editRequestId);
      if (!result.ok) return result;
      if (isCurrent() && !navigating.current) {
        navigating.current = true;
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: result.podatak.needId } });
      }
      return { ok: true, podatak: editor.data! };
    });
  };
  const vratiSeURazgovor = () => navigate(() => {
    if (!conversationId) router.back();
    else router.replace({ pathname: '/nova', params: { conversationId } });
  });

  const title = facts.find(fact => fact.key === 'need.title')?.displayValue;
  const description = facts.find(fact => fact.key === 'need.description')?.displayValue;
  const textStyle = { ...v2.text.body, color: v2.color.ink };
  const metaStyle = { ...v2.text.label, color: v2.color.muted };
  const openLocation = () => { if (canAct() && conversationId) navigate(() => router.push({ pathname: '/mesto-zadatka', params: { conversationId } })); };
  const retry = () => { if (isCurrent() && !saving && !navigating.current) void editor.refresh(); };

  if (loading || !stanje) return <SafeAreaView style={{ flex: 1, backgroundColor: v2.color.canvas, justifyContent: 'center', padding: v2.space.xl }}>
    <View style={{ gap: v2.space.lg }}>
      {loading ? <ActivityIndicator accessibilityLabel="Učitavamo pregled" color={v2.color.teal} /> : <>
        <T accessibilityRole="alert" style={textStyle}>{greska ?? 'Nacrt nije dostupan.'}</T>
        <V2Action label="Učitajte pregled ponovo" onPress={retry} />
      </>}
      <V2Action label="Nazad" kind="quiet" onPress={() => navigate(() => router.back())} />
    </View>
  </SafeAreaView>;

  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: v2.color.canvas }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: v2.space.sm, paddingHorizontal: v2.space.md, paddingVertical: v2.space.sm }}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad u razgovor" onPress={vratiSeURazgovor} haptic="select"
          style={{ width: v2.target.minimum, height: v2.target.minimum, alignItems: 'center', justifyContent: 'center' }}>
          <V2Icon name="back" />
        </Press>
        <View style={{ flex: 1 }}>
          <T style={metaStyle}>{editMode ? 'Pregled izmena' : alreadySaved ? 'Sačuvani nacrt' : 'Još ništa nije objavljeno'}</T>
          <T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>Proverite Zadatak</T>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: v2.space.lg, gap: v2.space.xl, paddingBottom: v2.space.xl }}>
        <View style={{ gap: v2.space.md }}>
          <T style={{ ...metaStyle, color: v2.color.teal }}>{alreadySaved ? 'Nacrt je već sačuvan' : editMode ? 'Izmene čekaju vašu potvrdu' : 'Privatan nacrt · pre objave'}</T>
          <T accessibilityRole="header" style={{ ...v2.text.hero, color: v2.color.ink }}>{title ?? 'Vaš novi zadatak'}</T>
          {description ? <T style={textStyle}>{description}</T> : null}
          <T style={metaStyle}>{confirmed} od {facts.length} podataka potvrđeno</T>
          <View style={{ height: 3, backgroundColor: v2.color.line, borderRadius: 2 }}>
            <View style={{ height: 3, width: `${facts.length ? confirmed / facts.length * 100 : 0}%`, backgroundColor: v2.color.teal, borderRadius: 2 }} />
          </View>
          {stanje.review.missingRequired.length ? <T style={metaStyle}>Još treba potvrditi ili dopuniti: {stanje.review.missingRequired.map(factLabel).join(' · ')}</T>
            : pendingFacts ? <T style={metaStyle}>Obavezni podaci su potvrđeni. Pregledajte i preostale predloge pre čuvanja.</T> : null}
        </View>

        {safetyCopy ? <View style={{ padding: v2.space.md, backgroundColor: v2.color.warm, borderRadius: v2.radius.input }}>
          <T accessibilityRole="alert" style={{ ...textStyle, color: stanje.safety === 'BLOCK' ? v2.color.danger : v2.color.ink }}>{safetyCopy}</T>
        </View> : null}

        {!alreadySaved && conversationId ? <V2Action label="Mesto Zadatka" disabled={blocked} onPress={openLocation} /> : null}
        {facts.length ? <View style={{ backgroundColor: v2.color.surface, borderColor: v2.color.line, borderWidth: 1, borderRadius: v2.radius.card, overflow: 'hidden' }}>
          {facts.map((fact, index) => {
            const label = factLabel(fact.key), confirmedFact = fact.status === 'CONFIRMED';
            const expanded = expandedFactId === fact.id, editing = edit?.fact.id === fact.id;
            const locationFact = ['need.task_geography', 'need.task_country_code', 'need.exact_address', 'need.access_notes', 'need.resolved_location'].includes(fact.key);
            return <View key={fact.id} style={{ borderTopWidth: index ? 1 : 0, borderColor: v2.color.line }}>
              <Press accessibilityRole="button" accessibilityLabel={`Pregledajte: ${label}`} accessibilityState={{ expanded }}
                onPress={() => { if (isCurrent() && !saving && !editor.uncertain && !navigating.current) { setExpandedFactId(expanded ? null : fact.id); setEdit(null); } }}
                style={{ minHeight: 76, padding: v2.space.lg, flexDirection: 'row', alignItems: 'center', gap: v2.space.md }}>
                <View style={{ flex: 1, gap: v2.space.xs }}>
                  <T style={metaStyle}>{label}{fact.privacyClass === 'PRIVATE' ? ' · privatno' : ''}</T>
                  <T style={textStyle} numberOfLines={expanded ? undefined : 2}>{fact.privacyClass === 'PRIVATE' && !expanded ? 'Prikažite privatni podatak' : fact.displayValue}</T>
                  <T style={{ ...metaStyle, color: confirmedFact ? v2.color.teal : v2.color.muted }}>{confirmedFact ? 'Potvrđeno' : 'Predlog · čeka vašu potvrdu'}</T>
                </View>
                <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} /></View>
              </Press>
              {expanded ? <View style={{ paddingHorizontal: v2.space.lg, paddingBottom: v2.space.lg, gap: v2.space.md }}>
                {fact.evidence ? <T style={metaStyle}>Iz razgovora: „{fact.evidence}“</T> : null}
                {editing ? <>
                  <T style={metaStyle}>Nova vrednost: {label}</T>
                  <TextInput accessibilityLabel={`Nova vrednost: ${label}`} value={edit.text}
                    onChangeText={value => { if (canAct()) setEdit({ ...edit, text: value, error: null }); }}
                    editable={!blocked} autoFocus multiline={fact.valueType === 'TEXT' || fact.valueType === 'TEXT_ARRAY'}
                    style={{ ...textStyle, minHeight: v2.target.minimum, padding: v2.space.md, borderWidth: 1,
                      borderColor: edit.error ? v2.color.danger : v2.color.teal, backgroundColor: v2.color.canvas, borderRadius: v2.radius.input }} />
                  {edit.error ? <T accessibilityRole="alert" style={{ ...metaStyle, color: v2.color.danger }}>{edit.error}</T> : null}
                  <View style={{ gap: v2.space.sm }}>
                    <V2Action label="Sačuvaj ispravku" kind="primary" disabled={blocked} onPress={sacuvajIspravku} />
                    <V2Action label="Odustani" kind="quiet" disabled={blocked} onPress={() => { if (canAct()) setEdit(null); }} />
                  </View>
                </> : <View style={{ gap: v2.space.sm }}>
                  {!confirmedFact && fact.key !== 'need.resolved_location' ? <V2Action label="Potvrdite" disabled={blocked}
                    onPress={() => void potvrdi(fact)} /> : null}
                  <V2Action label={locationFact ? 'Izmenite mesto' : canEditFactInline(fact) ? 'Izmenite' : 'Izmenite u razgovoru'} kind="quiet" disabled={blocked}
                    onPress={() => {
                      if (!canAct()) return;
                      if (locationFact) { openLocation(); return; }
                      if (!canEditFactInline(fact)) { vratiSeURazgovor(); return; }
                      setEdit({ fact, text: fact.displayValue, error: null });
                    }} />
                </View>}
              </View> : null}
            </View>;
          })}
        </View> : <View style={{ gap: v2.space.md }}>
          <T style={textStyle}>Još nema podataka za pregled</T>
          <T style={metaStyle}>Vratite se u razgovor i opišite šta Vam treba.</T>
          <V2Action label="Nazad u razgovor" onPress={vratiSeURazgovor} />
        </View>}

        {editMode ? <T style={metaStyle}>Zadatak se vraća u nacrt i prolazi ponovnu proveru pre nego što ponovo bude vidljiv. Postojeće Prijave će morati da se osveže; Dogovori se ne menjaju.</T> : null}
        {!alreadySaved && !editMode && stanje.status !== 'OPEN' ? <T style={metaStyle}>Ovaj razgovor je zatvoren. Prikazane podatke možete pregledati.</T> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: v2.space.lg, paddingVertical: v2.space.md, gap: v2.space.sm, backgroundColor: v2.color.canvas, borderTopWidth: 1, borderColor: v2.color.line }}>
        {greska ? <><T accessibilityRole="alert" style={{ ...metaStyle, color: v2.color.danger }}>{greska}</T>
          <V2Action label="Učitajte pregled ponovo" disabled={saving || loading} onPress={retry} /></> : null}
        {alreadySaved ? <V2Action label="Otvorite sačuvani Zadatak" kind="primary"
          onPress={() => navigate(() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: alreadySaved } }))} />
          : stanje.status === 'OPEN' ? <>
            <V2Action label={saving ? 'Čuvanje...' : editMode ? 'Sačuvajte izmene' : 'Sačuvajte nacrt'} kind="primary"
              disabled={!saveAllowed || blocked || !!edit} onPress={editMode ? sacuvajIzmene : sacuvajNacrt} />
            <T style={{ ...metaStyle, textAlign: 'center' }}>{saveAllowed ? 'Nacrt ostaje privatan. Objava je sledeći korak.' : 'Potvrdite ili ispravite sve prikazane predloge pre čuvanja.'}</T>
          </> : null}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
