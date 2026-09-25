import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, CaretUp, Check, MagnifyingGlass, Minus, Plus, X } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryItems, placeKey, placeSuggestions, PLACES_MAX, saysWorkMode, serbianToday, undatedCount,
  type DateRange, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { Press } from '../../Press';
import { T } from '../../Text';
import { withInter } from '../../interFont';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { osoba, zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { CHIP_CHOSEN_INSET, brandAction, chipChosen, fieldBox, sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { DateRangeGrid } from './DateRangeGrid';
import { CLEAR_ALL, PRICE, WHEN, WHERE, undatedWords, whenWords, whereWords } from './discoveryWords';

/** Everything the search panel chooses, as a draft: nothing reaches the list before "Prikaži N zadataka". */
export type SearchDraft = { query: string; place: string | null; area: PublicBounds | null;
  /** One public point the list is narrowed to (a place's "Prikaži sve u listi"); any other "Gde" choice replaces it. */
  pinPlace: string | null;
  when: WhenFilter; dates: DateRange | null; where: WhereFilter; places: number; price: MarketplaceView['price'] };
export const NO_SEARCH: SearchDraft = { query: '', place: null, area: null, pinPlace: null, when: 'any', dates: null, where: 'any', places: 1, price: 'all' };
export const draftOf = (view: MarketplaceView): SearchDraft => ({ query: view.query, place: view.place ?? null, area: view.area,
  pinPlace: view.pinPlace ?? null, when: view.when ?? 'any', dates: dateRange(view.dates), where: view.where ?? 'any', places: atLeast(view.places),
  price: view.price });
/**
 * What the panel can count by: the list and what is mine are known (`ready`); the list is still read (`loading`) or
 * could not be read (`error`), so there is nothing to count; or the list is known but not yet which of its tasks are mine
 * (`pending`), so a count could still drop a moment later and none is said.
 */
export type SearchReadiness = 'ready' | 'loading' | 'error' | 'pending';

/** "Gde" at its "everything": no place, no words, no map area, no single point. */
const ANYWHERE = { query: '', place: null, area: null, pinPlace: null } as const satisfies Partial<SearchDraft>;

export type SearchStep = 'gde' | 'kada' | 'kako' | 'koliko' | 'cena';

/**
 * Whether a screen reader is on, followed while the panel is open. With one on, revealing an editor never takes over
 * scrolling: focus stays on the control the person just used. The platform may
 * lack either call (a test double, the web), and then nothing is known and nothing changes.
 */
export function useScreenReader(): boolean {
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      const answer = AccessibilityInfo.isScreenReaderEnabled?.();
      answer?.then?.(enabled => { if (alive && typeof enabled === 'boolean') setReader(enabled); }, () => undefined);
    } catch { /* Nothing is known; manual editor expansion keeps its usual reveal. */ }
    let listener: { remove?: () => void } | undefined;
    try {
      listener = AccessibilityInfo.addEventListener?.('screenReaderChanged', (enabled: boolean) => { if (alive) setReader(!!enabled); });
    } catch { listener = undefined; }
    return () => { alive = false; listener?.remove?.(); };
  }, []);
  return reader;
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
 * Search opens the place/word editor; filters open a compact overview of conditions. Simple choices are always visible,
 * while place suggestions and the calendar expand locally. Choices stay in context, including with a screen reader.
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
export function DiscoverySearchPanel({ items, view, mine, now, mapArea, start = 'gde', reduced, readiness = 'ready', onApply, onClose }: {
  items: readonly MarketplaceItem[]; view: MarketplaceView; mine: ReadonlySet<string> | undefined; now: Date;
  /** The map's visible area when the camera has settled somewhere, for "Oblast sa mape"; null when unknown. */
  mapArea: PublicBounds | null;
  /** Entry context: "Gde" opens place/words; condition entries open the grouped filter overview. */
  start?: SearchStep;
  reduced: boolean;
  /** Whether the list it counts is known; see `SearchReadiness`. */
  readiness?: SearchReadiness;
  onApply: (draft: SearchDraft) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchDraft>(() => draftOf(view));
  const [placeOpen, setPlaceOpen] = useState(start === 'gde');
  const [datesOpen, setDatesOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const reveal = useRef<'gde' | 'kada' | null>(null);
  const sectionY = useRef({ gde: 0, kada: 0 });
  /** The first tap of a range: where it starts, until its end is tapped (the draft already holds that one day). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const reader = useScreenReader();
  const large = useTextScale() >= 1.3;
  const { width } = useWindowDimensions();
  const stackedActions = large || width < 360;
  // The people label needs more room than the footer: at 361dp / 1.15 it had only ~81dp beside the stepper.
  const stackedPeople = large || width < 380;
  const counted = readiness === 'ready';
  const others = useMemo(() => mine?.size ? items.filter(item => !mine.has(item.id)) : items, [items, mine]);
  const viewOf = (value: SearchDraft): MarketplaceView => ({ ...view, ...value });
  const count = useMemo(() => discoveryItems(items, viewOf(draft), mine, now).length, [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const undated = useMemo(() => undatedCount(items, viewOf(draft), mine, now), [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Kako se radi" is offered only when some task says how it is done, or when it is already on and must be removable.
  const workModes = draft.where !== 'any' || (view.where ?? 'any') !== 'any' || saysWorkMode(others);
  const today = serbianToday(now);
  const edit = (patch: Partial<SearchDraft>) => setDraft(current => ({ ...current, ...patch }));
  const clearAll = () => { setDraft(NO_SEARCH); setRangeStart(null); };
  // Only a deliberate expansion reveals its editor, once. Typing, count updates and keyboard reflow never take over.
  const revealEditor = (editor: 'gde' | 'kada', offset = 0) => {
    if (reveal.current !== editor) return;
    reveal.current = null;
    if (!reader) scroll.current?.scrollTo?.({ y: Math.max(0, sectionY.current[editor] + offset - sys.space.md), animated: !reduced });
  };
  const togglePlace = () => {
    Keyboard.dismiss();
    reveal.current = placeOpen ? null : 'gde';
    setPlaceOpen(current => !current);
  };
  const toggleDates = () => {
    Keyboard.dismiss(); setRangeStart(null);
    reveal.current = datesOpen ? null : 'kada';
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

  // Gde: the places the loaded tasks name, narrowed by the words typed, counted under the other choices.
  const typed = placeKey(draft.query);
  const places = useMemo(() => placeSuggestions(items, viewOf(draft), mine, now), [items, view, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownPlaces = typed ? places.filter(place => placeKey(place.text).includes(typed)) : places;
  const everywhere = useMemo(() => discoveryItems(items, viewOf({ ...draft, ...ANYWHERE }), mine, now).length,
    [items, view, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const inMapArea = useMemo(() => mapArea ? discoveryItems(items, viewOf({ ...draft, ...ANYWHERE, area: mapArea }), mine, now).length : 0,
    [items, view, mapArea, draft.when, draft.dates, draft.where, draft.places, draft.price, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = (value: number) => counted ? value : null;

  // The one green action. What it can say depends on what is known; nothing to show says so on the button itself, which
  // cannot be pressed then.
  const show = readiness === 'loading' ? { label: 'Učitavamo zadatke…', disabled: true }
    : readiness === 'error' ? { label: 'Zadaci nisu učitani', disabled: true }
      : readiness === 'pending' ? { label: 'Prikaži zadatke', disabled: false }
        : count > 0 ? { label: `Prikaži ${zadataka(count)}`, disabled: false } : { label: 'Nema zadataka za ove uslove', disabled: true };

  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} statusBarTranslucent onRequestClose={onClose}>
    <View style={s.veil}>
      {/* The footer rides above the keyboard while the words are typed in "Gde" (the app's own keyboard rule). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.frame}>
        <SafeAreaView edges={['top', 'bottom']} style={s.frame} accessibilityViewIsModal>
          <View style={s.top}>
            <T variant="heading" accessibilityRole="header" style={s.grow}>{start === 'gde' ? 'Pretraga' : 'Uslovi pretrage'}</T>
            <ChromeIconButton label="Zatvori pretragu" hint="Lista ostaje kakva je bila." icon={X} quiet onPress={onClose} />
          </View>
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sections}>
            <View testID="search-step-gde" style={s.placeSection} onLayout={event => { sectionY.current.gde = event.nativeEvent.layout.y; }}>
              <Press testID="search-place-toggle" accessibilityRole="button" accessibilityLabel="Gde" accessibilityValue={{ text: whereWords(draft) }}
                accessibilityState={{ expanded: placeOpen }} haptic="select" hitSlop={0} scaleTo={0.99} onPress={togglePlace} style={s.placeSummary}>
                <FactArt kind="pin" size={24} />
                <View style={s.grow}>
                  <T variant="note" tone="muted">Mesto ili reč</T>
                  <T variant="bodyStrong" style={s.ink} numberOfLines={large ? 3 : 2}>{whereWords(draft)}</T>
                </View>
                {placeOpen ? <CaretUp size={18} weight="bold" color={sys.color.muted} /> : <CaretDown size={18} weight="bold" color={sys.color.muted} />}
              </Press>
              {placeOpen ? <View testID="search-place-editor" style={s.placeEditor} onLayout={() => revealEditor('gde')}>
                <View style={s.field}>
                  <MagnifyingGlass size={20} color={sys.color.green} />
                  <TextInput accessibilityLabel="Pretraži mesta i zadatke" placeholder="Mesto ili reč iz zadatka" placeholderTextColor={sys.color.muted}
                    value={draft.query} onChangeText={query => edit({ query: query.slice(0, 1000) })} maxLength={1000} style={s.input}
                    returnKeyType="search" onSubmitEditing={Keyboard.dismiss} />
                  {draft.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" haptic="select" hitSlop={0} style={s.clear}
                    onPress={() => edit({ query: '' })}><X size={18} weight="bold" color={sys.color.ink} /></Press> : null}
                </View>
                <T variant="note" tone="muted">Mesta iz dostupnih zadataka</T>
                <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.suggestions}>
                  <Suggestion art="tasks" text="Svi zadaci" count={known(everywhere)} checked={!draft.place && !draft.area && !draft.query.trim() && !draft.pinPlace}
                    onPress={() => edit(ANYWHERE)} />
                  {mapArea ? <Suggestion art="map" text="Oblast sa mape" count={known(inMapArea)} checked={!draft.place && !!draft.area && !draft.pinPlace}
                    onPress={() => edit({ ...ANYWHERE, area: mapArea })} /> : null}
                  {shownPlaces.map(place => <Suggestion key={placeKey(place.text)} art="pin" text={place.text} count={known(place.count)}
                    checked={!!draft.place && placeKey(draft.place) === placeKey(place.text)}
                    onPress={() => edit({ ...ANYWHERE, place: place.text })} />)}
                  {typed && !shownPlaces.length ? <T variant="note" tone="muted">Nijedno mesto ne sadrži ove reči. Traže se u naslovima i uslovima zadataka.</T> : null}
                </View>
              </View> : null}
            </View>
            <View testID="search-step-kada" style={s.section} onLayout={event => { sectionY.current.kada = event.nativeEvent.layout.y; }}>
              <View style={s.sectionHeading}>
                <FactArt kind="calendar" size={24} />
                <T variant="bodyStrong" accessibilityRole="header" style={s.grow}>Kada</T>
              </View>
              <Choice label="Kada" options={WHEN} value={draft.dates ? null : draft.when}
                onChange={when => { setRangeStart(null); edit({ when, dates: null }); }} />
              <Press testID="search-date-toggle" accessibilityRole="button" accessibilityLabel="Datumi"
                accessibilityValue={{ text: draft.dates ? whenWords(draft, now) : 'Izaberi datume' }} accessibilityState={{ expanded: datesOpen }}
                onPress={toggleDates} haptic="select" hitSlop={0} scaleTo={0.99} style={s.dateToggle}>
                <T variant="copy" style={[s.grow, draft.dates ? s.chipTextOn : s.ink]}>{draft.dates ? whenWords(draft, now) : 'Izaberi datume'}</T>
                {datesOpen ? <CaretUp size={18} weight="bold" color={sys.color.green} /> : <CaretDown size={18} weight="bold" color={sys.color.green} />}
              </Press>
              {datesOpen ? <View testID="search-date-editor" style={s.dateEditor}
                onLayout={event => revealEditor('kada', Math.max(0, event.nativeEvent.layout.y - sys.touch.min - sys.space.md))}>
                <DateRangeGrid today={today} from={rangeStart ?? draft.dates?.from ?? null} to={rangeStart ? null : draft.dates?.to ?? null} now={now} onDay={tapDay} />
                <T variant="note" tone="muted" accessibilityLiveRegion="polite">{rangeStart ? 'Izaberi poslednji dan.' : 'Izaberi prvi i poslednji dan.'}</T>
              </View> : null}
              {counted && undated ? <T variant="note" tone="muted">{undatedWords(undated)}</T> : null}
            </View>
            {workModes ? <View testID="search-step-kako" style={s.section}>
              <View style={s.sectionHeading}>
                <FactArt kind="remote" size={24} />
                <T variant="bodyStrong" accessibilityRole="header" style={s.grow}>Kako se radi</T>
              </View>
              <Choice label="Kako se radi" options={WHERE} value={draft.where} onChange={where => edit({ where })} />
            </View> : null}
            <View testID="search-step-koliko" style={s.section}>
              <View testID="search-people-layout" style={[s.peopleRow, stackedPeople && s.peopleStacked]}>
                <View style={[s.sectionHeading, !stackedPeople && s.grow]}>
                  <FactArt kind="users" size={24} />
                  <T variant="bodyStrong" accessibilityRole="header" style={s.grow}>Koliko vas dolazi</T>
                </View>
                <Stepper value={draft.places} expanded={stackedPeople} onChange={places => edit({ places })} />
              </View>
              <T variant="note" tone="muted">Dovoljno slobodnih mesta za sve vas.</T>
            </View>
            <View testID="search-step-cena" style={s.lastSection}>
              <View style={s.sectionHeading}>
                <FactArt kind="money" size={24} />
                <T variant="bodyStrong" accessibilityRole="header" style={s.grow}>Cena</T>
              </View>
              <Choice label="Cena" options={PRICE} value={draft.price} onChange={price => edit({ price })} />
            </View>
          </ScrollView>
          <View testID="search-actions" style={[s.footer, stackedActions && s.footerStacked]}>
            <V2Action label={CLEAR_ALL} accessibilityLabel="Obriši sve uslove pretrage" kind="quiet" onPress={clearAll} />
            <View testID="search-show" accessibilityLiveRegion="polite" style={[s.grow, stackedActions && s.showStacked]}>
              <V2Action label={show.label} disabled={show.disabled} onPress={() => { onApply(draft); onClose(); }} style={brandAction} />
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  veil: { flex: 1, backgroundColor: sys.color.surface },
  frame: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm,
    paddingBottom: sys.space.sm, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  sections: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.base },
  placeSection: { borderBottomWidth: 1, borderBottomColor: sys.color.line },
  placeSummary: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingVertical: sys.space.md },
  placeEditor: { gap: sys.space.md, paddingBottom: sys.space.base },
  section: { paddingVertical: sys.space.base, gap: sys.space.md, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  lastSection: { paddingTop: sys.space.base, gap: sys.space.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  dateToggle: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: sys.touch.min,
    paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm, backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  dateEditor: { gap: sys.space.sm },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
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
    paddingBottom: sys.space.md, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
  // At 320 dp / large text, the clear label otherwise takes nearly the whole row and turns the primary label into
  // a column of letters. Each action gets the full width; no vertical flex growth may squeeze out the filter cards.
  footerStacked: { flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  showStacked: { flex: 0, width: '100%' },
});
