import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Check, MagnifyingGlass, Minus, Plus, X } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryItems, placeKey, placeSuggestions, PLACES_MAX, remoteDiscoveryScope, saysWorkMode, serbianToday, undatedCount,
  type DateRange, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { discoveryV1SearchPreviewKey, type DiscoveryV1SearchSnapshot } from '../../../data/discoveryV1SearchOwner';
import { Press } from '../../Press';
import { T } from '../../Text';
import { withInter } from '../../interFont';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { TurningCaret } from '../../system/Disclosure';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { osoba, zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { CHIP_CHOSEN_INSET, brandAction, chipChosen, fieldBox, floating, sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { DateRangeGrid } from './DateRangeGrid';
import { CLEAR_ALL, PRICE, WHEN, WHERE, said, undatedWords, whenWords, whereWords } from './discoveryWords';

/** Everything the search panel chooses, as a draft: nothing reaches the list before "Prikaži N zadataka". */
export type SearchDraft = { query: string; place: string | null; area: PublicBounds | null;
  /** One public point the list is narrowed to (a place's "Prikaži sve u listi"); any other "Gde" choice replaces it. */
  pinPlace: string | null;
  when: WhenFilter; dates: DateRange | null; where: WhereFilter; places: number; price: MarketplaceView['price'] };
export const NO_SEARCH: SearchDraft = { query: '', place: null, area: null, pinPlace: null, when: 'any', dates: null, where: 'any', places: 1, price: 'all' };
export const draftOf = (view: MarketplaceView): SearchDraft => remoteDiscoveryScope({ query: view.query, place: view.place ?? null, area: view.area,
  pinPlace: view.pinPlace ?? null, when: view.when ?? 'any', dates: dateRange(view.dates), where: view.where ?? 'any', places: atLeast(view.places),
  price: view.price });
/**
 * What the panel can count by: the list and what is mine are known (`ready`); the list is still read (`loading`) or
 * could not be read (`error`), so there is nothing to count; or the list is known but not yet which of its tasks are mine
 * (`pending`), so a count could still drop a moment later and none is said.
 */
export type SearchReadiness = 'ready' | 'loading' | 'error' | 'pending';
export type DiscoveryV1SearchPanelSeam = {
  snapshot: DiscoveryV1SearchSnapshot;
  onDraft: (draft: SearchDraft, mapArea: PublicBounds | null) => void;
  onNextPlaces: () => void;
};

/** "Gde" at its "everything": no place, no words, no map area, no single point. */
const ANYWHERE = { query: '', place: null, area: null, pinPlace: null } as const satisfies Partial<SearchDraft>;

export type SearchStep = 'gde' | 'kada' | 'kako' | 'koliko' | 'cena';

/** A floating group owns only disclosure. All choices remain in the parent draft when its editor is closed. */
function SearchGroup({ step, label, summary, art, open, large, onToggle, onPosition, onBodyPosition, children }: {
  step: SearchStep; label: string; summary: string; art: FactArtKind; open: boolean; large: boolean;
  onToggle: (step: SearchStep) => void;
  onPosition: (step: SearchStep, y: number) => void;
  onBodyPosition: (step: SearchStep, y: number) => void;
  children: ReactNode;
}) {
  // Native Yoga owns the full intrinsic height, including a newly expanded calendar.
  // A layout-animation height can lag its children on Android and clip the last week.
  return <View testID={`search-step-${step}`} style={s.group}
    onLayout={event => onPosition(step, event.nativeEvent.layout.y)}>
    <Press testID={step === 'gde' ? 'search-place-toggle' : `search-${step}-toggle`} accessibilityRole="button"
      accessibilityLabel={label} accessibilityValue={{ text: summary }} accessibilityState={{ expanded: open }}
      onPress={() => onToggle(step)} haptic="select" hitSlop={0} scaleTo={0.99} style={s.groupHeader}>
      <FactArt kind={art} size={open ? 32 : 28} />
      <View style={s.groupCopy}>
        <T variant={open ? 'bodyStrong' : 'note'} tone={open ? 'ink' : 'muted'}>{label}</T>
        {!open ? <T variant="bodyStrong" numberOfLines={large ? 3 : 2}>{summary}</T> : null}
      </View>
      <TurningCaret open={open} />
    </Press>
    {open ? <View testID={`search-body-${step}`} style={s.groupBody}
      onLayout={event => onBodyPosition(step, event.nativeEvent.layout.y)}>
      {children}
    </View> : null}
  </View>;
}

/**
 * Whether a screen reader is on, followed while the panel is open. With one on, revealing an editor never takes over
 * scrolling: focus stays on the control the person just used. The platform may
 * lack either call (a test double, the web), and then nothing is known and nothing changes.
 */
export function useScreenReader(): boolean {
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true, revision = 0;
    try {
      const request = revision;
      const answer = AccessibilityInfo.isScreenReaderEnabled?.();
      answer?.then?.(enabled => { if (alive && request === revision && typeof enabled === 'boolean') setReader(enabled); }, () => undefined);
    } catch { /* Nothing is known; manual editor expansion keeps its usual reveal. */ }
    let listener: { remove?: () => void } | undefined;
    try {
      listener = AccessibilityInfo.addEventListener?.('screenReaderChanged', (enabled: boolean) => { if (alive) { revision++; setReader(!!enabled); } });
    } catch { listener = undefined; }
    return () => { alive = false; listener?.remove?.(); };
  }, []);
  return reader;
}

/** iOS starts opaque until the preference is known; a newer event always wins over an older async query. */
function useReducedTransparency(): boolean {
  const [opaque, setOpaque] = useState(Platform.OS === 'ios');
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true, revision = 0;
    const ask = () => {
      const request = ++revision;
      try {
        AccessibilityInfo.isReduceTransparencyEnabled?.()?.then(value => {
          if (alive && revision === request && typeof value === 'boolean') setOpaque(value);
        }, () => undefined);
      } catch { /* The readable opaque fallback remains when the preference cannot be read. */ }
    };
    let preference: { remove?: () => void } | undefined, foreground: { remove?: () => void } | undefined;
    try { preference = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', value => {
      if (alive) { revision++; setOpaque(!!value); }
    }); } catch { /* Older adapters keep the last known preference. */ }
    try { foreground = AppState.addEventListener?.('change', value => { if (value === 'active') ask(); }); }
    catch { /* No foreground API in this environment. */ }
    ask();
    return () => { alive = false; revision++; preference?.remove?.(); foreground?.remove?.(); };
  }, []);
  return opaque;
}

/** One set of choices, one of which is chosen (a radio group to a screen reader), in the shared chosen-chip look. */
function Choice<K extends string>({ label, options, value, onChange }: {
  label: string; options: readonly (readonly [K, string])[]; value: K | null; onChange: (value: K) => void;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.chips}>
    {options.map(([key, words]) => {
      const checked = key === value;
      // 44 high and 4 more above and under it: 52 to a finger, and rows 8 apart never share a touch.
      return <Press key={key} accessibilityRole="radio" accessibilityLabel={words} accessibilityState={{ checked }} aria-checked={checked}
        haptic="select" scaleTo={0.97} hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }} onPress={() => onChange(key)} style={[s.chip, checked && s.chipOn]}>
        {checked ? <Check size={16} weight="bold" color={sys.color.green} /> : null}
        <T variant="copy" style={[s.chipText, checked && s.chipTextOn]}>{words}</T>
      </Press>;
    })}
  </View>;
}

/**
 * A "Gde" suggestion: its drawing, the place, how many tasks (only once the list is known: never "0 zadataka" while it is
 * still read), and a tick when it is the one chosen. The rows touch, so a row takes no touch beyond itself.
 */
function Suggestion({ art, text, count, checked, onPress }: { art: FactArtKind; text: string; count: number | null; checked: boolean; onPress: () => void }) {
  return <Press accessibilityRole="radio" accessibilityLabel={count === null ? text : `${text}, ${zadataka(count)}`} accessibilityState={{ checked }}
    aria-checked={checked} haptic="select" scaleTo={0.99} hitSlop={0} onPress={onPress} style={[s.suggestion, checked && s.suggestionOn]}>
    <View style={s.well}><FactArt kind={art} size={24} /></View>
    <View style={s.grow}>
      <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{text}</T>
      {count === null ? null : <T variant="note" tone="muted">{zadataka(count)}</T>}
    </View>
    {checked ? <Check size={20} weight="bold" color={sys.color.green} /> : null}
  </Press>;
}

/** "Koliko vas dolazi": − n +; minus stops at one person, plus at `PLACES_MAX`. Large text gets the whole row. */
function Stepper({ value, expanded, onChange }: { value: number; expanded: boolean; onChange: (value: number) => void }) {
  const low = value <= 1, high = value >= PLACES_MAX;
  return <View style={[s.stepper, expanded && s.stepperExpanded]}>
    <Press accessibilityRole="button" accessibilityLabel="Smanji broj osoba" accessibilityHint={low ? 'Najmanje je jedna osoba.' : undefined}
      accessibilityState={{ disabled: low }} disabled={low} haptic={low ? 'none' : 'select'} onPress={() => onChange(value - 1)} style={s.step}>
      <Minus size={22} weight="bold" color={low ? sys.color.muted : sys.color.ink} /></Press>
    <T variant="bodyStrong" accessibilityLiveRegion="polite" style={s.stepValue}>{osoba(value)}</T>
    <Press accessibilityRole="button" accessibilityLabel="Povećaj broj osoba" accessibilityHint={high ? `Najviše ${PLACES_MAX} osoba.` : undefined}
      accessibilityState={{ disabled: high }} disabled={high} haptic={high ? 'none' : 'select'} onPress={() => onChange(value + 1)} style={s.step}>
      <Plus size={22} weight="bold" color={high ? sys.color.muted : sys.color.ink} /></Press>
  </View>;
}

/**
 * The entry opens its own group; one group is expanded at a time. Closed groups summarize the current draft,
 * while the calendar expands inside Kada. Switching groups keeps every chosen value and screen-reader focus.
 * Every choice is a draft: the footer's one green action applies it all
 * and says how many tasks the list will then show (a polite live region, so the new number is heard), "Obriši uslove"
 * empties the draft, and × or Back leaves the list exactly as it was. While the list is not known yet the panel counts
 * nothing: the action says the list is being read, or that it could not be, and cannot be pressed; while only what is
 * mine is still read it applies the draft without a number. The footer stays above the keyboard while "Gde" is typed in.
 *
 * "Gde?" offers only places the loaded tasks name (never a geocoder, never the device's location), the map's current
 * area and every task; the words typed there also search the tasks' titles, places and conditions, as the search over
 * the map did.
 */
export function DiscoverySearchPanel({ items, view, mine, now, mapArea, blurTarget, start = 'gde', reduced, readiness = 'ready',
  p6Search, onApply, onClose }: {
  items: readonly MarketplaceItem[]; view: MarketplaceView; mine: ReadonlySet<string> | undefined; now: Date;
  /** The map's visible area when the camera has settled somewhere, for "Oblast sa mape"; null when unknown. */
  mapArea: PublicBounds | null;
  /** The underlying Discovery scene, never the search cards themselves. Android needs the explicit native target. */
  blurTarget?: RefObject<View | null>;
  /** Entry context opens that group; unavailable work-mode controls fall back to Gde. */
  start?: SearchStep;
  reduced: boolean;
  /** Whether the list it counts is known; see `SearchReadiness`. */
  readiness?: SearchReadiness;
  /** Optional P6 server-owned count/facet seam. A stale preview never falls back to the bounded loaded PAGE. */
  p6Search?: DiscoveryV1SearchPanelSeam;
  onApply: (draft: SearchDraft) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchDraft>(() => draftOf(view));
  const [activeStep, setActiveStep] = useState<SearchStep | null>(() => start === 'kako'
    && (view.where ?? 'any') === 'any' && !saysWorkMode(items) ? 'gde' : start);
  const [datesOpen, setDatesOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const reveal = useRef<{ step: SearchStep; token: number; calendar?: boolean } | null>(null);
  const revealSequence = useRef(0), revealFrame = useRef<number | null>(null), mounted = useRef(true);
  type Position = { owner: object; y: number };
  const sectionY = useRef<Partial<Record<SearchStep, Position>>>({});
  const bodyY = useRef<Partial<Record<SearchStep, Position>>>({}), calendarY = useRef<Position | null>(null);
  /** The first tap of a range: where it starts, until its end is tapped (the draft already holds that one day). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const reader = useScreenReader();
  const opaque = useReducedTransparency();
  const canBlur = !opaque && (Platform.OS === 'ios'
    || (Platform.OS === 'android' && Number(Platform.Version) >= 31 && !!blurTarget));
  const behavior = useRef({ reader }); behavior.current = { reader };
  const retireReveal = useCallback(() => {
    reveal.current = null; revealSequence.current++;
    if (revealFrame.current !== null) { cancelAnimationFrame(revealFrame.current); revealFrame.current = null; }
  }, []);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; retireReveal();
  }; }, [retireReveal]);
  const large = useTextScale() >= 1.3;
  const { width } = useWindowDimensions();
  const stackedActions = large || width < 360;
  // The people label needs more room than the footer: at 361dp / 1.15 it had only ~81dp beside the stepper.
  const stackedPeople = large || width < 380;
  const viewOf = (value: SearchDraft): MarketplaceView => ({ ...view, ...value });
  const localCount = useMemo(() => discoveryItems(items, viewOf(draft), mine, now).length, [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localUndated = useMemo(() => undatedCount(items, viewOf(draft), mine, now), [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverKey = discoveryV1SearchPreviewKey(viewOf(draft), mapArea);
  const serverCurrent = !!p6Search && p6Search.snapshot.active && p6Search.snapshot.key === serverKey;
  const effectiveReadiness: SearchReadiness = p6Search
    ? !serverCurrent || p6Search.snapshot.status === 'loading' || p6Search.snapshot.status === 'idle' ? 'loading'
      : p6Search.snapshot.status === 'error' ? 'error' : 'ready'
    : readiness;
  const counted = effectiveReadiness === 'ready';
  const count = p6Search ? serverCurrent ? p6Search.snapshot.count ?? 0 : 0 : localCount;
  const undated = p6Search ? serverCurrent ? p6Search.snapshot.undated ?? 0 : 0 : localUndated;
  // P6 availability is whole-collection authority. While its preview is changing, keep the control visible rather than
  // infer absence from a bounded page; a selected old value also remains removable.
  const workModes = draft.where !== 'any' || (view.where ?? 'any') !== 'any'
    || (p6Search ? !serverCurrent || p6Search.snapshot.availability?.hasKnownWorkMode !== false : saysWorkMode(items));
  useEffect(() => { p6Search?.onDraft(draft, mapArea); }, [p6Search?.onDraft, draft, mapArea]);
  // Own measurements by disclosure/layout generation, without retiring them for count or text rerenders.
  const layoutOwner = useMemo(() => ({}), [activeStep, datesOpen, workModes, width, large]);
  const currentLayoutOwner = useRef(layoutOwner); currentLayoutOwner.current = layoutOwner;
  useEffect(() => { if (!workModes && activeStep === 'kako') { retireReveal(); setActiveStep('gde'); } }, [workModes, activeStep, retireReveal]);
  const today = serbianToday(now);
  const edit = (patch: Partial<SearchDraft>) => setDraft(current => remoteDiscoveryScope({ ...current, ...patch }));
  const clearAll = () => { retireReveal(); setDraft(NO_SEARCH); setRangeStart(null); };
  // All required positions belong to the same natural-layout generation. Each new
  // measurement/content-size event reschedules one frame; no animation owns height.
  // A content-size event is an extra settling opportunity, not a prerequisite: two
  // different editors can have the same total scroll height and emit none.
  const revealEditor = useCallback((geometryOwner: object) => {
    const intent = reveal.current;
    if (!mounted.current || !intent || currentLayoutOwner.current !== geometryOwner) return;
    if (behavior.current.reader) { reveal.current = null; return; }
    const group = sectionY.current[intent.step], body = bodyY.current[intent.step], calendar = calendarY.current;
    if (group?.owner !== geometryOwner || body?.owner !== geometryOwner
      || (intent.calendar && calendar?.owner !== geometryOwner)) return;
    if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = null;
      if (!mounted.current || reveal.current !== intent || revealSequence.current !== intent.token
        || currentLayoutOwner.current !== geometryOwner) return;
      reveal.current = null;
      if (behavior.current.reader) return;
      const offset = intent.calendar ? Math.max(0, body.y + calendar!.y - sys.touch.min - sys.space.md) : 0;
      scroll.current?.scrollTo?.({ y: Math.max(0, group.y + offset - sys.space.md), animated: false });
    });
  }, []);
  const positionGroup = (step: SearchStep, y: number) => {
    if (!mounted.current || currentLayoutOwner.current !== layoutOwner || !Number.isFinite(y) || y < 0) return;
    sectionY.current[step] = { owner: layoutOwner, y };
    revealEditor(layoutOwner);
  };
  const toggleStep = (step: SearchStep) => {
    Keyboard.dismiss();
    const token = ++revealSequence.current;
    reveal.current = activeStep === step ? null : { step, token };
    setActiveStep(current => current === step ? null : step);
  };
  const toggleDates = () => {
    Keyboard.dismiss(); setRangeStart(null);
    const token = ++revealSequence.current;
    reveal.current = datesOpen ? null : { step: 'kada', token, calendar: true };
    setDatesOpen(current => !current);
  };
  const tapDay = (day: string) => {
    if (day < today) return;
    // The first tap is a whole choice already: that one day, applied as it is if nothing more is tapped. A day before it
    // starts again; the second tap, on it or after it, ends the range.
    if (rangeStart === null || day < rangeStart) { setRangeStart(day); edit({ dates: { from: day, to: day }, when: 'any' }); return; }
    setRangeStart(null);
    edit({ dates: { from: rangeStart, to: day }, when: 'any' });
  };

  // Gde: legacy mode derives from the full loaded collection. P6 uses exact PLACES rows/counts and never derives
  // a zero or a locality list from the bounded PAGE slice.
  const typed = placeKey(draft.query);
  const localPlaces = useMemo(() => placeSuggestions(items, viewOf(draft), mine, now), [items, view, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localEverywhere = useMemo(() => discoveryItems(items, viewOf({ ...draft, ...ANYWHERE }), mine, now).length,
    [items, view, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const localInMapArea = useMemo(() => mapArea ? discoveryItems(items, viewOf({ ...draft, ...ANYWHERE, area: mapArea }), mine, now).length : 0,
    [items, view, mapArea, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverPlaces: { text: string; count: number | null }[] = serverCurrent
    ? p6Search!.snapshot.places.map(place => ({ text: place.text, count: place.count })) : [];
  const selectedServerPlace = draft.place;
  if (p6Search && serverCurrent && selectedServerPlace
    && !serverPlaces.some(place => placeKey(place.text) === placeKey(selectedServerPlace))) {
    // A selected locality stays removable even if a live facet refresh no longer returns it.
    serverPlaces.push({ text: selectedServerPlace, count: null });
  }
  const places: { text: string; count: number | null }[] = p6Search ? serverPlaces : localPlaces;
  const shownPlaces = p6Search ? places : typed ? places.filter(place => placeKey(place.text).includes(typed)) : places;
  const everywhere = p6Search ? serverCurrent ? p6Search.snapshot.everywhere : null : localEverywhere;
  const inMapArea = p6Search ? serverCurrent ? p6Search.snapshot.inMapArea : null : localInMapArea;
  const known = (value: number | null) => counted ? value : null;

  // The one green action. What it can say depends on authoritative membership count; a stale P6 preview never falls
  // back to the number of rows already loaded.
  const show = effectiveReadiness === 'loading' ? { label: 'Učitavamo zadatke…', disabled: true }
    : effectiveReadiness === 'error' ? { label: 'Zadaci nisu učitani', disabled: true }
      : effectiveReadiness === 'pending' ? { label: 'Prikaži zadatke', disabled: false }
        : count > 0 ? { label: `Prikaži ${zadataka(count)}`, disabled: false } : { label: 'Nema zadataka za ove uslove', disabled: true };
  const groupProps = (step: SearchStep) => ({ step, open: activeStep === step, large,
    onToggle: toggleStep, onPosition: positionGroup,
    onBodyPosition: (key: SearchStep, y: number) => {
      if (!mounted.current || currentLayoutOwner.current !== layoutOwner || !Number.isFinite(y) || y < 0) return;
      bodyY.current[key] = { owner: layoutOwner, y };
      revealEditor(layoutOwner);
    } });
  const close = () => { retireReveal(); onClose(); };

  return <Modal visible transparent hardwareAccelerated animationType={reduced ? 'none' : 'fade'} statusBarTranslucent onRequestClose={close}>
    <View style={s.veil}>
      {canBlur ? <BlurView testID="search-blur-backdrop" pointerEvents="none" style={StyleSheet.absoluteFill}
        intensity={35} tint="light" blurMethod="dimezisBlurViewSdk31Plus" blurTarget={blurTarget} />
        : <View testID="search-veil-backdrop" pointerEvents="none" style={[StyleSheet.absoluteFill, opaque ? s.opaqueBackdrop : s.veilBackdrop]} />}
      {/* The footer rides above the keyboard while the words are typed in "Gde" (the app's own keyboard rule). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.frame}>
        <SafeAreaView edges={['top', 'bottom']} style={s.frame} accessibilityViewIsModal>
          <View style={s.top}>
            <T variant="heading" accessibilityRole="header" style={s.grow}>{start === 'gde' ? 'Pretraga' : 'Uslovi pretrage'}</T>
            <ChromeIconButton label="Zatvori pretragu" hint="Lista ostaje kakva je bila." icon={X} quiet onPress={close} />
          </View>
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onScrollBeginDrag={retireReveal}
            onContentSizeChange={() => { if (mounted.current && currentLayoutOwner.current === layoutOwner) revealEditor(layoutOwner); }}
            contentContainerStyle={s.sections}>
            <SearchGroup {...groupProps('gde')} label="Gde" summary={whereWords(draft)} art="pin">
              <View testID="search-place-editor" style={s.placeEditor}>
                <View style={s.field}>
                  <MagnifyingGlass size={20} color={sys.color.green} />
                  <TextInput accessibilityLabel="Pretraži mesta i zadatke" placeholder={draft.where === 'remote' ? 'Reč iz zadatka' : 'Mesto ili reč iz zadatka'} placeholderTextColor={sys.color.muted}
                    value={draft.query} onChangeText={query => edit({ query: query.slice(0, 1000) })} maxLength={1000} style={s.input}
                    returnKeyType="search" onSubmitEditing={Keyboard.dismiss} />
                  {draft.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" haptic="select" hitSlop={0} style={s.clear}
                    onPress={() => edit({ query: '' })}><X size={18} weight="bold" color={sys.color.ink} /></Press> : null}
                </View>
                {draft.where === 'remote' ? <T variant="note" tone="muted">Zadaci na daljinu ne zavise od oblasti mape.</T> : <>
                <T variant="note" tone="muted">Mesta iz dostupnih zadataka</T>
                <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.suggestions}>
                  <Suggestion art="tasks" text="Svi zadaci" count={known(everywhere)} checked={!draft.place && !draft.area && !draft.query.trim() && !draft.pinPlace}
                    onPress={() => edit(ANYWHERE)} />
                  {mapArea ? <Suggestion art="map" text="Oblast sa mape" count={known(inMapArea)} checked={!draft.place && !!draft.area && !draft.pinPlace}
                    onPress={() => edit({ ...ANYWHERE, area: mapArea })} /> : null}
                  {shownPlaces.map(place => <Suggestion key={placeKey(place.text)} art="pin" text={place.text} count={known(place.count)}
                    checked={!!draft.place && placeKey(draft.place) === placeKey(place.text)}
                    onPress={() => edit({ ...ANYWHERE, place: place.text })} />)}
                  {p6Search && serverCurrent && p6Search.snapshot.placeHasMore
                    ? <V2Action label={p6Search.snapshot.placePaging ? 'Učitavamo još mesta…' : 'Prikaži još mesta'}
                      disabled={p6Search.snapshot.placePaging} kind="quiet" onPress={p6Search.onNextPlaces} /> : null}
                  {p6Search && serverCurrent && p6Search.snapshot.facetError
                    ? <T variant="note" tone="muted">Mesta trenutno nisu dostupna. Pretraga zadataka i dalje radi.</T> : null}
                  {typed && !shownPlaces.length && !(p6Search && serverCurrent && p6Search.snapshot.facetError)
                    ? <T variant="note" tone="muted">Nijedno mesto ne sadrži ove reči. Traže se u naslovima i uslovima zadataka.</T> : null}
                </View></>}
              </View>
            </SearchGroup>
            <SearchGroup {...groupProps('kada')} label="Kada" summary={whenWords(draft, now)} art="calendar">
              <Choice label="Kada" options={WHEN} value={draft.dates ? null : draft.when}
                onChange={when => { setRangeStart(null); edit({ when, dates: null }); }} />
              <Press testID="search-date-toggle" accessibilityRole="button" accessibilityLabel="Datumi"
                accessibilityValue={{ text: draft.dates ? whenWords(draft, now) : 'Izaberi datume' }} accessibilityState={{ expanded: datesOpen }}
                onPress={toggleDates} haptic="select" hitSlop={0} scaleTo={0.99} style={s.dateToggle}>
                <T variant="copy" style={[s.grow, draft.dates ? s.chipTextOn : s.ink]}>{draft.dates ? whenWords(draft, now) : 'Izaberi datume'}</T>
                <TurningCaret open={datesOpen} />
              </Press>
              {datesOpen ? <View testID="search-date-editor" style={s.dateEditor}
                onLayout={event => {
                  const y = event.nativeEvent.layout.y;
                  if (!mounted.current || currentLayoutOwner.current !== layoutOwner || !Number.isFinite(y) || y < 0) return;
                  calendarY.current = { owner: layoutOwner, y };
                  revealEditor(layoutOwner);
                }}>
                <DateRangeGrid today={today} from={rangeStart ?? draft.dates?.from ?? null} to={rangeStart ? null : draft.dates?.to ?? null} now={now} onDay={tapDay} />
                <T variant="note" tone="muted" accessibilityLiveRegion="polite">{rangeStart ? 'Izaberi poslednji dan.' : 'Izaberi prvi i poslednji dan.'}</T>
              </View> : null}
              {counted && undated ? <T variant="note" tone="muted">{undatedWords(undated)}</T> : null}
            </SearchGroup>
            {workModes ? <SearchGroup {...groupProps('kako')} label="Kako se radi" summary={said(WHERE, draft.where)} art="remote">
              <Choice label="Kako se radi" options={WHERE} value={draft.where} onChange={where => edit({ where })} />
            </SearchGroup> : null}
            <SearchGroup {...groupProps('koliko')} label="Koliko vas dolazi" summary={osoba(draft.places)} art="users">
              <View testID="search-people-layout" style={[s.peopleRow, stackedPeople && s.peopleStacked]}>
                <Stepper value={draft.places} expanded={stackedPeople} onChange={places => edit({ places })} />
              </View>
              <T variant="note" tone="muted">Dovoljno slobodnih mesta za sve vas.</T>
            </SearchGroup>
            <SearchGroup {...groupProps('cena')} label="Cena" summary={said(PRICE, draft.price)} art="money">
              <Choice label="Cena" options={PRICE} value={draft.price} onChange={price => edit({ price })} />
            </SearchGroup>
          </ScrollView>
          <View testID="search-actions" style={[s.footer, stackedActions && s.footerStacked]}>
            <V2Action label={CLEAR_ALL} accessibilityLabel="Obriši sve uslove pretrage" kind="quiet" onPress={clearAll} />
            <View testID="search-show" accessibilityLiveRegion="polite" style={[s.grow, stackedActions && s.showStacked]}>
              <V2Action label={show.label} disabled={show.disabled} onPress={() => { onApply(draft); close(); }} style={brandAction} />
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  veil: { flex: 1 },
  veilBackdrop: { backgroundColor: sys.color.veil },
  opaqueBackdrop: { backgroundColor: sys.color.surface },
  frame: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm,
    paddingBottom: sys.space.md },
  sections: { paddingHorizontal: sys.space.base, paddingTop: sys.space.xs, paddingBottom: sys.space.base, gap: sys.space.md },
  group: { ...floating, backgroundColor: sys.color.surface, borderRadius: sys.radius.card },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 72,
    paddingHorizontal: sys.space.base, paddingVertical: sys.space.base },
  groupCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  groupBody: { paddingHorizontal: sys.space.base, paddingBottom: sys.space.base, gap: sys.space.md },
  placeEditor: { gap: sys.space.md },
  dateToggle: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: sys.touch.min,
    paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm, backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  dateEditor: { gap: sys.space.sm },
  peopleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.md },
  peopleStacked: { flexDirection: 'column', alignItems: 'stretch' },
  // The one text field of the system, with the search glass before it and the clear button in it.
  field: { ...fieldBox, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: 0, paddingRight: sys.space.xs },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: sys.space.sm }),
  clear: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  suggestions: { gap: sys.space.xs },
  // Place suggestions read as a list; only the chosen row has a neutral well and a check.
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control },
  suggestionOn: { backgroundColor: sys.color.greenSoft },
  well: { width: sys.space.xxl, height: sys.space.xxl, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  // A condition: the strong hairline when free; chosen, the shared look (neutral well, green edge, green
  // words and a tick), the same as over the map. Never the green fill: that is the one primary action's.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: sys.touch.min, maxWidth: '100%', paddingHorizontal: sys.space.base,
    paddingVertical: sys.space.sm, borderRadius: sys.radius.control,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { ...chipChosen, paddingHorizontal: sys.space.base - CHIP_CHOSEN_INSET },
  chipText: { fontWeight: '500', color: sys.color.ink, flexShrink: 1 },
  chipTextOn: { color: sys.color.green, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm, width: sys.space.huge * 4 },
  stepperExpanded: { width: '100%' },
  step: { width: sys.touch.min, height: sys.touch.min, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: sys.color.ink, fontVariant: ['tabular-nums'], flex: 1, minWidth: 0, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.base, paddingTop: sys.space.md,
    paddingBottom: sys.space.md },
  // At 320 dp / large text, the clear label otherwise takes nearly the whole row and turns the primary label into
  // a column of letters. Each action gets the full width; no vertical flex growth may squeeze out the filter cards.
  footerStacked: { flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  showStacked: { flex: 0, width: '100%' },
});
