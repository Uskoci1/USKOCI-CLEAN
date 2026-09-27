import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationReview } from '../../contracts/location';
import type { NeedTaskGeography } from '../../contracts/needFactsV2';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import { locationSlots } from '../../lib/location';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action as Button } from '../v2/V2Action';
import { LocationPointEditor } from './LocationPointEditor';
import { useConfirmSheet } from '../system/ConfirmSheet';
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
  // The private exact address belongs to where the work starts, so it seeds only that point.
  if (slot === 'start' && value.exactAddress) return value.exactAddress;
  const place = slot === 'start' ? geography?.start
    : slot === 'end' ? geography?.end
      : slot === 'serviceArea' ? geography?.serviceArea
        : geography?.waypoints?.[Number(slot.slice('waypoints/'.length))];
  return [place?.area, place?.city].filter(part => typeof part === 'string' && part.trim()).join(', ');
};

type State =
  | { kind: 'LOADING' }
  | { kind: 'FAILED'; message: string; review?: NeedLocationReview }
  | { kind: 'READY'; review: NeedLocationReview }
  | { kind: 'SAVING'; review: NeedLocationReview }
  | { kind: 'SAVED' };

export function ConversationPointAsk(props: { conversationId: string; onSaved: () => void; onClose: () => void }) {
  const { user, accountRevision } = useSesija();
  return <OwnedPointAsk key={`${user?.id}:${accountRevision}:${props.conversationId}`} {...props}
    accountId={user?.id} accountRevision={accountRevision} />;
}

function OwnedPointAsk(props: { conversationId: string; onSaved: () => void; onClose: () => void;
  accountId: string | undefined; accountRevision: number }) {
  // Without this the point editor falls back to an unconfigured resolver, which answers
  // PROVIDER_ACTIVATION_BLOCKED without making a request at all: the search never leaves the
  // device, no candidate arrives, no pin is placed, and the map sits at [0,0] zoom 1 showing
  // half the world. The long form has always passed this; the conversation must too.
  const resolver = useMemo(() => createProductionLocationResolver(), [props.conversationId]);
  useEffect(() => () => resolver.cancel(), [resolver]);
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const [points, setPoints] = useState<readonly ConfirmedLocationPoint[]>([]);
  const [selected, setSelected] = useState<LocationSlot | null>(null);
  const [pendingSlot, setPendingSlot] = useState<LocationSlot | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [focusVisit, setFocusVisit] = useState<object | null>(null);
  const focused = focusVisit !== null;
  const focus = useRef(false), focusEpoch = useRef(0), saving = useRef(false), loadEpoch = useRef(0);
  const view = useRef<object | null>(null);
  const renderedView = useMemo(() => ({}), [state, points, selected, pendingSlot, editorEpoch, focusVisit]); view.current = renderedView;
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
    && view.current === renderedView && !saving.current;

  const load = useCallback(async () => {
    if (!ownsAccount() || saving.current) return;
    const epoch = ++loadEpoch.current;
    setState({ kind: 'LOADING' });
    const result = await needLocationClientService.read(props.conversationId).catch(() => ({ ok: false as const,
      kod: 'NEED_LOCATION_READ_FAILED', poruka: 'Mesto nije učitano. Pokušaj ponovo.' }));
    if (!ownsAccount() || epoch !== loadEpoch.current) return;
    if (!result.ok) { setState({ kind: 'FAILED', message: result.poruka }); return; }
    setPoints(result.podatak.value.resolvedLocation?.points ?? []);
    setSelected(null); setPendingSlot(null); setEditorEpoch(value => value + 1);
    setState({ kind: 'READY', review: result.podatak });
  }, [props.conversationId, ownsAccount]);
  useEffect(() => { void load(); }, [load]);

  const review = state.kind === 'READY' || state.kind === 'SAVING' ? state.review : state.kind === 'FAILED' ? state.review ?? null : null;
  const country = review?.value.taskCountryCode ?? null;
  const geography = review?.value.geography ?? null;
  const slots = geography ? locationSlots(geography) : [];
  const placed = new Set(points.map(point => point.slot));
  const next = slots.find(slot => !placed.has(slot));
  const activeSlot = selected && slots.includes(selected) ? selected : next ?? slots[0];

  const commit = useCallback(async (all: readonly ConfirmedLocationPoint[], current: NeedLocationReview) => {
    if (!ownsAccount() || !focus.current || saving.current || !current.editable
      || current.accountId !== props.accountId || current.conversationId !== props.conversationId) return;
    if (!current.value.taskCountryCode || !current.value.geography) {
      setState({ kind: 'FAILED', message: 'Zadatku još fali država ili mesto. Dopuni ih u razgovoru pa se vrati.' });
      return;
    }
    saving.current = true;
    const visit = focusEpoch.current;
    setState({ kind: 'SAVING', review: current });
    const result = await needLocationClientService.save({
      conversationId: props.conversationId, expectedRevision: current.revision, confirmed: true,
      value: {
        taskCountryCode: current.value.taskCountryCode,
        geography: current.value.geography,
        exactAddress: current.value.exactAddress,
        accessNotes: current.value.accessNotes,
        resolvedLocation: { version: 1, points: all,
          binding: { taskCountryCode: current.value.taskCountryCode, geography: current.value.geography,
            exactAddress: current.value.exactAddress } },
      },
    }).catch(() => ({ ok: false as const, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED',
      poruka: 'Čuvanje mesta nije potvrđeno. Potvrđene tačke su ostale za ponovni pokušaj.' }));
    saving.current = false;
    if (!ownsAccount()) return;
    if (!result.ok) { setState({ kind: 'FAILED', message: result.poruka, review: current }); return; }
    setState({ kind: 'SAVED' });
    if (focus.current && focusEpoch.current === visit) props.onSaved();
  }, [props, ownsAccount]);

  // Each point is confirmed by hand. The last one commits, because a confirmation the person
  // then has to remember to save is a confirmation that gets lost.
  const confirm = (point: ConfirmedLocationPoint) => {
    if (!canAct() || state.kind !== 'READY' || !review?.editable || point.slot !== activeSlot || !slots.includes(point.slot)) return;
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

  // Leaving with a point confirmed but not yet committed threw it away without a word. Only the
  // last point of a set commits, so on a two-point task that is exactly what "Kasnije" did.
  const leave = () => {
    if (!canAct()) return;
    if (!points.length || state.kind === 'SAVED') { props.onClose(); return; }
    // A route with stops can hold several confirmed points when the person leaves; the words follow the number.
    const one = points.length === 1;
    confirmation.ask({ title: one ? 'Potvrđena tačka nije sačuvana' : 'Potvrđene tačke nisu sačuvane',
      // One voice without grammatical gender (owner, 2026-09-23): the point is confirmed, not "potvrdio si".
      message: one
        ? 'Tačka je potvrđena, ali mesto se čuva tek kad potvrdiš sve tačke. Ako sad izađeš, ova tačka se gubi.'
        : 'Tačke su potvrđene, ali mesto se čuva tek kad potvrdiš sve tačke. Ako sad izađeš, ove tačke se gube.',
      cancelLabel: 'Nastavi potvrđivanje', confirmLabel: 'Izađi ipak', tone: 'danger', onConfirm: () => { if (canAct()) props.onClose(); } });
  };

  if (state.kind === 'LOADING') return <T accessibilityLiveRegion="polite" tone="muted">Otvaramo mesto zadatka…</T>;
  if (state.kind === 'SAVED') return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="success">Mesto je sačuvano.</T>
    <Button kind="primary" label="Nazad u razgovor" onPress={props.onClose} />
  </View>;
  // A failed save used to offer a reload, which re-read the server over the pins the person had
  // just placed by hand: the work that is hardest to get was the work least protected. The points
  // stay in state, and the retry sends the same ones again.
  if (state.kind === 'FAILED') return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="danger">{state.message}</T>
    {points.length ? <T variant="meta" tone="muted">Tvoje potvrđene tačke nisu izgubljene.</T> : null}
    {points.length && review ? <Button label="Sačuvaj ponovo" onPress={() => { if (canAct()) void commit(points, review); }} /> : null}
    {points.length
      // `load()` puts the saved place back over the points on screen, so the saved place is what replaces.
      ? <Button kind="quiet" label="Učitaj sačuvano mesto" onPress={() => confirmation.ask({ title: 'Učitaj sačuvano mesto?',
        message: 'Poslednje sačuvano mesto zameniće potvrđene tačke koje još nisu sačuvane.',
        cancelLabel: 'Odustani', confirmLabel: 'Učitaj', tone: 'danger', onConfirm: () => { if (canAct()) void load(); } })} />
      : <Button kind="quiet" label="Pokušaj ponovo" onPress={() => { if (canAct()) void load(); }} />}
    <Button kind="quiet" label="Zatvori" onPress={leave} />
    {confirmation.sheet}
  </View>;

  // The thread asks for the point from the geography alone, which never looks at the country, so a
  // draft with no country yet met "Fali još mesto na mapi" and, two lines below, "nije potrebno".
  // A missing country is a question for the conversation, not a statement about the task.
  if (review && geography && slots.length && !country) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Prvo reci u kojoj je državi zadatak — bez toga mapa ne zna gde da traži.</T>
    <Button kind="primary" label="Reci u razgovoru" onPress={props.onClose} />
  </View>;
  if (!review || !country || !geography || !slots.length) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Za ovaj zadatak mesto na mapi nije potrebno.</T>
    <Button kind="quiet" label="Zatvori" onPress={props.onClose} />
  </View>;

  if (!review.editable) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Ovaj razgovor je već sačuvan. Otvori njegov zadatak da izmeniš mesto.</T>
    <Button kind="quiet" label="Zatvori" onPress={props.onClose} />
  </View>;

  return <View style={{ gap: 14 }}>
    <T accessibilityRole="header" variant="title">Gde tačno?</T>
    <T tone="muted">Ovo vidi samo onaj s kim se dogovoriš. Kad se pin pojavi, potvrdi ga ili ga prevuci na tačno mesto.</T>
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {slots.map(slot => {
        const pending = pendingSlot === slot;
        const status = pending ? 'Čeka potvrdu' : placed.has(slot) ? 'Potvrđeno' : 'Nije potvrđeno';
        const label = title(slot, geography), place = points.find(point => point.slot === slot)?.address || seed(slot, review.value);
        return <Press key={slot} accessibilityRole="radio" accessibilityLabel={`${label}${place ? `, ${place}` : ''}, ${status}`}
          accessibilityState={{ selected: slot === activeSlot, disabled: state.kind === 'SAVING' || !focused }}
          disabled={state.kind === 'SAVING' || !focused} onPress={() => select(slot)} haptic="select"
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
    </View>
    {state.kind === 'SAVING' ? <T accessibilityLiveRegion="polite" tone="muted">Čuvam mesto…</T> : null}
    {activeSlot ? <LocationPointEditor key={`${editorEpoch}:${activeSlot}`} slot={activeSlot} title={title(activeSlot, geography)}
      point={points.find(point => point.slot === activeSlot)} scopeKey={`${props.accountId}:${props.accountRevision}:${review.conversationId}:${review.revision}:${editorEpoch}`}
      countryCode={country} initialQuery={seed(activeSlot, review.value)} autoLocate resolver={resolver}
      disabled={state.kind === 'SAVING' || !focused} onInvalidate={() => {
        if (canAct() && state.kind === 'READY') setPendingSlot(activeSlot);
      }} onConfirm={confirm} /> : null}
    <Button kind="quiet" label="Kasnije" disabled={state.kind === 'SAVING'} onPress={leave} />
    {confirmation.sheet}
  </View>;
}

// A default export so the conversation can load this lazily and keep the native map,
// which this module reaches through LocationPointEditor, out of its own module graph.
export default ConversationPointAsk;
