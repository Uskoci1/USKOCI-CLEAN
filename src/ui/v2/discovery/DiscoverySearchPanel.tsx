import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MagnifyingGlass, Minus, Plus, X } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryItems, placeKey, placeSuggestions, PLACES_MAX, saysWorkMode, serbianToday, undatedCount,
  type DateRange, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { Press } from '../../Press';
import { T } from '../../Text';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { Segmented } from '../../system/Segmented';
import { osoba, zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { CHIP_CHOSEN_INSET, brandAction, chipChosen, fieldBox, floating, sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { DateRangeGrid } from './DateRangeGrid';
import { CLEAR_ALL, PRICE, WHEN, WHERE, placesWords, said, undatedWords, whenWords, whereWords } from './discoveryWords';

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
const LABEL: Record<SearchStep, string> = { gde: 'Gde', kada: 'Kada', kako: 'Kako se radi', koliko: 'Koliko vas dolazi', cena: 'Cena' };
const QUESTION: Record<SearchStep, string> = { gde: 'Gde?', kada: 'Kada?', kako: 'Kako se radi?', koliko: 'Koliko vas dolazi?', cena: 'Cena' };
/** A step still at its "everything" value: where a choice elsewhere moves on to. */
function unset(step: SearchStep, draft: SearchDraft): boolean {
  switch (step) {
    case 'gde': return !draft.place && !draft.query.trim() && !draft.area && !draft.pinPlace;
    case 'kada': return draft.when === 'any' && !draft.dates;
    case 'kako': return draft.where === 'any';
    case 'koliko': return draft.places <= 1;
    case 'cena': return draft.price === 'all';
  }
}

/**
 * Whether a screen reader is on, followed while the panel is open. With one on, the panel never moves on to the next step
 * by itself: the focus stays on the choice the person just made, and the next step is theirs to open. The platform may
 * lack either call (a test double, the web), and then nothing is known and nothing changes.
 */
export function useScreenReader(): boolean {
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      const answer = AccessibilityInfo.isScreenReaderEnabled?.();
      answer?.then?.(enabled => { if (alive && typeof enabled === 'boolean') setReader(enabled); }, () => undefined);
    } catch { /* Nothing is known: the panel keeps moving on as it does for everyone. */ }
    let listener: { remove?: () => void } | undefined;
    try {
      listener = AccessibilityInfo.addEventListener?.('screenReaderChanged', (enabled: boolean) => { if (alive) setReader(!!enabled); });
    } catch { listener = undefined; }
    return () => { alive = false; listener?.remove?.(); };
  }, []);
  return reader;
}

/** One set of pill chips, one of which is chosen (a radio group to a screen reader), in the one chosen-chip look. */
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

/** "Koliko vas dolazi": − n +, each button a full 48; minus stops at one person, plus at `PLACES_MAX`. */
function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const low = value <= 1, high = value >= PLACES_MAX;
  return <View style={s.stepper}>
    <Press accessibilityRole="button" accessibilityLabel="Smanji broj osoba" accessibilityHint={low ? 'Najmanje je jedna osoba.' : undefined}
      accessibilityState={{ disabled: low }} disabled={low} haptic={low ? 'none' : 'select'} onPress={() => onChange(value - 1)} style={s.step}>
      <Minus size={22} weight="bold" color={low ? sys.color.muted : sys.color.ink} /></Press>
    <T variant="heading" accessibilityLiveRegion="polite" style={s.stepValue}>{osoba(value)}</T>
    <Press accessibilityRole="button" accessibilityLabel="Povećaj broj osoba" accessibilityHint={high ? `Najviše ${PLACES_MAX} osoba.` : undefined}
      accessibilityState={{ disabled: high }} disabled={high} haptic={high ? 'none' : 'select'} onPress={() => onChange(value + 1)} style={s.step}>
      <Plus size={22} weight="bold" color={high ? sys.color.muted : sys.color.ink} /></Press>
  </View>;
}

/**
 * Zadaci search (Discovery V47; the interaction of Airbnb's search, USKOČI's own look): full-screen step cards over a
 * white veil on the map. Exactly one card is open and asks its question large; every other card is one row, its name
 * left and what it holds right (at large text, its name over its value), and a tap opens that one. A single-tap choice
 * moves on to the next step still unset, unless a screen reader is on; a choice made of more taps (a range of dates, the
 * count of people) stays open until it is complete. Every choice is a draft: the footer's one green action applies it all
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
  /** The step open first: "Gde" from the search pill, "Kada" from "Uslovi pretrage". */
  start?: SearchStep;
  reduced: boolean;
  /** Whether the list it counts is known; see `SearchReadiness`. */
  readiness?: SearchReadiness;
  onApply: (draft: SearchDraft) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchDraft>(() => draftOf(view));
  const [open, setOpen] = useState<SearchStep>(start);
  const [timeMode, setTimeMode] = useState<'dates' | 'flex'>(() => dateRange(view.dates) ? 'dates' : 'flex');
  /** The first tap of a range: where it starts, until its end is tapped (the draft already holds that one day). */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const reader = useScreenReader();
  const large = useTextScale() >= 1.3;
  const counted = readiness === 'ready';
  const others = useMemo(() => mine?.size ? items.filter(item => !mine.has(item.id)) : items, [items, mine]);
  const viewOf = (value: SearchDraft): MarketplaceView => ({ ...view, ...value });
  const count = useMemo(() => discoveryItems(items, viewOf(draft), mine, now).length, [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const undated = useMemo(() => undatedCount(items, viewOf(draft), mine, now), [items, view, draft, mine, now]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Kako se radi" is offered only when some task says how it is done, or when it is already on and must be removable.
  const workModes = draft.where !== 'any' || (view.where ?? 'any') !== 'any' || saysWorkMode(others);
  const steps: SearchStep[] = ['gde', 'kada', ...(workModes ? ['kako' as const] : []), 'koliko', 'cena'];
  const today = serbianToday(now);

  /** A choice that is complete: the draft takes it, and the next step still unset opens (or this one stays). */
  const choose = (step: SearchStep, patch: Partial<SearchDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    // With a screen reader on, the focus stays on the choice just made; moving the open card would move it away.
    if (reader) return;
    const after = steps.slice(steps.indexOf(step) + 1).find(candidate => unset(candidate, next));
    if (after) { Keyboard.dismiss(); setOpen(after); }
  };
  const edit = (patch: Partial<SearchDraft>) => setDraft(current => ({ ...current, ...patch }));
  const clearAll = () => { setDraft(NO_SEARCH); setRangeStart(null); };
  const tapDay = (day: string) => {
    if (day < today) return;
    // The first tap is a whole choice already: that one day, applied as it is if nothing more is tapped. A day before it
    // starts again; the second tap, on it or after it, ends the range.
    if (rangeStart === null || day < rangeStart) { setRangeStart(day); edit({ dates: { from: day, to: day }, when: 'any' }); return; }
    setRangeStart(null);
    choose('kada', { dates: { from: rangeStart, to: day }, when: 'any' });
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

  const value = (step: SearchStep) => step === 'gde' ? whereWords(draft) : step === 'kada' ? whenWords(draft, now)
    : step === 'kako' ? said(WHERE, draft.where) : step === 'koliko' ? placesWords(draft.places) : said(PRICE, draft.price);

  const body: Record<SearchStep, () => ReactNode> = {
    gde: () => <>
      <View style={s.field}>
        <MagnifyingGlass size={20} color={sys.color.green} />
        <TextInput accessibilityLabel="Pretraži mesta i zadatke" placeholder="Mesto ili reč iz zadatka" placeholderTextColor={sys.color.muted}
          value={draft.query} onChangeText={query => edit({ query: query.slice(0, 1000) })} maxLength={1000} style={s.input}
          returnKeyType="search" onSubmitEditing={() => choose('gde', {})} />
        {draft.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" haptic="select" hitSlop={0} style={s.clear}
          onPress={() => edit({ query: '' })}><X size={18} weight="bold" color={sys.color.ink} /></Press> : null}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.suggestions}>
        <Suggestion art="tasks" text="Svi zadaci" count={known(everywhere)} checked={!draft.place && !draft.area && !draft.query.trim() && !draft.pinPlace}
          onPress={() => choose('gde', ANYWHERE)} />
        {mapArea ? <Suggestion art="map" text="Oblast sa mape" count={known(inMapArea)} checked={!draft.place && !!draft.area && !draft.pinPlace}
          onPress={() => choose('gde', { ...ANYWHERE, area: mapArea })} /> : null}
        {shownPlaces.map(place => <Suggestion key={placeKey(place.text)} art="pin" text={place.text} count={known(place.count)}
          checked={!!draft.place && placeKey(draft.place) === placeKey(place.text)}
          onPress={() => choose('gde', { ...ANYWHERE, place: place.text })} />)}
        {typed && !shownPlaces.length ? <T variant="note" tone="muted">Nijedno mesto ne sadrži ove reči. Traže se u naslovima i uslovima zadataka.</T> : null}
      </View>
    </>,
    kada: () => <>
      <Segmented options={[{ key: 'dates', label: 'Datumi' }, { key: 'flex', label: 'Fleksibilno' }]} value={timeMode}
        onChange={mode => { setTimeMode(mode); setRangeStart(null); }} />
      {timeMode === 'flex'
        ? <Choice label="Kada" options={WHEN} value={draft.dates ? null : draft.when} onChange={when => choose('kada', { when, dates: null })} />
        : <DateRangeGrid today={today} from={rangeStart ?? draft.dates?.from ?? null} to={rangeStart ? null : draft.dates?.to ?? null} now={now} onDay={tapDay} />}
      {timeMode === 'dates' ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">
        {rangeStart ? 'Izaberi poslednji dan.' : 'Izaberi prvi i poslednji dan.'}</T> : null}
      {counted && undated ? <T variant="note" tone="muted">{undatedWords(undated)}</T> : null}
    </>,
    kako: () => <Choice label="Kako se radi" options={WHERE} value={draft.where} onChange={where => choose('kako', { where })} />,
    koliko: () => <>
      <T variant="note" tone="muted">Prikazujemo zadatke sa dovoljno slobodnih mesta za sve vas.</T>
      <Stepper value={draft.places} onChange={places => edit({ places })} />
    </>,
    cena: () => <Choice label="Cena" options={PRICE} value={draft.price} onChange={price => choose('cena', { price })} />,
  };

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
        <SafeAreaView edges={['top', 'bottom']} style={s.frame}>
          <View style={s.top}>
            <ChromeIconButton label="Zatvori pretragu" hint="Lista ostaje kakva je bila." icon={X} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.cards}>
            {steps.map(step => step === open
              ? <View key={step} testID={`search-step-${step}`} style={[s.card, s.open]}>
                <T variant="pageTitle" accessibilityRole="header" style={s.question}>{QUESTION[step]}</T>
                {body[step]()}
              </View>
              : <Press key={step} testID={`search-step-${step}`} accessibilityRole="button" accessibilityLabel={LABEL[step]}
                accessibilityValue={{ text: value(step) }} accessibilityState={{ expanded: false }} haptic="select" scaleTo={0.99}
                onPress={() => { Keyboard.dismiss(); setRangeStart(null); setOpen(step); }} style={[s.card, s.row, large && s.rowStacked]}>
                <T variant="copy" tone="muted" style={s.rowLabel}>{LABEL[step]}</T>
                <T variant="bodyStrong" style={[s.rowValue, large && s.rowValueStacked]} numberOfLines={large ? 2 : 1}>{value(step)}</T>
              </Press>)}
          </ScrollView>
          <View style={s.footer}>
            <V2Action label={CLEAR_ALL} accessibilityLabel="Obriši sve uslove pretrage" kind="quiet" onPress={clearAll} />
            <View testID="search-show" accessibilityLiveRegion="polite" style={s.grow}>
              <V2Action label={show.label} disabled={show.disabled} onPress={() => { onApply(draft); onClose(); }} style={brandAction} />
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  // The map shows through a white veil: the cards are what is read, the map is where they are about.
  veil: { flex: 1, backgroundColor: sys.color.veil },
  frame: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  top: { alignItems: 'flex-end', paddingHorizontal: sys.space.base, paddingTop: sys.space.sm },
  cards: { paddingHorizontal: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.lg, gap: sys.space.md },
  // Each step is its own white card that floats over the veil, drawn by the card edge (the faintest hairline all but
  // vanished on the veil).
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine, ...floating },
  open: { paddingHorizontal: sys.space.md, paddingTop: sys.space.lg, paddingBottom: sys.space.base, gap: sys.space.base },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.lg },
  // Large text: the name over what it holds, so neither is cut to a few letters at 320 dp.
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: sys.space.xs, paddingVertical: sys.space.md },
  rowLabel: { flexShrink: 1 },
  rowValue: { color: sys.color.ink, flex: 1, minWidth: 0, textAlign: 'right' },
  rowValueStacked: { flex: 0, textAlign: 'left' },
  question: { color: sys.color.ink, paddingHorizontal: sys.space.sm },
  // The one text field of the system, with the search glass before it and the clear button in it.
  field: { ...fieldBox, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: 0, paddingRight: sys.space.xs },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: sys.space.sm },
  clear: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  suggestions: { gap: sys.space.xs },
  // A suggestion is a row inside the card: a flat tint when chosen, never another card.
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 60, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control },
  suggestionOn: { backgroundColor: sys.color.greenSoft },
  well: { width: 44, height: 44, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  // A pill chip: the strong hairline when free; chosen, the system's one chosen-chip look (pale green, green edge, green
  // words and a tick), the same as over the map. Never the green fill: that is the one primary action's.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 44, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { ...chipChosen, paddingHorizontal: sys.space.base - CHIP_CHOSEN_INSET },
  chipText: { fontWeight: '500', color: sys.color.ink },
  chipTextOn: { color: sys.color.green, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.md, paddingHorizontal: sys.space.sm },
  step: { width: 48, height: 48, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: sys.color.ink, fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingHorizontal: sys.space.base, paddingTop: sys.space.md,
    paddingBottom: sys.space.md, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
});
