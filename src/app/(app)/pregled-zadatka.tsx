import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { aiTaskReviewClientService, type AiTaskReviewEnvelope, type AiTaskReviewFact,
  type AiTaskPublicationCommand } from '../../data/aiTaskReviewClientService';
import { aiNeedV2Izvor, izvor } from '../../data';
import { correctionFromText, factCorrectionValue, factLabel, factReviewValue, canEditFactInline } from '../../data/aiNeedV2Ui';
import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { NEED_FACT_V2_DEFINITIONS } from '../../contracts/needFactsV2';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { V2Action } from '../../ui/v2/V2Action';
import { V2Icon } from '../../ui/v2/icons';
import { aiFirst as a } from '../../ui/aiFirst/tokens';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import type { NeedLocationInput, NeedLocationReview } from '../../contracts/location';

type Snapshot = { review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand | null; publishedReadback: boolean };
type Edit = { fact: AiNeedV2Fact; text: string; error: string | null };
const changed = (): Ishod<never> => ({ ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvori pregled za trenutni nalog.' });
function displayFact(fact: AiTaskReviewFact): AiNeedV2Fact {
  const definition = NEED_FACT_V2_DEFINITIONS[fact.key];
  return { ...fact, id: fact.id ?? fact.key, valueType: definition.valueType,
    requiredForDraft: definition.requiredForDraft, evidence: null };
}

export default function ReviewedTaskRoute() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const { user, accountRevision } = useSesija();
  const conversationId = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  return <ReviewedTask key={`${user?.id}:${accountRevision}:${conversationId}`} conversationId={conversationId} />;
}

function ReviewedTask({ conversationId }: { conversationId: string | null }) {
  const { user, accountRevision } = useSesija(), intent = useUloga();
  const accountId = user?.id;
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const pending = useRef<{ review: AiTaskReviewEnvelope; id: string } | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [locationEditor, setLocationEditor] = useState<NeedLocationReview | null>(null);
  const locationProposal = useRef<{ expectedRevision: string; value: NeedLocationInput } | null>(null);
  const resolver = useMemo(() => createProductionLocationResolver(), [accountId, accountRevision, conversationId]);
  useFocusEffect(useCallback(() => { const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null; setEdit(null); setLocationEditor(null); resolver.cancel(); };
  }, [accountId, accountRevision, intent, resolver]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const scope = focus.current;
    const current = () => scope !== null && scope === focus.current && !!accountId
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    if (!conversationId || !current()) return changed();
    const latest = pending.current
      ? await aiTaskReviewClientService.read(pending.current.review.reviewId)
      : await aiTaskReviewClientService.readLatest(conversationId);
    if (!current()) return changed();
    if (!latest.ok) return latest;
    if (latest.podatak?.command) {
      const { review, command } = latest.podatak;
      let publishedReadback = false;
      if (command.state === 'PUBLISHED') {
        const need = await izvor.potreba(command.needId);
        if (!current()) return changed();
        publishedReadback = need?.id === command.needId && need.revizija === command.needRevision
          && ['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA', 'POPUNJENA'].includes(need.stanje);
      }
      return { ok: true, podatak: { review, command, publishedReadback } };
    }
    const prepared = await aiTaskReviewClientService.prepare({ conversationId, responseDeadline: null,
      ...(locationProposal.current ? { location: locationProposal.current } : {}) });
    if (!current()) return changed();
    if (!prepared.ok) return prepared;
    pending.current = null;
    return { ok: true, podatak: { review: prepared.podatak, command: null, publishedReadback: false } };
  }, [conversationId, accountId, accountRevision, intent]);
  const editor = useOwnedEditor(read);
  const snapshot = editor.data, review = snapshot?.review, command = snapshot?.command;
  const view = useMemo(() => ({}), [snapshot]), currentView = useRef(view); currentView.current = view;
  const renderedFocus = focus.current;
  const current = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => current() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain;
  const navigate = (fn: () => void) => { if (!current() || navigating.current) return; navigating.current = true; fn(); };
  const back = () => navigate(() => conversationId
    ? router.replace({ pathname: '/nova', params: { conversationId } }) : router.replace('/nova'));
  const refresh = () => { if (current() && !editor.busy && !editor.loading && !navigating.current) void editor.refresh(); };
  const publish = async () => {
    if (!canAct() || !review || !review.canAccept || edit || locationEditor || command || review.accountId !== accountId) return;
    const accepted = pending.current ?? { review, id: noviUuidZahtevId() }; pending.current = accepted;
    await editor.save(async () => {
      const result = await aiTaskReviewClientService.acceptAndPublish({ review: accepted.review, clientRequestId: accepted.id });
      if (!current()) return changed();
      if (!result.ok) return result;
      return read();
    });
  };
  const resume = async () => {
    if (!canAct() || !command || !review) return;
    await editor.save(async () => {
      const result = await aiTaskReviewClientService.resume(command);
      if (!current()) return changed();
      if (!result.ok) return result;
      return read();
    });
  };
  const saveEdit = async () => {
    if (!canAct() || !edit || command) return;
    const parsed = correctionFromText(edit.fact, edit.text);
    if (!parsed.ok) { setEdit({ ...edit, error: parsed.message }); return; }
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.correctFact(edit.fact.id, parsed.value, parsed.displayValue);
      if (!current()) return changed();
      if (!result.ok) return result;
      setEdit(null); pending.current = null;
      return read();
    });
  };
  const openLocation = async () => {
    if (!canAct() || !conversationId || !review || command) return;
    const result = await needLocationClientService.read(conversationId);
    if (!current() || !result.ok) return;
    setEdit(null);
    setLocationEditor({ ...result.podatak, value: locationProposal.current?.value ?? review.location ?? result.podatak.value });
  };
  const proposeLocation = async (value: NeedLocationInput) => {
    if (!canAct() || !locationEditor || !conversationId || command) return;
    locationProposal.current = { expectedRevision: locationEditor.revision, value };
    await editor.save(async () => {
      const result = await read();
      if (current() && result.ok) setLocationEditor(null);
      return result;
    });
  };
  const revisePublishedDraft = async () => {
    if (!canAct() || !command) return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.openEditConversation(command.needId);
      if (!current()) return changed();
      if (!result.ok) return result;
      navigate(() => router.replace({ pathname: '/nova', params: { conversationId: result.podatak.conversationId } }));
      return { ok: true, podatak: snapshot! };
    });
  };

  const evaluation = command?.evaluation;
  const outcome = evaluation?.kind === 'DECISION' ? evaluation.decision.outcome : null;
  const published = command?.state === 'PUBLISHED' && snapshot?.publishedReadback;
  const resultCopy = published ? 'Zadatak je objavljen.' : command?.state === 'PUBLISHED'
    ? 'Objava je zabeležena. Ponovo učitaj zadatak da proveriš prikaz.'
    : outcome === 'CLARIFY' ? 'Zadatku je potrebna dopuna. Ispravi ga u razgovoru i pregledaj novu verziju.'
    : outcome === 'REVIEW' ? 'Zadatak zahteva dodatnu proveru i još nije objavljen. Možeš da ga izmeniš.'
    : outcome === 'BLOCK' ? 'Zadatak nije odobren za objavu. Pregledaj pravila i izmeni zahtev.'
    : evaluation?.kind === 'NOT_READY' ? 'Provera objave trenutno nije spremna. Tvoj zadatak je sačuvan kao privatan nacrt.'
    : command ? 'Objava još nije potvrđena. Proveri ishod pre novog pokušaja.' : null;
  const disabled = editor.busy || editor.loading || editor.uncertain;
  const rows = (items: readonly AiTaskReviewFact[]) => items.map(fact => {
    const shown = displayFact(fact), editing = edit?.fact.id === shown.id;
    return <View key={fact.key} style={s.field}>
      <View style={s.row}><T style={[s.meta, { flex: 1 }]}>{factLabel(fact.key)}</T>
        {!command && fact.id ? <Press accessibilityRole="button" accessibilityLabel={`Izmeni: ${factLabel(fact.key)}`}
          disabled={disabled || !!edit} style={s.editButton} onPress={() => {
            if (!canAct()) return;
            if (['need.task_country_code', 'need.task_geography', 'need.exact_address', 'need.access_notes', 'need.resolved_location'].includes(fact.key)) { void openLocation(); return; }
            if (!canEditFactInline(shown)) { back(); return; }
            setEdit({ fact: shown, text: factCorrectionValue(shown), error: null });
          }}><T style={s.editLabel}>Izmeni</T></Press> : null}</View>
      {editing ? <>
        <TextInput accessibilityLabel={`Nova vrednost: ${factLabel(fact.key)}`} value={edit.text} multiline
          onChangeText={text => { if (canAct()) setEdit({ ...edit, text, error: null }); }} editable={!disabled} style={s.input} />
        {edit.error ? <T accessibilityRole="alert" style={s.error}>{edit.error}</T> : null}
        <V2Action label="Sačuvaj ispravku" disabled={disabled} onPress={saveEdit} />
        <V2Action label="Odustani od ispravke" kind="quiet" disabled={disabled} onPress={() => setEdit(null)} />
      </> : <T selectable style={s.body}>{factReviewValue(shown)}</T>}
      {fact.source === 'SYSTEM' ? <T style={s.meta}>Podrazumevana vrednost</T> : null}
    </View>;
  });
  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}><Press accessibilityRole="button" accessibilityLabel="Nazad u razgovor" style={s.back} onPress={back}>
        <V2Icon name="back" color={a.color.ink} /></Press><View style={{ flex: 1 }}>
        <T style={s.meta}>{published ? 'Spremno za prijave' : 'Ti odlučuješ šta objavljuješ'}</T>
        <T accessibilityRole="header" style={s.title}>{published ? 'Objavljeno' : 'Pregled zadatka'}</T></View></View>
      {editor.loading ? <ActivityIndicator accessibilityLabel="Učitavanje pregleda" color={a.color.green} style={{ padding: 30 }} /> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {review ? <>
          {locationEditor ? <View style={s.section}><NeedLocationForm reviewOnly review={locationEditor}
            resolver={resolver} busy={editor.busy} uncertain={editor.uncertain} onSave={proposeLocation} />
            <V2Action label="Vrati se na pregled" kind="quiet" disabled={disabled} onPress={() => { resolver.cancel(); setLocationEditor(null); }} /></View> : null}
          <View style={s.section}><T accessibilityRole="header" style={s.sectionTitle}>Ovako će drugi videti zadatak</T>
            {rows(review.publicProjection)}
            {review.location?.resolvedLocation?.points.length ? <T style={s.meta}>Na javnoj mapi prikazuje se približno područje. Tačne tačke ostaju privatne.</T> : null}
          </View>
          {review.ownerPrivateProjection.length ? <View style={[s.section, s.private]}>
            <T accessibilityRole="header" style={s.sectionTitle}>Privatni podaci</T>
            <T style={s.meta}>Ovi podaci nisu deo javnog zadatka. Pristup ostaje prema pravilima Dogovora.</T>
            {rows(review.ownerPrivateProjection)}</View> : null}
          {review.missingRequired.length ? <View style={s.notice}><T style={s.body}>Još nedostaje: {review.missingRequired.map(factLabel).join(', ')}.</T>
            <V2Action label="Dopuni u razgovoru" disabled={disabled} onPress={back} /></View> : null}
          {resultCopy ? <View style={s.notice}><T accessibilityLiveRegion="polite" style={s.body}>{resultCopy}</T></View> : null}
          {!command ? <V2Action label="Izmeni u razgovoru" kind="quiet" disabled={disabled} onPress={back} /> : null}
          {!command && !locationEditor ? <V2Action label={review.location ? 'Uredi mesto' : 'Dodaj mesto'} kind="quiet" disabled={disabled} onPress={openLocation} /> : null}
        </> : null}
      </ScrollView>
      <View style={s.footer}>
        {editor.error ? <T accessibilityRole="alert" style={s.error}>{editor.error}</T> : null}
        {editor.uncertain || editor.error || !review ? <V2Action label="Učitaj pregled i proveri ishod" disabled={editor.busy || editor.loading} onPress={refresh} /> : null}
        {published && command ? <V2Action label="Otvori zadatak" kind="primary" onPress={() => navigate(() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: command.needId } }))} />
          : command ? <>
            <V2Action label="Proveri objavu" disabled={editor.busy || editor.loading} onPress={refresh} />
            {command.state === 'ACCEPTED' || (command.state === 'EVALUATED' && outcome === 'ALLOW') ?
              <V2Action label="Nastavi istu objavu" disabled={disabled} onPress={resume} /> : null}
            {outcome && outcome !== 'ALLOW' ? <V2Action label="Izmeni zadatak" disabled={disabled} onPress={revisePublishedDraft} /> : null}
          </> : review ? <>
            <Press accessibilityRole="button" accessibilityLabel="Objavi zadatak" disabled={disabled || !review.canAccept || !!edit || !!locationEditor}
              accessibilityState={{ disabled: disabled || !review.canAccept || !!edit || !!locationEditor }} onPress={publish}
              style={[s.publish, (disabled || !review.canAccept || !!edit || !!locationEditor) && { opacity: 0.45 }]}>
              {editor.busy ? <ActivityIndicator color={a.color.surface} /> : <T style={s.publishLabel}>Objavi zadatak</T>}
            </Press><T style={[s.meta, { textAlign: 'center' }]}>Klikom prihvataš ovu prikazanu verziju i tražiš objavu.</T>
          </> : null}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: a.color.surface }, header: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, title: { ...a.text.title, color: a.color.ink },
  meta: { ...a.text.meta, color: a.color.muted }, body: { ...a.text.body, color: a.color.ink },
  content: { padding: 20, gap: 24 }, section: { gap: 8 }, sectionTitle: { ...a.text.card, color: a.color.ink },
  field: { borderBottomWidth: 1, borderBottomColor: a.color.line, paddingVertical: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, editButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  editLabel: { ...a.text.meta, fontWeight: '600', color: a.color.green }, private: { padding: 16, borderRadius: 18, backgroundColor: a.color.wash },
  input: { ...a.text.body, padding: 12, borderWidth: 1, borderColor: a.color.green, borderRadius: 12, minHeight: 56, color: a.color.ink },
  notice: { padding: 16, borderRadius: 16, backgroundColor: a.color.warm, gap: 12 }, error: { ...a.text.meta, color: a.color.danger },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: a.color.line, gap: 10 },
  publish: { minHeight: 54, borderRadius: a.radius.primary, backgroundColor: a.color.green, alignItems: 'center', justifyContent: 'center', padding: 14 },
  publishLabel: { ...a.text.body, fontWeight: '700', color: a.color.surface },
});
