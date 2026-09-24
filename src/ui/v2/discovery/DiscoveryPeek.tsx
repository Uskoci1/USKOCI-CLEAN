import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { CaretRight, X } from 'phosphor-react-native';
import { pinLabel, type MarketplaceItem } from '../../../data/marketplaceView';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { displaysUrgent } from '../../../lib/needUrgency';
import { Press } from '../../Press';
import { T } from '../../Text';
import { PeekSheet } from '../../system/PeekSheet';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { useUrgencyClock } from '../NeedUrgencyBadge';
import { CardFoot, CardPerson, CardPlaces, CardStatus, CardTitle, CardValue, personSpoken, placesText, taskPlace, taskSpoken, taskStatus,
  taskValue } from '../TaskFace';
import { V2Action } from '../V2Action';

/** Rows a place shows in its card; a place with more offers the whole set in the list instead of a scroll inside a card. */
export const PLACE_ROWS = 3;
/** What the PeekSheet draws around a place's rows: its `base` padding above and under them (the card has no handle). */
const PEEK_FRAME = 2 * sys.space.base;
/** The × sits this far in from the card's top-right corner, clear of its rounded edge. */
const CLOSE_INSET = sys.space.sm;

/** A task's price as words beside its name in a place's rows: money in the money colour, anything else never so. */
function PriceWords({ item }: { item: MarketplaceItem }) {
  const label = pinLabel(item);
  return label.tone === 'money' ? <T style={s.money}>{label.spoken}</T>
    : <T variant="note" tone="muted" style={s.word}>{label.tone === 'offer' ? 'Tražim ponude' : 'Cena nije navedena'}</T>;
}

/**
 * One chosen task on the map (Discovery V47, the Airbnb pattern in USKOČI's look). The whole card is one press that opens
 * the task ("Otvori zadatak: …"), and its round × top right closes it. It says, bare (it is the card, never a card inside
 * one): HITNO or "Prijava poslata" when they apply, the title in two lines, where · when, the price line exactly as the
 * task face writes it, the places still open, and who posted it with the honest rating when the read has them. No photo:
 * a task's photos are shown only inside the task (owner, 2026-09-24), and nothing is invented.
 */
function PinTask({ item, applied, onOpen, onClose, onLayout }: {
  item: MarketplaceItem; applied: boolean; onOpen: () => void; onClose: () => void; onLayout: (event: LayoutChangeEvent) => void;
}) {
  const large = useTextScale() >= 1.3;
  const title = readableTitle(item.naslov);
  const status = taskStatus(item, applied ? 'APPLIED' : undefined);
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  // The task's own time in the one time format ("24. sep · 12:00–19:00"): a window or a flexible range keeps both ends.
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const publisher = 'narucilacIme' in item && typeof item.narucilacIme === 'string' ? item.narucilacIme.trim() : '';
  const person = 'narucilacIme' in item && publisher ? <CardPerson name={publisher} rating={item.narucilacOcena} count={item.narucilacBrojOcena} /> : null;
  const places = item.pokrivenost ? placesText(item.pokrivenost, 'worker') : null;
  const spoken = taskSpoken({ status: status?.text, urgent, value, place: place.text, schedule, places: places?.spoken,
    person: 'narucilacIme' in item && publisher ? personSpoken(publisher, item.narucilacOcena, item.narucilacBrojOcena) : null });
  const head = status || urgent;
  return <View style={s.pin} onLayout={onLayout}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}`} accessibilityValue={{ text: spoken }}
      haptic="select" scaleTo={1} onPress={onOpen} style={s.pinBody}>
      {head ? <View style={s.clearOfClose}><CardStatus status={status} urgency={item.urgency} now={urgencyNow} /></View> : null}
      <CardTitle title={title} lines={2} style={!head && s.clearOfClose} />
      <T style={s.meta} numberOfLines={2}>{`${place.text} · ${schedule}`}</T>
      <CardValue value={value} large />
      {item.pokrivenost || person ? <CardFoot large={large} person={person}
        places={item.pokrivenost ? <CardPlaces places={item.pokrivenost} audience="worker" large={large} /> : null} /> : null}
    </Press>
    <View style={s.close}><ChromeIconButton label="Zatvori pregled zadatka" icon={X} onPress={onClose} /></View>
  </View>;
}

/**
 * The card of a chosen pin (Zadaci, 2026-09-24; Discovery V47): ONE floating card, 16 dp in from both edges, just above
 * the tab bar, over the list sheet's top line (which steps out of sight behind it while it shows). A single task is
 * `PinTask`; several tasks on one point say how many and list them as rows, each opening its own task ("Pogledaj
 * zadatak"), up to three, with the whole set offered in the list. ×, a swipe down and Android Back close it; under reduced
 * motion it appears without moving. Every opening goes through the screen's own guarded `onOpen`.
 */
export function DiscoveryPeek({ item, place, applied, active, bottomInset, reduced, onOpen, onShowPlace, onClose, onHeight }: {
  /** The chosen task, or null when a place with several tasks is chosen. */ item: MarketplaceItem | null;
  /** The tasks on the chosen place, in the list's order. */ place: readonly MarketplaceItem[];
  applied: (item: MarketplaceItem) => boolean;
  active: boolean; bottomInset: number; reduced: boolean;
  onOpen: (item: MarketplaceItem) => void;
  /** Shows every task of the chosen place in the list. */ onShowPlace: () => void;
  onClose: () => void;
  /** The card's whole height once it is laid out (never more than the PeekSheet allows), so the map's controls clear it. */
  onHeight?: (height: number) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const cap = Math.round(windowHeight * 0.5);
  // The single card reaches the sheet's edges itself (its whole face is the press); a place's rows sit in its padding.
  const measureCard = (event: LayoutChangeEvent) => {
    const whole = Math.ceil(event.nativeEvent.layout.height);
    if (whole > 0) onHeight?.(Math.min(whole, cap));
  };
  const measureRows = (event: LayoutChangeEvent) => {
    const content = Math.ceil(event.nativeEvent.layout.height);
    if (content > 0) onHeight?.(Math.min(PEEK_FRAME + content, cap));
  };
  return <PeekSheet label={item ? 'Zadatak na mapi' : 'Zadaci na ovom mestu'} active={active} bottomInset={bottomInset} reduced={reduced}
    handle={false} onClose={onClose}>
    {dismiss => item ? <PinTask item={item} applied={applied(item)} onOpen={() => onOpen(item)} onClose={dismiss} onLayout={measureCard} />
      : <View style={s.stack} onLayout={measureRows}>
        <View style={s.head}>
          <T variant="heading" accessibilityRole="header" style={s.title}>{`${zadataka(place.length)} na ovom mestu`}</T>
          <ChromeIconButton label="Zatvori pregled zadataka" icon={X} onPress={dismiss} />
        </View>
        {place.slice(0, PLACE_ROWS).map(task => <Press key={task.id} accessibilityRole="button" accessibilityLabel={`Pogledaj zadatak ${readableTitle(task.naslov)}`}
          haptic="select" scaleTo={0.98} onPress={() => onOpen(task)} style={s.row}>
          <View style={s.grow}>
            <T style={s.rowTitle} numberOfLines={2}>{readableTitle(task.naslov)}</T>
            <T variant="note" tone="muted" numberOfLines={1}>{applied(task) ? 'Prijava poslata · ' : ''}{task.schedule ? needScheduleText(task.schedule, task.taskTimezone) : task.vremeTekst}</T>
          </View>
          <PriceWords item={task} />
          <CaretRight size={18} color={sys.color.muted} />
        </Press>)}
        {place.length > PLACE_ROWS ? <V2Action label="Prikaži sve u listi" kind="quiet" onPress={onShowPlace} /> : null}
      </View>}
  </PeekSheet>;
}

const s = StyleSheet.create({
  stack: { gap: sys.space.md },
  grow: { flex: 1, minWidth: 0 },
  // The single card's face spans the whole card, its padding included, so every part of it opens the task.
  pin: { margin: -sys.space.base },
  pinBody: { padding: sys.space.base, gap: 6, borderRadius: sys.radius.card },
  // The first line keeps clear of the × in the corner.
  clearOfClose: { marginRight: 48 },
  meta: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: sys.color.fact },
  close: { position: 'absolute', top: CLOSE_INSET, right: CLOSE_INSET },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  title: { flex: 1, color: sys.color.ink },
  // A row inside the card is a flat tint at the control corner, never another card.
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingHorizontal: sys.space.md, paddingVertical: 10,
    borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  rowTitle: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  money: { ...sys.type.priceRow, color: sys.color.money },
  word: { maxWidth: 110, textAlign: 'right' },
});
