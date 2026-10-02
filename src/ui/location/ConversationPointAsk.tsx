import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { BackHandler, View } from 'react-native';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationReview } from '../../contracts/location';
import type { NeedTaskGeography } from '../../contracts/needFactsV2';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action as Button } from '../v2/V2Action';
import { LocationPointEditor, type PointReplyActions } from './LocationPointEditor';
import { LocationMapPreview } from './LocationMapPreview';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';

/**
 * The conversation asks for the map point instead of waiting for the person to discover a form.
 *
 * `need.resolved_location` is `manualOnly`, so only a person may create it and the AI may not
 * even propose it. Publishing, meanwhile, refuses without it. Before this existed the only bridge
 * was a long form reached through the review card, and across three real drafts it was never once
 * completed. Nothing about who may confirm a point changes here: every point is still confirmed by
 * hand. Only the route changes, from a buried form to one step where the answer already is.
 *
 * What the conversation already knows seeds the search, so the pin arrives standing on the address
 * the person said out loud rather than on an empty map.
 */

const title = (slot: LocationSlot, geography: NeedTaskGeography | null): string => {
  if (slot === 'start') return geography?.mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište';
  if (slot === 'end') return 'Odredište';
  if (slot === 'serviceArea') return 'Područje rada';
  return `Stanica ${Number(slot.slice('waypoints/'.length)) + 1}`;
};

/** The most precise thing already known for this slot, used only as a search seed. */
const seed = (slot: LocationSlot, value: NeedLocationReview['value']): string => {
  const geography = value.geography;
  const place = slot === 'start' ? geography?.start
    : slot === 'end' ? geography?.end
      : slot === 'serviceArea' ? geography?.serviceArea
        : geography?.waypoints?.[Number(slot.slice('waypoints/'.length))];
  // A street alone can resolve in another city. Keep the already-known locality
  // with the start's private address; never copy that address into another slot.
  const parts = [slot === 'start' ? value.exactAddress : null, place?.label, place?.area, place?.city]
    .flatMap(part => typeof part === 'string' ? part.split(',') : []).map(part => part.trim()).filter(Boolean);
  return parts.filter((part, index) => parts.findIndex(other => other.toLocaleLowerCase() === part.toLocaleLowerCase()) === index).join(', ');
};

/** A manually confirmed coordinate is not a resolved address; the conversation seed stays separate. */
const confirmedPointLabel = (point: ConfirmedLocationPoint, value: NeedLocationReview['value']): string =>
  point.address || (point.origin.kind === 'MANUAL_PIN' ? 'Tačka potvrđena na mapi'
    : seed(point.slot, value) || 'Tačka potvrđena na mapi');

type State =
  | { kind: 'LOADING' }
  | { kind: 'FAILED'; message: string; review?: NeedLocationReview }
  | { kind: 'READY'; review: NeedLocationReview }
  | { kind: 'SAVING'; review: NeedLocationReview }
  | { kind: 'SAVED'; review: NeedLocationReview };

type Props = { conversationId: string; onSaved: () => void; onClose: () => void;
  disabled?: boolean; onEditingChange?: (editing: boolean) => void;
  onReplyActionsReady?: (actions: PointReplyActions | null) => void;
  onCloseRequestReady?: (handler: (() => void) | null) => void };

const savedPoints = (value: NeedLocationReview['value']) => normalizeNeedLocation(value)?.resolvedLocation?.points ?? [];
const pointKey = (point: ConfirmedLocationPoint) => JSON.stringify([point.latitudeE6, point.longitudeE6,
  point.address ?? null, point.accessNotes ?? null, point.origin.kind,
  point.origin.kind === 'PROVIDER_CANDIDATE' ? [point.origin.providerHint, point.origin.candidateHint] : null]);

export function ConversationPointAsk(props: Props) {
  const { user, accountRevision } = useSesija();
  return <OwnedPointAsk key={`${user?.id}:${accountRevision}:${props.conversationId}`} {...props}
    accountId={user?.id} accountRevision={accountRevision} />;
}

function OwnedPointAsk(props: Props & { accountId: string | undefined; accountRevision: number }) {
  // Without this the point editor falls back to an unconfigured resolver, which answers
  // PROVIDER_ACTIVATION_BLOCKED without making a request at all: the search never leaves the
  // device, no candidate arrives, no pin is placed, and the map sits at [0,0] zoom 1 showing
  // half the world. The long form has always passed this; the conversation must too.
  const resolver = useMemo(() => createProductionLocationResolver(), [props.conversationId]);
  useEffect(() => () => resolver.cancel(), [resolver]);
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const [points, setPoints] = useState<readonly ConfirmedLocationPoint[]>([]);
  const baseline = useRef<readonly ConfirmedLocationPoint[]>([]);
  const [editing, setEditing] = useState(false);
  const [summaryMapOpen, setSummaryMapOpen] = useState(false);
  const [selected, setSelected] = useState<LocationSlot | null>(null);
  const [pendingSlot, setPendingSlot] = useState<LocationSlot | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [focusVisit, setFocusVisit] = useState<object | null>(null);
  const focused = focusVisit !== null;
  const focus = useRef(false), focusEpoch = useRef(0), saving = useRef(false), loadEpoch = useRef(0);
  const disabled = useRef(props.disabled); disabled.current = props.disabled;
  const latestState = useRef(state); latestState.current = state;
  const editingChanged = useRef(props.onEditingChange); editingChanged.current = props.onEditingChange;
  const reportedEditing = useRef<boolean | null>(null);
  const reportEditing = useCallback((value: boolean) => {
    if (reportedEditing.current === value) return;
    reportedEditing.current = value; editingChanged.current?.(value);
  }, []);
  const closeRequestChanged = useRef(props.onCloseRequestReady); closeRequestChanged.current = props.onCloseRequestReady;
  const editorReplies = useRef<PointReplyActions | null>(null);
  const [replyCapabilities, setReplyCapabilities] = useState({ confirm: false, correct: false });
  const registerEditorReplies = useCallback((actions: PointReplyActions | null) => {
    editorReplies.current = actions;
    const confirm = !!actions?.confirm, correct = !!actions?.correct;
    setReplyCapabilities(previous => previous.confirm === confirm && previous.correct === correct ? previous : { confirm, correct });
  }, []);
  const replyChanged = useRef(props.onReplyActionsReady); replyChanged.current = props.onReplyActionsReady;

  const view = useRef<object | null>(null);
  const renderedView = useMemo(() => ({}), [state, points, selected, pendingSlot, editorEpoch, focusVisit, editing, summaryMapOpen, props.disabled]); view.current = renderedView;
  const renderedFocus = focusEpoch.current;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const confirmation = useConfirmSheet(), closeConfirmation = confirmation.close;
  const ownsAccount = useCallback(() => alive.current && !!props.accountId
    && sesijaSada().user?.id === props.accountId && sesijaSada().accountRevision === props.accountRevision,
  [props.accountId, props.accountRevision]);
  useFocusEffect(useCallback(() => {
    focus.current = true; focusEpoch.current++; setFocusVisit({});
    return () => { focus.current = false; focusEpoch.current++; view.current = null; setFocusVisit(null); resolver.cancel(); closeConfirmation(); };
  }, [resolver, closeConfirmation]));
  const canAct = () => ownsAccount() && focus.current && renderedFocus === focusEpoch.current
    && view.current === renderedView && !saving.current && !disabled.current && !props.disabled;

  const load = useCallback(async () => {
    if (!ownsAccount() || saving.current || disabled.current) return;
    const epoch = ++loadEpoch.current;
    view.current = null;
    setState({ kind: 'LOADING' }); setSummaryMapOpen(false);
    const result = await needLocationClientService.read(props.conversationId).catch(() => ({ ok: false as const,
      kod: 'NEED_LOCATION_READ_FAILED', poruka: 'Mesto nije učitano. Pokušaj ponovo.' }));
    if (!ownsAccount() || disabled.current || epoch !== loadEpoch.current) return;
    if (!result.ok) { setState({ kind: 'FAILED', message: result.poruka }); return; }
    const loaded = savedPoints(result.podatak.value);
    baseline.current = loaded; setPoints(loaded);
    const required = result.podatak.value.geography ? locationSlots(result.podatak.value.geography) : [];
    const incomplete = required.some(slot => !loaded.some(point => point.slot === slot));
    // The parent's send/review callbacks must stop immediately, before passive effects run.
    if (incomplete && result.podatak.editable && result.podatak.value.taskCountryCode && focus.current) reportEditing(true);
    setEditing(incomplete);
    setSelected(null); setPendingSlot(null); setEditorEpoch(value => value + 1);
    setState({ kind: 'READY', review: result.podatak });
  }, [props.conversationId, ownsAccount, reportEditing]);
  useEffect(() => {
    if (props.disabled) { loadEpoch.current++; resolver.cancel(); closeConfirmation(); }
    else if (latestState.current.kind === 'LOADING') void load();
  }, [load, props.disabled, resolver, closeConfirmation]);

  const review = state.kind === 'READY' || state.kind === 'SAVING' || state.kind === 'SAVED'
    ? state.review : state.kind === 'FAILED' ? state.review ?? null : null;
  const country = review?.value.taskCountryCode ?? null;
  const geography = review?.value.geography ?? null;
  const slots = geography ? locationSlots(geography) : [];
  const placed = new Set(points.map(point => point.slot));
  const next = slots.find(slot => !placed.has(slot));
  const activeSlot = selected && slots.includes(selected) ? selected : next ?? slots[0];
  const dirtyPoints = points.filter(point => {
    const previous = baseline.current.find(saved => saved.slot === point.slot);
    return !previous || pointKey(previous) !== pointKey(point);
  });
  const editingDecision = focused && !props.disabled && ((state.kind === 'READY' && editing && !!review?.editable && !!country && !!slots.length)
    || state.kind === 'SAVING' || (state.kind === 'FAILED' && !!review && points.length > 0));
  useEffect(() => { reportEditing(editingDecision); }, [editingDecision, reportEditing]);
  useEffect(() => () => { reportedEditing.current = false; editingChanged.current?.(false); }, []);

  const commit = useCallback(async (all: readonly ConfirmedLocationPoint[], current: NeedLocationReview) => {
    if (!ownsAccount() || !focus.current || saving.current || disabled.current || !current.editable
      || current.accountId !== props.accountId || current.conversationId !== props.conversationId) return;
    if (!current.value.taskCountryCode || !current.value.geography) {
      setState({ kind: 'FAILED', message: 'Zadatku još fali država ili mesto. Dopuni ih u razgovoru pa se vrati.' });
      return;
    }
    saving.current = true;
    const visit = focusEpoch.current;
    // A stationary task has one private address. Keep it aligned with the exact
    // point the person just confirmed, including an explicitly unresolved address.
    // Route/area-wide private text is not replaced by one of its component points.
    const start = all.find(point => point.slot === 'start');
    const savedStart = baseline.current.find(point => point.slot === 'start');
    const changedStart = start && (!savedStart || pointKey(start) !== pointKey(savedStart));
    const exactAddress = current.value.geography.mode === 'STATIONARY' && changedStart
      ? start.address?.trim() || null : current.value.exactAddress;
    setState({ kind: 'SAVING', review: current });
    const result = await needLocationClientService.save({
      conversationId: props.conversationId, expectedRevision: current.revision, confirmed: true,
      value: {
        taskCountryCode: current.value.taskCountryCode,
        geography: current.value.geography,
        exactAddress,
        accessNotes: current.value.accessNotes,
        resolvedLocation: { version: 1, points: all,
          binding: { taskCountryCode: current.value.taskCountryCode, geography: current.value.geography,
            exactAddress } },
      },
    }).catch(() => ({ ok: false as const, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED',
      poruka: 'Čuvanje mesta nije potvrđeno. Potvrđene tačke su ostale za ponovni pokušaj.' }));
    saving.current = false;
    if (!ownsAccount()) return;
    if (!result.ok) { setState({ kind: 'FAILED', message: result.poruka, review: current }); return; }
    const saved = result.podatak.review, confirmed = savedPoints(saved.value);
    baseline.current = confirmed; setPoints(confirmed); setPendingSlot(null); setSelected(null); setEditing(false); setSummaryMapOpen(false);
    setState({ kind: 'SAVED', review: saved });
    if (focus.current && focusEpoch.current === visit) props.onSaved();
  }, [props, ownsAccount]);

  // Each point is confirmed by hand. The last one commits, because a confirmation the person
  // then has to remember to save is a confirmation that gets lost.
  const confirm = (point: ConfirmedLocationPoint) => {
    if (!canAct() || !editing || state.kind !== 'READY' || !review?.editable || point.slot !== activeSlot || !slots.includes(point.slot)) return;
    view.current = null;
    const all = [...points.filter(existing => existing.slot !== point.slot), point];
    const complete = slots.every(slot => all.some(existing => existing.slot === slot));
    setPoints(all); setPendingSlot(null); setSelected(complete ? point.slot : null);
    if (complete) void commit(all, review);
  };

  const select = (slot: LocationSlot) => {
    if (!canAct() || state.kind !== 'READY' || !review?.editable || !slots.includes(slot) || slot === activeSlot) return;
    const open = () => {
      if (!canAct()) return;
      view.current = null; resolver.cancel();
      setSelected(slot); setPendingSlot(null); setEditorEpoch(value => value + 1);
    };
    if (pendingSlot) confirmation.ask({ title: 'Izmena tačke nije potvrđena',
      message: 'Ako pređeš na drugu tačku, ova izmena se odbacuje. Prethodno potvrđene tačke ostaju.',
      cancelLabel: 'Nastavi uređivanje', confirmLabel: 'Pređi na drugu tačku', onConfirm: open });
    else open();
  };

  // A loaded point is already on the server. Warn only about work performed during this visit,
  // including a draft that the point editor has not handed back as a confirmation yet.
  const leave = () => {
    if (!canAct()) return;
    const close = () => { if (canAct()) { view.current = null; reportEditing(false); props.onClose(); } };
    if ((!dirtyPoints.length && !pendingSlot) || state.kind === 'SAVED') { close(); return; }
    if (pendingSlot || baseline.current.length) {
      confirmation.ask({ title: dirtyPoints.length ? 'Izmene mesta nisu sačuvane' : 'Izmena tačke nije potvrđena',
        message: `${dirtyPoints.length
          ? 'Ako sad izađeš, izmene koje još nisu sačuvane se odbacuju.'
          : 'Ako sad izađeš, nepotvrđena izmena se odbacuje.'}${baseline.current.length ? ' Sačuvane tačke ostaju.' : ''}`,
        cancelLabel: 'Nastavi uređivanje', confirmLabel: 'Izađi ipak', tone: 'danger', onConfirm: close });
      return;
    }
    const one = dirtyPoints.length === 1;
    confirmation.ask({ title: one ? 'Potvrđena tačka nije sačuvana' : 'Potvrđene tačke nisu sačuvane',
      // One voice without grammatical gender (owner, 2026-09-23): the point is confirmed, not "potvrdio si".
      message: one
        ? 'Tačka je potvrđena, ali mesto se čuva tek kad potvrdiš sve tačke. Ako sad izađeš, ova tačka se gubi.'
        : 'Tačke su potvrđene, ali mesto se čuva tek kad potvrdiš sve tačke. Ako sad izađeš, ove tačke se gube.',
      cancelLabel: 'Nastavi potvrđivanje', confirmLabel: 'Izađi ipak', tone: 'danger', onConfirm: close });
  };

  const inactive = !!props.disabled || !focused;
  const requestClose = useRef(leave); requestClose.current = leave;
  useEffect(() => {
    if (!editingDecision || inactive) { closeRequestChanged.current?.(null); return; }
    let active = true;
    const close = () => { if (active) requestClose.current(); };
    closeRequestChanged.current?.(close);
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active || disabled.current || !focus.current || !ownsAccount()) return false;
      close(); return true;
    });
    return () => { active = false; subscription.remove(); closeRequestChanged.current?.(null); };
  }, [editingDecision, inactive, ownsAccount]);
  const summaryPoints = review ? savedPoints(review.value) : [];
  const completeSummary = slots.length > 0 && slots.every(slot => summaryPoints.some(point => point.slot === slot));
  const editSaved = () => {
    if (!canAct() || !review?.editable || editing || !completeSummary) return false;
    view.current = null; setSummaryMapOpen(false); reportEditing(true); setEditing(true); setState({ kind: 'READY', review });
    return true;
  };
  const replyScope = slots.length === 1 && !!country && !!review?.editable && !inactive
    && (state.kind === 'READY' || state.kind === 'SAVED');
  const runEditorReply = (kind: keyof PointReplyActions) => {
    if (!replyScope || !canAct() || !editing || state.kind !== 'READY') return false;
    const action = editorReplies.current?.[kind];
    if (!action || !action()) return false;
    editorReplies.current = null; replyChanged.current?.(null);
    return true;
  };
  useEffect(() => {
    replyChanged.current?.(!replyScope ? null : editing && state.kind === 'READY'
      ? { ...(replyCapabilities.confirm ? { confirm: () => runEditorReply('confirm') } : {}),
          ...(replyCapabilities.correct ? { correct: () => runEditorReply('correct') } : {}) }
      : completeSummary ? { correct: editSaved } : null);
  });
  useEffect(() => () => replyChanged.current?.(null), []);

  if (state.kind === 'LOADING') return <T accessibilityLiveRegion="polite" tone="muted">Otvaramo mesto zadatka…</T>;
  // A failed save used to offer a reload, which re-read the server over the pins the person had
  // just placed by hand: the work that is hardest to get was the work least protected. The points
  // stay in state, and the retry sends the same ones again.
  if (state.kind === 'FAILED') return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="danger">{state.message}</T>
    {points.length ? <T variant="meta" tone="muted">Tvoje potvrđene tačke nisu izgubljene.</T> : null}
    {points.length && review ? <Button label="Sačuvaj ponovo" disabled={inactive} onPress={() => { if (canAct()) void commit(points, review); }} /> : null}
    {points.length
      // `load()` puts the saved place back over the points on screen, so the saved place is what replaces.
      ? <Button kind="quiet" label="Učitaj sačuvano mesto" disabled={inactive} onPress={() => { if (canAct()) confirmation.ask({ title: 'Učitaj sačuvano mesto?',
        message: 'Poslednje sačuvano mesto zameniće potvrđene tačke koje još nisu sačuvane.',
        cancelLabel: 'Odustani', confirmLabel: 'Učitaj', tone: 'danger', onConfirm: () => { if (canAct()) void load(); } }); }} />
      : <Button kind="quiet" label="Pokušaj ponovo" disabled={inactive} onPress={() => { if (canAct()) void load(); }} />}
    <Button kind="quiet" label="Zatvori" disabled={inactive} onPress={leave} />
    {confirmation.sheet}
  </View>;

  // The thread asks for the point from the geography alone, which never looks at the country, so a
  // draft with no country yet met "Fali još mesto na mapi" and, two lines below, "nije potrebno".
  // A missing country is a question for the conversation, not a statement about the task.
  if (review && geography && slots.length && !country) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Prvo reci u kojoj je državi zadatak — bez toga mapa ne zna gde da traži.</T>
    <Button kind="primary" label="Reci u razgovoru" disabled={inactive} onPress={leave} />
  </View>;
  if (!review || !country || !geography || !slots.length) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Za ovaj zadatak mesto na mapi nije potrebno.</T>
    <Button kind="quiet" label="Zatvori" disabled={inactive} onPress={leave} />
  </View>;

  if (!editing && completeSummary) return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <FactArt kind="check" size={24} cut="art" role="confirmed" />
      </View>
      <T accessibilityRole={state.kind === 'SAVED' ? 'alert' : 'header'} variant="bodyStrong" style={{ flex: 1 }}>
        {state.kind === 'SAVED' ? 'Mesto je sačuvano.' : 'Mesto na mapi je potvrđeno.'}
      </T>
    </View>
    {summaryPoints.map(point => {
      const description = point.origin.kind === 'MANUAL_PIN' && !point.address ? seed(point.slot, review.value) : '';
      return <View key={point.slot} style={{ gap: 4 }}>
        {slots.length > 1 ? <T variant="bodyStrong">{title(point.slot, geography)}</T> : null}
        <T variant="note" tone="muted">{confirmedPointLabel(point, review.value)}</T>
        {description ? <T variant="note" tone="muted">Opis iz razgovora: {description}</T> : null}
      </View>;
    })}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button tone="neutral" kind="quiet" compact style={{ minHeight: 48, flexShrink: 1 }}
        label={summaryMapOpen ? 'Sakrij mapu' : 'Prikaži mapu'} disabled={inactive} onPress={() => {
          if (!canAct()) return;
          view.current = null; setSummaryMapOpen(open => !open);
        }} />
      {review.editable ? <Button tone="neutral" kind="quiet" compact style={{ minHeight: 48, flexShrink: 1 }}
        label="Izmeni" accessibilityLabel="Nije tu? Izmeni mesto" disabled={inactive} onPress={editSaved} /> : null}
    </View>
    {summaryMapOpen && !inactive ? <LocationMapPreview scopeKey={`${props.accountId}:${props.accountRevision}:${review.conversationId}:${review.revision}`}
      points={summaryPoints.map(point => ({ id: point.slot,
        label: `${title(point.slot, geography)}: ${confirmedPointLabel(point, review.value)}`,
        latitude: point.latitudeE6 / 1_000_000, longitude: point.longitudeE6 / 1_000_000 }))}
      route={geography.mode === 'POINT_TO_POINT' || geography.mode === 'MULTI_STOP'} /> : null}
    {summaryMapOpen ? <Button tone="neutral" kind="quiet" label="Zatvori pregled mesta" disabled={inactive} onPress={leave} /> : null}
  </View>;

  if (!review.editable) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Ovaj razgovor je već sačuvan. Otvori njegov zadatak da izmeniš mesto.</T>
    <Button kind="quiet" label="Zatvori" disabled={inactive} onPress={leave} />
  </View>;

  return <View style={{ gap: 14 }}>
    {slots.length > 1 ? <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {slots.map(slot => {
        const pending = pendingSlot === slot;
        const status = pending ? 'Čeka potvrdu' : placed.has(slot) ? 'Potvrđeno' : 'Nije potvrđeno';
        const label = title(slot, geography), place = points.find(point => point.slot === slot)?.address || seed(slot, review.value);
        return <Press key={slot} accessibilityRole="radio" accessibilityLabel={`${label}${place ? `, ${place}` : ''}, ${status}`}
          accessibilityState={{ selected: slot === activeSlot, disabled: state.kind === 'SAVING' || inactive }}
          disabled={state.kind === 'SAVING' || inactive} onPress={() => select(slot)} haptic="select"
          style={{ minHeight: 56, padding: 12, gap: 4, borderRadius: sys.radius.control, borderWidth: 1,
            borderColor: slot === activeSlot ? sys.color.green : sys.color.line,
            backgroundColor: slot === activeSlot ? sys.color.greenSoft : sys.color.surface }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <T variant="bodyStrong" style={{ flex: 1 }}>{label}</T>
            <T variant="note" style={{ flexShrink: 1 }} tone={placed.has(slot) && !pending ? 'success' : 'muted'}>{status}</T>
          </View>
          {place ? <T variant="note" tone="muted">{place}</T> : null}
        </Press>;
      })}
    </View> : null}
    {state.kind === 'SAVING' ? <T accessibilityLiveRegion="polite" tone="muted">Čuvam mesto…</T> : null}
    {activeSlot ? <LocationPointEditor key={`${editorEpoch}:${activeSlot}`} slot={activeSlot} title={title(activeSlot, geography)}
      point={points.find(point => point.slot === activeSlot)} scopeKey={`${props.accountId}:${props.accountRevision}:${review.conversationId}:${review.revision}:${editorEpoch}`}
      countryCode={country} initialQuery={seed(activeSlot, review.value)} autoLocate={!inactive} resolver={resolver}
      presentation="conversation" onCorrectInConversation={leave}
      onReplyActionsReady={slots.length === 1 ? registerEditorReplies : undefined}
      disabled={state.kind === 'SAVING' || inactive} onInvalidate={() => {
        if (canAct() && state.kind === 'READY') setPendingSlot(activeSlot);
      }} onConfirm={confirm} /> : null}
    <Button kind="quiet" label={completeSummary ? 'Zatvori' : 'Kasnije'} disabled={state.kind === 'SAVING' || inactive} onPress={leave} />
    {confirmation.sheet}
  </View>;
}

// A default export so the conversation can load this lazily and keep the native map,
// which this module reaches through LocationPointEditor, out of its own module graph.
export default ConversationPointAsk;
