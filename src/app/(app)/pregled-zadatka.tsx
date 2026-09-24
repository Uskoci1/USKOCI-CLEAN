import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SupportContextEntry } from '../../ui/support/SupportContextEntry';
import { aiTaskReviewClientService, type AiTaskReviewEnvelope, type AiTaskReviewFact,
  type AiTaskPublicationCommand } from '../../data/aiTaskReviewClientService';
import { reviewFactProblem } from '../../data/reviewFactProblem';
import { aiNeedV2Izvor, izvor } from '../../data';
import { correctionFromText, factCorrectionValue, factEditorKind, factLabel, factListItems, factReviewValue,
  factTimestampFields, listCorrectionText, timestampCorrectionText } from '../../data/aiNeedV2Ui';
import type { NeedFactV2Key } from '../../contracts/needFactsV2';
import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { IDENTITY_VERIFICATION_UNAVAILABLE_COPY, NEED_FACT_V2_DEFINITIONS } from '../../contracts/needFactsV2';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';

import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { StateView } from '../../ui/system/StateView';
import { useReducedMotion } from '../../ui/system/motion';
import { useTextScale } from '../../ui/system/textScale';
import { brandAction } from '../../ui/system/tokens';
import { DOGOVORENA_ZONA, dogovorenoVreme } from '../../lib/dogovorenoVreme';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import type { NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { FactListEditor, FactTimestampEditor } from '../../ui/aiFirst/FactValueEditors';
import { ResponseDeadlineEditor } from '../../ui/aiFirst/ResponseDeadlineEditor';
import { mediaAssetId } from '../../ui/media/AuthorizedPhoto';
import { publicSummary } from '../../ui/v2/draftSummary';
import { publicAnchorPoint, reviewRowValue, reviewTodos } from '../../ui/objava/reviewFacts';
import { PrivatePlace, PublicPlace, PublishButton, ReviewDeadline, ReviewEmptyFacts, ReviewFactRow, ReviewPhotos, ReviewPreview,
  ReviewSection, ReviewStatus, ReviewTodoList, reviewStyles as s, type TodoRow } from '../../ui/objava/ReviewPresentation';

type Snapshot = { review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand | null; publishedReadback: boolean; locationConflict: boolean };
/** `text` is always what `correctionFromText` reads; a picker or a list field only writes it. */
type Edit = { fact: AiNeedV2Fact; text: string; error: string | null; date?: string; time?: string; items?: string[] };
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
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const pending = useRef<{ review: AiTaskReviewEnvelope; id: string } | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [locationEditor, setLocationEditor] = useState<NeedLocationReview | null>(null);
  // Facts with nothing in them are named in one line rather than given a row each, and that
  // line opens them. Nothing is hidden; a wall of "Nema navedenih stavki" is just not a wall.
  const [showEmpty, setShowEmpty] = useState(false);
  const [deadlineEditor, setDeadlineEditor] = useState(false);
  // True only while the write in flight is the publish itself: every other save (a draft, a corrected fact, the place,
  // the deadline) also makes the editor busy, and "Objavi zadatak" must not spin for those.
  const [publishing, setPublishing] = useState(false);
  // The place is being read before its editor opens: the "Uredi mesto" action says so.
  const [opening, setOpening] = useState(false);
  // A place that could not be read says so beside its button, instead of the button doing nothing.
  const [openError, setOpenError] = useState<string | null>(null);
  // True once a publish or resume started on this screen read back its publication: only that confirms itself with the
  // spring. A published review restored on opening is simply shown (motion only on a real state change).
  const publishedHere = useRef(false);
  const deadlineProposal = useRef<string | null | undefined>(undefined);
  // The deadline is a term other people read, so it is set and shown in Serbian time like every
  // agreed time (owner rule 8.27); the facts above it already read in that zone.
  const deadlineTimezone = DOGOVORENA_ZONA;
  const locationProposal = useRef<{ expectedRevision: string; value: NeedLocationInput } | null>(null);
  const resolver = useMemo(() => createProductionLocationResolver(), [accountId, accountRevision, conversationId]);
  useFocusEffect(useCallback(() => { const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null; setEdit(null); setLocationEditor(null); setDeadlineEditor(false); resolver.cancel(); };
  }, [accountId, accountRevision, resolver]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const scope = focus.current;
    const current = () => scope !== null && scope === focus.current && !!accountId
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
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
  }, [conversationId, accountId, accountRevision]);
  const editor = useOwnedEditor(read);
  const snapshot = editor.data, review = snapshot?.review, command = snapshot?.command;
  const view = useMemo(() => ({}), [snapshot, edit, locationEditor, deadlineEditor]), currentView = useRef(view); currentView.current = view;
  const renderedFocus = focus.current;
  const current = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const canAct = () => current() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain;
  const navigate = (fn: () => void) => { if (!current() || navigating.current) return; navigating.current = true; fn(); };
  const back = () => navigate(() => conversationId
    ? router.replace({ pathname: '/nova', params: { conversationId } }) : router.replace('/nova'));
  const refresh = () => { if (current() && !editor.busy && !editor.loading && !navigating.current) void editor.refresh(); };
  const unavailableIdentityFact = review?.publicProjection.find(fact => fact.key === 'need.verified_identity_required' && fact.value === true);
  // "Objavi" and "Sačuvaj nacrt" are the same acceptance of the same displayed review, under one
  // retained command identity; they differ only in whether evaluation and publication follow now.
  const accept = async (andPublish: boolean) => {
    if (!canAct() || !review || !review.canAccept || unavailableIdentityFact || edit || locationEditor || deadlineEditor || command || review.accountId !== accountId) return;
    const accepted = pending.current ?? { review, id: noviUuidZahtevId() }; pending.current = accepted;
    // Marked only once the editor has taken the write (the export screen's rule), so a refused second press never
    // clears the first one's spinner.
    let started = false;
    try {
      await editor.save(async () => {
        started = true; if (andPublish) setPublishing(true);
        const request = { review: accepted.review, clientRequestId: accepted.id };
        const result = await (andPublish ? aiTaskReviewClientService.acceptAndPublish(request) : aiTaskReviewClientService.acceptAsDraft(request));
        if (!current()) return changed();
        if (!result.ok) return result;
        return publishedRead(await read());
      });
    } finally { if (started) setPublishing(false); }
  };
  const publish = () => accept(true);
  function publishedRead(next: Ishod<Snapshot>): Ishod<Snapshot> {
    if (next.ok && next.podatak.command?.state === 'PUBLISHED' && next.podatak.publishedReadback) publishedHere.current = true;
    return next;
  }
  const resume = async () => {
    if (!canAct() || !command || !review || unavailableIdentityFact) return;
    await editor.save(async () => {
      const result = await aiTaskReviewClientService.resume(command);
      if (!current()) return changed();
      if (!result.ok) return result;
      return publishedRead(await read());
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
    if (!canAct() || !conversationId || !review || command || edit || deadlineEditor || opening) return;
    setOpening(true); setOpenError(null);
    let result: Awaited<ReturnType<typeof needLocationClientService.read>>;
    try { result = await needLocationClientService.read(conversationId); }
    catch { if (current()) setOpenError('Mesto trenutno nije učitano. Pokušaj ponovo.'); return; }
    finally { setOpening(false); }
    if (!current()) return;
    if (!result.ok) { setOpenError(result.poruka); return; }
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
  // What the server would refuse about the facts themselves: no amount for "Moja cena", a fixed time without
  // both ends, or one that has already begun (deep read 8.5, 5.1).
  const factProblem = review && !published && !command ? reviewFactProblem(review) : null;
  // `canAccept` is false for exactly three server reasons (a safety block, something missing, no place on the map); each
  // is a row of "Još treba" with its way to the fix, and the grey publish says in one line that they come first.
  const todos = review && !published && !command ? reviewTodos(review, factProblem, !!unavailableIdentityFact) : [];
  const resultCopy = published ? (revising ? 'Izmene su objavljene.' : 'Zadatak je objavljen.') : command?.state === 'PUBLISHED'
    ? 'Objava je zabeležena. Ponovo učitaj zadatak da proveriš prikaz.'
    : outcome === 'CLARIFY' ? 'Zadatku je potrebna dopuna. Ispravi ga u razgovoru i pregledaj novu verziju.'
    // Deep read 8.7: support has no operator yet (7.31), so a review request waits; saying so is the honest part.
    : outcome === 'REVIEW' ? 'Zadatak zahteva ručnu proveru i još nije objavljen. Podrška još nema dežurnog operatera, pa je najbrže da ga izmeniš i ponovo pošalješ.'
    : outcome === 'BLOCK' ? 'Zadatak nije odobren za objavu. Pregledaj pravila i izmeni zahtev.'
    : evaluation?.kind === 'NOT_READY' ? 'Provera objave trenutno nije spremna. Tvoj zadatak je sačuvan kao privatan nacrt.'
    // ACCEPTED is exactly "the private draft exists and nothing after it has been confirmed", whether
    // the person asked for a draft or a publish stopped here.
    : command?.state === 'ACCEPTED' ? 'Sačuvano kao privatan nacrt. Zadatak nije objavljen.'
    : command ? 'Objava još nije potvrđena. Proveri ishod pre novog pokušaja.' : null;
  const disabled = editor.busy || editor.loading || editor.uncertain;
  const publishBlocked = !review || disabled || !review.canAccept || !!factProblem || !!unavailableIdentityFact || !!edit || !!locationEditor || !!deadlineEditor;
  // "Loading = the write this action started": only the publish spins the publish button; while a draft or a fact saves
  // it simply waits grey.
  const publishWorking = editor.busy && publishing;
  // One line under the publish button: the first thing in its way, short (the full list is "Još treba" above), or what
  // the tap accepts.
  const caption = todos.length || unavailableIdentityFact ? 'Prvo reši ono što još treba.'
    : edit ? 'Sačuvaj ili otkaži otvorenu izmenu.'
      : deadlineEditor ? 'Sačuvaj ili zatvori rok za prijave.'
        : revising ? 'Ovim potvrđuješ ovu verziju zadatka i tražiš njenu objavu.'
          : 'Ovim prihvataš prikazanu verziju i tražiš objavu.';
  const large = useTextScale() >= 1.3;
  const reduced = useReducedMotion();
  const EMPTY_VALUE = new Set(['—', 'Nema navedenih stavki', 'Bez fotografija', '']);
  // An open correction scrolls its row into view, so its field is never left under the keyboard or the footer.
  const scroll = useRef<ScrollView>(null), content = useRef<View>(null), rowRefs = useRef(new Map<string, View>());
  useEffect(() => {
    const key = edit?.fact.key, row = key ? rowRefs.current.get(key) : undefined, host = content.current;
    if (!row || !host || typeof row.measureLayout !== 'function') return;
    row.measureLayout(host as never, (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: !reduced }), () => undefined);
  }, [edit?.fact.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // The place is its own step: the arrow and Android Back both return to the review, and nothing is saved by leaving.
  // Leaving saves nothing, so only a write in flight holds it: after an unconfirmed outcome the way out stays open.
  const closePlace = () => { if (editor.busy) return; resolver.cancel(); setLocationEditor(null); };
  const closePlaceNow = useRef(closePlace); closePlaceNow.current = closePlace;
  const placeOpen = !!locationEditor;
  useFocusEffect(useCallback(() => {
    if (!placeOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closePlaceNow.current(); return true; });
    return () => subscription.remove();
  }, [placeOpen]));
  const startEdit = (fact: AiTaskReviewFact) => {
    if (!canAct() || edit || locationEditor || deadlineEditor || command) return;
    // A place is structured and has its own editor; every other fact is corrected right here.
    const shown = displayFact(fact), kind = factEditorKind(shown);
    if (kind === 'none' || PLACE_KEYS.includes(fact.key)) { void openLocation(); return; }
    setEdit({ fact: shown, text: factCorrectionValue(shown), error: null,
      ...(kind === 'timestamp' ? factTimestampFields(shown) : {}), ...(kind === 'list' ? { items: factListItems(shown) } : {}) });
  };
  // People never see or choose a category (owner decision 2026-09-21, deep read 9.2). The AI still
  // writes it for the server, which reads a kind of work from it only to match; it is not a row here.
  // Facts with nothing in them are named in one line rather than given a row each, and that line opens them.
  const rows = (all: readonly AiTaskReviewFact[]) => {
    const items = all.filter(fact => fact.key !== 'need.category');
    const blank = items.filter(fact => edit?.fact.id !== fact.id
      && EMPTY_VALUE.has(factReviewValue(displayFact(fact)).trim()));
    const carried = showEmpty ? items : items.filter(fact => !blank.includes(fact));
    return <>
      {carried.map(fact => row(fact))}
      {blank.length && !showEmpty ? <ReviewEmptyFacts labels={blank.map(fact => factLabel(fact.key))} onOpen={() => setShowEmpty(true)} /> : null}
    </>;
  };
  const row = (fact: AiTaskReviewFact) => {
    const shown = displayFact(fact), editing = edit?.fact.id === shown.id;
    return <ReviewFactRow key={fact.key} label={factLabel(fact.key)} value={reviewRowValue(shown)} large={large}
      system={fact.source === 'SYSTEM'} editDisabled={disabled || !!edit || !!locationEditor || deadlineEditor}
      edit={!command && fact.id ? () => startEdit(fact) : undefined}
      rowRef={node => { if (node) rowRefs.current.set(fact.key, node); else rowRefs.current.delete(fact.key); }}>
      {editing ? <>
        {factEditorKind(edit.fact) === 'timestamp' ? <FactTimestampEditor label={factLabel(fact.key)} date={edit.date ?? ''} time={edit.time ?? ''}
          disabled={disabled} onChange={(date, time) => { if (canAct()) setEdit({ ...edit, date, time, error: null,
            text: timestampCorrectionText(edit.fact, date, time) }); }} />
        : factEditorKind(edit.fact) === 'list' ? <FactListEditor label={factLabel(fact.key)} items={edit.items ?? []} disabled={disabled}
          onChange={(items, typed) => { if (!canAct()) return;
            const pending = typed.trim();
            setEdit({ ...edit, items, error: null,
              text: listCorrectionText(pending && !items.includes(pending) ? [...items, pending] : items) }); }} />
        : <TextInput accessibilityLabel={`Nova vrednost: ${factLabel(fact.key)}`} value={edit.text} multiline
          onChangeText={text => { if (canAct()) setEdit({ ...edit, text, error: null }); }} editable={!disabled} style={s.input} />}
        {edit.error ? <T accessibilityRole="alert" style={s.error}>{edit.error}</T> : null}
        <V2Action label="Sačuvaj ispravku" disabled={disabled} onPress={saveEdit} />
        <V2Action label="Odustani od ispravke" kind="quiet" disabled={disabled} onPress={() => setEdit(null)} />
      </> : undefined}
    </ReviewFactRow>;
  };

  // The place mode replaces the whole review (one map at a time, no publish under the editor).
  if (locationEditor && review) return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DetailTopBar title="Mesto zadatka" backLabel="Nazad na pregled" disabled={editor.busy} onBack={closePlace} />
      {editor.error || editor.uncertain ? <View style={[s.danger, s.placeAlert]}>
        {editor.error ? <T accessibilityRole="alert" style={s.error}>{editor.error}</T> : null}
        <V2Action label="Učitaj pregled i proveri ishod" disabled={editor.busy || editor.loading} loading={editor.loading} onPress={refresh} />
      </View> : null}
      <NeedLocationForm layout="screen" reviewOnly review={locationEditor}
        resolver={resolver} busy={editor.busy} uncertain={editor.uncertain} onSave={proposeLocation} />
    </KeyboardAvoidingView>
  </SafeAreaView>;

  const summary = review ? publicSummary(review.publicProjection) : null;
  // The title leads the preview; it is corrected in place like every other fact.
  const titleFact = review?.publicProjection.find(fact => fact.key === 'need.title');
  const geography = review?.publicProjection.find(fact => fact.key === 'need.task_geography');
  const geographyMode = (geography?.value as { mode?: string } | null | undefined)?.mode;
  // A route names its stops (street and place, never a house number: owner decision 2, 2026-09-24); one place is the line above.
  const routeLines = geography && (geographyMode === 'POINT_TO_POINT' || geographyMode === 'MULTI_STOP')
    ? factReviewValue(displayFact(geography)).split('\n').slice(1) : [];
  const photoPaths = review?.publicProjection.find(fact => fact.key === 'need.public_photo_paths')?.value;
  const photoAssets = (Array.isArray(photoPaths) ? photoPaths.map(path => typeof path === 'string' ? mediaAssetId(path) : null) : [])
    .filter((assetId): assetId is string => !!assetId);
  const hasPhotos = Array.isArray(photoPaths) && photoPaths.length > 0;
  const publicRows = review?.publicProjection.filter(fact => !PUBLIC_ELSEWHERE.includes(fact.key)) ?? [];
  const todoRows: TodoRow[] = todos.map(todo => {
    const target = todo.target;
    const fact = target && target !== 'conversation' && target !== 'location'
      ? review?.publicProjection.find(item => item.key === target && item.id) : undefined;
    return { key: todo.key, text: todo.text, onPress: target === 'conversation' ? back : target === 'location' ? () => { void openLocation(); }
      : fact ? () => startEdit(fact) : undefined };
  });
  const identityBlock = unavailableIdentityFact ? <View style={s.identity}>
    <T variant="meta" tone="muted">{IDENTITY_VERIFICATION_UNAVAILABLE_COPY}</T>
    <T variant="body">U ovom pregledu je ostao uslov koji aplikacija ne može da proveri. Ukloni ga izričito da nastaviš običnim zadatkom.</T>
    {!command && unavailableIdentityFact.id ? <V2Action label="Nastavi bez uslova provere identiteta" kind="quiet"
      disabled={disabled || !!edit || !!locationEditor || deadlineEditor} onPress={removeUnavailableIdentityRequirement} /> : null}
  </View> : null;
  const quietEdit = disabled || !!edit || !!locationEditor || deadlineEditor;

  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DetailTopBar backLabel="Nazad u razgovor" onBack={back}
        title={published ? 'Objavljeno' : revising ? 'Pregled izmena' : 'Pregled zadatka'} />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View ref={content} style={s.stack}>
        {!review || !summary ? editor.loading
          ? <StateView kind="loading" title="Pripremamo pregled…" skeleton={{ count: 1, rows: 3, variant: 'preview' }} />
          : <StateView kind="error" art="document" title="Pregled nije učitan" body={editor.error ?? 'Pokušaj ponovo.'}
            primary={{ label: 'Učitaj pregled i proveri ishod', onPress: refresh, disabled: editor.busy || editor.loading }} />
        : <>
          {resultCopy ? <ReviewStatus published={!!published} fresh={!!published && publishedHere.current} text={resultCopy} /> : null}
          {command?.state === 'EVALUATED' && outcome === 'REVIEW' ? <SupportContextEntry
            reference={{ kind: 'TASK_REVIEW', id: review.reviewId, revision: null }} label="Zatraži pregled podrške"
            disabled={disabled} canAct={canAct} navigate={navigate} /> : null}
          {command ? identityBlock : null}
          <ReviewPreview summary={summary} large={large}
            unpriced={review.publicProjection.some(fact => fact.key === 'need.price_mode' && fact.status !== 'UNKNOWN')}
            action={titleFact?.id && !command && edit?.fact.key !== 'need.title' ? <V2Action label="Izmeni naslov" kind="quiet" compact
              disabled={quietEdit} onPress={() => startEdit(titleFact)} /> : null} />
          {titleFact && edit?.fact.key === 'need.title' ? row(titleFact) : null}
          {todoRows.length || (!command && unavailableIdentityFact) ? <ReviewTodoList items={todoRows} disabled={disabled || !!edit || deadlineEditor}>
            {identityBlock}
          </ReviewTodoList> : null}
          <ReviewSection title="Mesto" action={!command ? <V2Action label={review.location ? 'Uredi mesto' : 'Dodaj mesto'} kind="quiet" compact
            loading={opening} disabled={disabled || !!edit || deadlineEditor} onPress={openLocation} /> : null}>
            {openError ? <View style={s.danger}><T accessibilityRole="alert" style={s.error}>{openError}</T></View> : null}
            {snapshot?.locationConflict ? <View style={s.warn}><T accessibilityRole="alert" style={s.warnText}>
              Mesto je promenjeno posle prethodnog pregleda. Prikazano je trenutno mesto; pregledaj ga ili izmeni pre objave.
            </T></View> : null}
            <PublicPlace zone={summary.zone || null} lines={routeLines} anchor={publicAnchorPoint(review.location)}
              pointsConfirmed={!!review.location?.resolvedLocation?.points.length}
              scopeKey={`${accountId}:${review.reviewId}:preview`} />
            {review.ownerPrivateProjection.length ? <PrivatePlace>{rows(review.ownerPrivateProjection)}</PrivatePlace> : null}
          </ReviewSection>
          {publicRows.length ? <ReviewSection title="Detalji">
            <View>{rows(publicRows)}</View>
          </ReviewSection> : null}
          <ReviewSection title="Fotografije" action={!command ? <V2Action label={hasPhotos ? 'Uredi fotografije' : 'Dodaj fotografije'} kind="quiet" compact
            disabled={quietEdit}
            onPress={() => { if (!canAct() || !conversationId || edit || locationEditor || deadlineEditor) return;
              navigate(() => router.push({ pathname: '/fotografije-zadatka', params: { conversationId } })); }} /> : null}>
            <ReviewPhotos assetIds={photoAssets} />
          </ReviewSection>
          <ReviewSection title="Prijave" action={!command && !deadlineEditor ? <V2Action label="Uredi rok za prijave" kind="quiet" compact
            disabled={disabled || !!edit || !!locationEditor} onPress={() => { if (canAct()) setDeadlineEditor(true); }} /> : null}>
            {deadlineEditor ? <ResponseDeadlineEditor value={review.responseDeadline} timezone={deadlineTimezone} disabled={disabled}
              apply={value => { void proposeDeadline(value); }} cancel={() => { if (canAct()) setDeadlineEditor(false); }} />
              : <ReviewDeadline text={review.responseDeadline ? dogovorenoVreme(review.responseDeadline) : null} />}
          </ReviewSection>
        </>}
        </View>
      </ScrollView>
      {review ? <View style={s.footer}>
        {editor.error ? <T accessibilityRole="alert" style={s.error}>{editor.error}</T> : null}
        {editor.uncertain || editor.error ? <V2Action label="Učitaj pregled i proveri ishod" disabled={editor.busy || editor.loading}
          loading={editor.loading} onPress={refresh} /> : null}
        {/* After the tap there is one way forward at a time — open the published task, publish the
            saved draft, or go and change it — and that one wears the brand green; the check of the
            outcome stands beside it in white. */}
        {published && command ? <V2Action label="Otvori zadatak" style={brandAction} onPress={() => navigate(() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: command.needId } }))} />
          : command ? <>
            {/* Only one of the two green actions is ever drawn, and the editor's write in flight is that one's own. */}
            {!unavailableIdentityFact && (command.state === 'ACCEPTED' || (command.state === 'EVALUATED' && outcome === 'ALLOW')) ?
              <V2Action label={command.state === 'ACCEPTED' ? 'Objavi ovaj nacrt' : 'Nastavi istu objavu'} style={brandAction} disabled={disabled}
                loading={editor.busy} onPress={resume} /> : null}
            {((command.state === 'EVALUATED' && (evaluation?.kind === 'NOT_READY' || (outcome && outcome !== 'ALLOW')))
              || (!!unavailableIdentityFact && command.authoritative && (command.state === 'EVALUATED' || command.state === 'ACCEPTED')))
              ? <V2Action label="Izmeni zadatak" style={brandAction} disabled={disabled} loading={editor.busy} onPress={revisePublishedDraft} /> : null}
            <V2Action label={command.state === 'ACCEPTED' ? 'Proveri stanje nacrta' : 'Proveri objavu'} disabled={editor.busy || editor.loading}
              loading={editor.loading} onPress={refresh} />
            {command.state === 'ACCEPTED' ? <V2Action label="Otvori moje zadatke" kind="quiet" disabled={disabled}
              onPress={() => { if (canAct()) navigate(() => router.replace('/potrebe')); }} /> : null}
          </> : <>
            <PublishButton label={acceptLabel} blocked={publishBlocked} working={publishWorking} reason={caption} onPress={publish} />
            <T accessibilityLiveRegion="polite" style={s.caption}>{caption}</T>
            {/* A new task only: accepting an edit of an existing one confirms that edit, which is not a draft. */}
            {!revising && review.canAccept && !unavailableIdentityFact ? <V2Action label="Sačuvaj nacrt" kind="quiet"
              disabled={quietEdit} onPress={() => { void accept(false); }} /> : null}
          </>}
      </View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Facts whose editor is the place step. */
const PLACE_KEYS: readonly NeedFactV2Key[] = ['need.task_country_code', 'need.task_geography', 'need.exact_address', 'need.access_notes', 'need.resolved_location'];
/** Public facts drawn elsewhere on the review (the title and value in the preview, the place in Mesto, the photos in
 *  Fotografije) or never shown (the category). Their editors stay reachable from those sections. */
const PUBLIC_ELSEWHERE: readonly NeedFactV2Key[] = ['need.category', 'need.title', 'need.public_photo_paths', 'need.task_geography', 'need.task_country_code'];
