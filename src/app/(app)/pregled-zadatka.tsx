import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SupportContextEntry } from '../../ui/support/SupportContextEntry';
import { aiTaskReviewClientService, type AiTaskReviewEnvelope, type AiTaskReviewFact,
  type AiTaskPublicationCommand } from '../../data/aiTaskReviewClientService';
import { aiNeedV2Izvor, izvor } from '../../data';
import { correctionFromText, factCorrectionValue, factLabel, factReviewValue, canEditFactInline } from '../../data/aiNeedV2Ui';
import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { IDENTITY_VERIFICATION_UNAVAILABLE_COPY, NEED_FACT_V2_DEFINITIONS } from '../../contracts/needFactsV2';
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
import { sys } from '../../ui/system/tokens';
import { type } from '../../theme/tokens';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import type { NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { ResponseDeadlineEditor } from '../../ui/aiFirst/ResponseDeadlineEditor';
import { AuthorizedPhoto, mediaAssetId } from '../../ui/media/AuthorizedPhoto';

type Snapshot = { review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand | null; publishedReadback: boolean; locationConflict: boolean };
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
  // Facts with nothing in them are named in one line rather than given a row each, and that
  // line opens them. Nothing is hidden; a wall of "Nema navedenih stavki" is just not a wall.
  const [showEmpty, setShowEmpty] = useState(false);
  const [deadlineEditor, setDeadlineEditor] = useState(false);
  const deadlineProposal = useRef<string | null | undefined>(undefined);
  const [deadlineTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const locationProposal = useRef<{ expectedRevision: string; value: NeedLocationInput } | null>(null);
  const resolver = useMemo(() => createProductionLocationResolver(), [accountId, accountRevision, conversationId]);
  useFocusEffect(useCallback(() => { const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null; setEdit(null); setLocationEditor(null); setDeadlineEditor(false); resolver.cancel(); };
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
      return { ok: true, podatak: { review, command, publishedReadback, locationConflict: false } };
    }
    let locationConflict = false;
    const savedReview = latest.podatak?.review;
    let location = locationProposal.current ?? (savedReview?.location
      ? { expectedRevision: savedReview.geographyRevision, value: savedReview.location } : null);
    if (location) {
      // A manual location is persisted in the immutable review before final
      // acceptance. Recover it against its geographical source, independently
      // of unrelated changes (for example, a corrected title).
      const canonical = await needLocationClientService.read(conversationId);
      if (!current()) return changed();
      if (!canonical.ok) return canonical;
      if (canonical.podatak.revision !== location.expectedRevision) {
        if (locationProposal.current === location) locationProposal.current = null;
        location = null;
        locationConflict = true;
      }
    }
    const prepared = await aiTaskReviewClientService.prepare({ conversationId,
      responseDeadline: deadlineProposal.current !== undefined ? deadlineProposal.current : latest.podatak?.review.responseDeadline ?? null,
      ...(location ? { location } : {}) });
    if (!current()) return changed();
    if (!prepared.ok) return prepared;
    if (locationConflict) setLocationEditor(null);
    pending.current = null;
    return { ok: true, podatak: { review: prepared.podatak, command: null, publishedReadback: false, locationConflict } };
  }, [conversationId, accountId, accountRevision, intent]);
  const editor = useOwnedEditor(read);
  const snapshot = editor.data, review = snapshot?.review, command = snapshot?.command;
  const view = useMemo(() => ({}), [snapshot, edit, locationEditor, deadlineEditor]), currentView = useRef(view); currentView.current = view;
  const renderedFocus = focus.current;
  const current = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => current() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain;
  const navigate = (fn: () => void) => { if (!current() || navigating.current) return; navigating.current = true; fn(); };
  const back = () => navigate(() => conversationId
    ? router.replace({ pathname: '/nova', params: { conversationId } }) : router.replace('/nova'));
  const refresh = () => { if (current() && !editor.busy && !editor.loading && !navigating.current) void editor.refresh(); };
  const unavailableIdentityFact = review?.publicProjection.find(fact => fact.key === 'need.verified_identity_required' && fact.value === true);
  const publish = async () => {
    if (!canAct() || !review || !review.canAccept || unavailableIdentityFact || edit || locationEditor || deadlineEditor || command || review.accountId !== accountId) return;
    const accepted = pending.current ?? { review, id: noviUuidZahtevId() }; pending.current = accepted;
    await editor.save(async () => {
      const result = await aiTaskReviewClientService.acceptAndPublish({ review: accepted.review, clientRequestId: accepted.id });
      if (!current()) return changed();
      if (!result.ok) return result;
      return read();
    });
  };
  const resume = async () => {
    if (!canAct() || !command || !review || unavailableIdentityFact) return;
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
  const removeUnavailableIdentityRequirement = async () => {
    if (!canAct() || !unavailableIdentityFact?.id || command || edit || locationEditor || deadlineEditor) return;
    const factId = unavailableIdentityFact.id;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.correctFact(factId, false, 'Ne');
      if (!current()) return changed();
      if (!result.ok) return result;
      pending.current = null;
      return read();
    });
  };
  const openLocation = async () => {
    if (!canAct() || !conversationId || !review || command || edit || deadlineEditor) return;
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
  const proposeDeadline = async (value: string | null) => {
    if (!canAct() || !deadlineEditor || command) return;
    deadlineProposal.current = value;
    await editor.save(async () => {
      const result = await read();
      if (current() && result.ok) setDeadlineEditor(false);
      return result;
    });
  };
  const revisePublishedDraft = async () => {
    if (!canAct() || !command) return;
    const supportedEditExit = command.state === 'EVALUATED' && (command.evaluation?.kind === 'NOT_READY'
      || (command.evaluation?.kind === 'DECISION' && command.evaluation.decision.outcome !== 'ALLOW'));
    // The canonical ACCEPTED state has no evaluation dispatch;145 also blocks
    // any later claim for this immutable unsupported review. Unknown stays read-only.
    const unavailableEditExit = !!unavailableIdentityFact && command.authoritative === true
      && (command.state === 'EVALUATED' || command.state === 'ACCEPTED');
    if (!supportedEditExit && !unavailableEditExit) return;
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
  // `draftId` is the Need this conversation is bound to, and it is set exactly when the person came
  // here to change a task that already exists rather than to publish a new one. The server already
  // knows the difference — accepting a bound review confirms an edit instead of creating a draft —
  // but the screen said "Objavi zadatak" either way, right after the conversation had offered
  // "Pregledaj izmene". The button now says what the tap does.
  const revising = !!review?.draftId;
  const acceptLabel = revising ? 'Potvrdi izmene i objavi' : 'Objavi zadatak';
  // A faded "Objavi zadatak" with a caption saying what the tap would accept, and nothing anywhere
  // saying why the tap does nothing. `canAccept` is false for exactly three server reasons, and the
  // screen adds three of its own; whichever one is in the way now says so, at the top of the review
  // and again under the button.
  const blockReason: string | null = !review || published || command ? null
    : review.safety === 'BLOCK' ? 'Sadržaj ne može da se objavi u ovom obliku. Izmeni ga u razgovoru.'
      : review.missingRequired.length ? `Još nedostaje: ${review.missingRequired.map(factLabel).join(', ')}.`
        : !review.location ? 'Fali mesto na mapi. Otvori „Dodaj mesto" i potvrdi tačku — bez nje niko ne zna gde da dođe.'
          : unavailableIdentityFact ? IDENTITY_VERIFICATION_UNAVAILABLE_COPY
            : edit ? 'Sačuvaj ili otkaži izmenu koju si otvorio.'
              : locationEditor ? 'Sačuvaj ili zatvori mesto koje uređuješ.'
                : deadlineEditor ? 'Sačuvaj ili zatvori rok za prijave.' : null;
  const resultCopy = published ? (revising ? 'Izmene su objavljene.' : 'Zadatak je objavljen.') : command?.state === 'PUBLISHED'
    ? 'Objava je zabeležena. Ponovo učitaj zadatak da proveriš prikaz.'
    : outcome === 'CLARIFY' ? 'Zadatku je potrebna dopuna. Ispravi ga u razgovoru i pregledaj novu verziju.'
    : outcome === 'REVIEW' ? 'Zadatak zahteva dodatnu proveru i još nije objavljen. Možeš da ga izmeniš.'
    : outcome === 'BLOCK' ? 'Zadatak nije odobren za objavu. Pregledaj pravila i izmeni zahtev.'
    : evaluation?.kind === 'NOT_READY' ? 'Provera objave trenutno nije spremna. Tvoj zadatak je sačuvan kao privatan nacrt.'
    : command ? 'Objava još nije potvrđena. Proveri ishod pre novog pokušaja.' : null;
  const disabled = editor.busy || editor.loading || editor.uncertain;
  const EMPTY_VALUE = new Set(['—', 'Nema navedenih stavki', 'Bez fotografija', '']);
  const rows = (items: readonly AiTaskReviewFact[]) => {
    const blank = items.filter(fact => edit?.fact.id !== fact.id
      && EMPTY_VALUE.has(factReviewValue(displayFact(fact)).trim()));
    const carried = showEmpty ? items : items.filter(fact => !blank.includes(fact));
    return <>
      {carried.map(fact => row(fact))}
      {blank.length && !showEmpty ? <Press accessibilityRole="button" style={s.field}
        accessibilityLabel={`Prikaži šta nije navedeno: ${blank.map(fact => factLabel(fact.key)).join(', ')}`}
        onPress={() => setShowEmpty(true)}>
        <T style={s.meta}>Nije navedeno: {blank.map(fact => factLabel(fact.key)).join(' · ')}</T>
      </Press> : null}
    </>;
  };
  const row = (fact: AiTaskReviewFact) => {
    const shown = displayFact(fact), editing = edit?.fact.id === shown.id;
    const value = factReviewValue(shown);
    // A short value belongs beside its label, not under it. Twelve two-line stacks is the wall.
    // Character count is not width: "Dostava i kurirske usluge" is 25 characters and still did not
    // fit, so the row clipped it to "Dostava i kurirske" and the person read a different category
    // than the one in their task. Only values short enough to fit any label sit inline now, and
    // what does not fit wraps under the label instead of being cut.
    const inline = !editing && value.length <= 16;
    return <View key={fact.key} style={s.field}>
      <View style={s.row}><T style={[s.meta, inline ? undefined : { flex: 1 }]}>{factLabel(fact.key)}</T>
        {inline ? <T selectable style={[s.body, s.inlineValue]}>{value}</T> : null}
        {!command && fact.id ? <Press accessibilityRole="button" accessibilityLabel={`Izmeni: ${factLabel(fact.key)}`}
          disabled={disabled || !!edit || !!locationEditor || deadlineEditor} style={s.editButton} onPress={() => {
            if (!canAct() || edit || locationEditor || deadlineEditor) return;
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
      </> : inline ? null : <T selectable style={s.body}>{value}</T>}
      {fact.source === 'SYSTEM' ? <T style={s.meta}>Podrazumevana vrednost</T> : null}
    </View>;
  };
  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}><Press accessibilityRole="button" accessibilityLabel="Nazad u razgovor" style={s.back} onPress={back}>
        <V2Icon name="back" color={a.color.ink} /></Press><View style={{ flex: 1 }}>
        <T style={s.meta}>{published ? 'Spremno za prijave'
          : revising ? 'Izmena postojećeg zadatka' : 'Ti odlučuješ šta objavljuješ'}</T>
        <T accessibilityRole="header" style={s.title}>{published ? 'Objavljeno'
          : revising ? 'Pregled izmena' : 'Pregled zadatka'}</T></View></View>
      {editor.loading ? <ActivityIndicator accessibilityLabel="Učitavanje pregleda" color={a.color.green} style={{ padding: 30 }} /> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {review ? <>
          {blockReason ? <View style={s.notice}><T accessibilityLiveRegion="polite" style={s.body}>{blockReason}</T>
            {review.missingRequired.length || review.safety === 'BLOCK'
              ? <V2Action label="Dopuni u razgovoru" disabled={disabled} onPress={back} /> : null}</View> : null}
          {snapshot?.locationConflict ? <View style={s.notice}><T accessibilityRole="alert" style={s.body}>
            Mesto je promenjeno posle prethodnog pregleda. Prikazano je trenutno mesto; pregledaj ga ili izmeni pre objave.
          </T></View> : null}
          {locationEditor ? <View style={s.section}><NeedLocationForm reviewOnly review={locationEditor}
            resolver={resolver} busy={editor.busy} uncertain={editor.uncertain} onSave={proposeLocation} />
            <V2Action label="Vrati se na pregled" kind="quiet" disabled={disabled} onPress={() => { resolver.cancel(); setLocationEditor(null); }} /></View> : null}
          <View style={s.section}>
            {(() => {
              const title = review.publicProjection.find(fact => fact.key === 'need.title');
              const text = title ? factReviewValue(displayFact(title)) : null;
              return text ? <T accessibilityRole="header" style={s.hero}>{text}</T> : null;
            })()}
            <T style={s.meta}>Ovako će drugi videti zadatak</T>
            {rows(review.publicProjection.filter(fact => fact.key !== 'need.public_photo_paths' && fact.key !== 'need.title'))}
            {/* This orange box used to stand on every task, warning about a condition the task did
                not have. It belongs to the tasks that actually carry the unverifiable requirement. */}
            {unavailableIdentityFact ? <View style={s.notice}><T style={s.meta}>{IDENTITY_VERIFICATION_UNAVAILABLE_COPY}</T>
              <T>U ovom pregledu je ostao uslov koji aplikacija ne može da proveri. Ukloni ga izričito da nastaviš običnim zadatkom.</T>
              {!command && unavailableIdentityFact.id ? <V2Action label="Nastavi bez uslova provere identiteta" kind="quiet"
                disabled={disabled || !!edit || !!locationEditor || deadlineEditor} onPress={removeUnavailableIdentityRequirement} /> : null}
            </View> : null}
            {review.location?.resolvedLocation?.points.length ? <T style={s.meta}>Na javnoj mapi prikazuje se približno područje. Tačne tačke ostaju privatne.</T> : null}
          </View>
          {review.ownerPrivateProjection.length ? <View style={[s.section, s.private]}>
            <T accessibilityRole="header" style={s.sectionTitle}>Privatni podaci</T>
            <T style={s.meta}>Ovi podaci nisu deo javnog zadatka. Pristup ostaje prema pravilima Dogovora.</T>
            {rows(review.ownerPrivateProjection)}</View> : null}
          <View style={s.section}><T accessibilityRole="header" style={s.sectionTitle}>Fotografije zadatka</T>
            {(() => {
              const paths = review.publicProjection.find(fact => fact.key === 'need.public_photo_paths')?.value;
              return Array.isArray(paths) && paths.length ? paths.map((path, i) => {
                const assetId = typeof path === 'string' ? mediaAssetId(path) : null;
                return assetId ? <AuthorizedPhoto key={assetId} assetId={assetId} label={`Fotografija zadatka ${i + 1}`} /> : null;
              }) : <T style={s.meta}>Fotografije nisu dodate.</T>;
            })()}
            {!command ? <V2Action label="Uredi fotografije" kind="quiet" disabled={disabled || !!edit || !!locationEditor || deadlineEditor}
              onPress={() => { if (!canAct() || !conversationId || edit || locationEditor || deadlineEditor) return;
                navigate(() => router.push({ pathname: '/fotografije-zadatka', params: { conversationId } })); }} /> : null}
          </View>
          <View style={s.section}><T accessibilityRole="header" style={s.sectionTitle}>Prijave na zadatak</T>
            {deadlineEditor ? <ResponseDeadlineEditor value={review.responseDeadline} timezone={deadlineTimezone} disabled={disabled}
              apply={value => { void proposeDeadline(value); }} cancel={() => { if (canAct()) setDeadlineEditor(false); }} /> : <>
              <T style={s.body}>{review.responseDeadline ? `Rok: ${new Date(review.responseDeadline).toLocaleString('sr-Latn-RS', { timeZone: deadlineTimezone })} (${deadlineTimezone})`
                : 'Bez posebnog roka — do popune, zaustavljanja potrage ili isteka zadatka.'}</T>
              {!command ? <V2Action label="Uredi rok za prijave" kind="quiet" disabled={disabled || !!edit || !!locationEditor}
                onPress={() => { if (canAct()) setDeadlineEditor(true); }} /> : null}
            </>}</View>
          {resultCopy ? <View style={s.notice}><T accessibilityLiveRegion="polite" style={s.body}>{resultCopy}</T></View> : null}
          {command?.state === 'EVALUATED' && outcome === 'REVIEW' ? <SupportContextEntry
            reference={{ kind: 'TASK_REVIEW', id: review.reviewId, revision: null }} label="Zatraži pregled podrške"
            disabled={disabled} canAct={canAct} navigate={navigate} /> : null}
          {!command ? <V2Action label="Izmeni u razgovoru" kind="quiet" disabled={disabled} onPress={back} /> : null}
          {!command && !locationEditor ? <V2Action label={review.location ? 'Uredi mesto' : 'Dodaj mesto'} kind="quiet" disabled={disabled || !!edit || deadlineEditor} onPress={openLocation} /> : null}
        </> : null}
      </ScrollView>
      <View style={s.footer}>
        {editor.error ? <T accessibilityRole="alert" style={s.error}>{editor.error}</T> : null}
        {editor.uncertain || editor.error || !review ? <V2Action label="Učitaj pregled i proveri ishod" disabled={editor.busy || editor.loading} onPress={refresh} /> : null}
        {published && command ? <V2Action label="Otvori zadatak" kind="primary" onPress={() => navigate(() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: command.needId } }))} />
          : command ? <>
            <V2Action label="Proveri objavu" disabled={editor.busy || editor.loading} onPress={refresh} />
            {!unavailableIdentityFact && (command.state === 'ACCEPTED' || (command.state === 'EVALUATED' && outcome === 'ALLOW')) ?
              <V2Action label="Nastavi istu objavu" disabled={disabled} onPress={resume} /> : null}
            {((command.state === 'EVALUATED' && (evaluation?.kind === 'NOT_READY' || (outcome && outcome !== 'ALLOW')))
              || (!!unavailableIdentityFact && command.authoritative && (command.state === 'EVALUATED' || command.state === 'ACCEPTED')))
              ? <V2Action label="Izmeni zadatak" disabled={disabled} onPress={revisePublishedDraft} /> : null}
          </> : review ? <>
            <Press accessibilityRole="button" accessibilityLabel={acceptLabel} disabled={disabled || !review.canAccept || !!unavailableIdentityFact || !!edit || !!locationEditor || deadlineEditor}
              accessibilityState={{ disabled: disabled || !review.canAccept || !!unavailableIdentityFact || !!edit || !!locationEditor || deadlineEditor }} onPress={publish}
              style={[s.publish, (disabled || !review.canAccept || !!unavailableIdentityFact || !!edit || !!locationEditor || deadlineEditor) && { opacity: 0.45 }]}>
              {editor.busy ? <ActivityIndicator color={a.color.surface} /> : <T style={s.publishLabel}>{acceptLabel}</T>}
            </Press><T style={[s.meta, { textAlign: 'center' }]}>{blockReason ?? (revising
              ? 'Klikom potvrđuješ ovu verziju zadatka i tražiš njenu objavu.'
              : 'Klikom prihvataš ovu prikazanu verziju i tražiš objavu.')}</T>
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
  hero: { ...type.hero, color: a.color.ink },
  inlineValue: { flexShrink: 1, textAlign: 'right' },
  field: { borderBottomWidth: 1, borderBottomColor: a.color.line, paddingVertical: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, editButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  editLabel: { ...a.text.meta, fontWeight: '600', color: a.color.green }, private: { padding: 16, borderRadius: sys.radius.cardCompact, backgroundColor: a.color.wash },
  input: { ...a.text.body, padding: 12, borderWidth: 1, borderColor: a.color.green, borderRadius: sys.radius.control, minHeight: 56, color: a.color.ink },
  notice: { padding: 16, borderRadius: sys.radius.control, backgroundColor: a.color.warm, gap: 12 }, error: { ...a.text.meta, color: a.color.danger },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: a.color.line, gap: 10 },
  publish: { minHeight: 54, borderRadius: sys.radius.primary, backgroundColor: a.color.green, alignItems: 'center', justifyContent: 'center', padding: 14 },
  publishLabel: { ...a.text.body, fontWeight: '700', color: a.color.surface },
});
