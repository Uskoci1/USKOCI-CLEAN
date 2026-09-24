import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { CaretRight, X } from 'phosphor-react-native';
import { pinLabel, type MarketplaceItem } from '../../../data/marketplaceView';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { Press } from '../../Press';
import { T } from '../../Text';
import { PeekSheet } from '../../system/PeekSheet';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { zadataka } from '../../system/plural';
import { brandAction, sys } from '../../system/tokens';
import { TaskCard } from '../TaskCard';
import { V2Action } from '../V2Action';

/** Rows a place shows in its card; a place with more offers the whole set in the list instead of a scroll inside a card. */
export const PLACE_ROWS = 3;
/** What the PeekSheet draws around this content: its 20 px handle above and its `base` padding under it. */
const PEEK_FRAME = 20 + sys.space.base;

/** A task's price as words beside its name in a place's rows: money in the money colour, anything else never so. */
function PriceWords({ item }: { item: MarketplaceItem }) {
  const label = pinLabel(item);
  return label.tone === 'money' ? <T style={s.money}>{label.spoken}</T>
    : <T variant="note" tone="muted" style={s.word}>{label.tone === 'offer' ? 'Tražim ponude' : 'Cena nije navedena'}</T>;
}

/**
 * The card of a chosen pin (Zadaci, 2026-09-24): a PeekSheet, so the map stays live around it, detached above the list's
 * top line. One task shows its card and the one green "Pogledaj zadatak"; several tasks on one point say how many and
 * list them as rows, each opening its own task with the same verb as the single card's action ("Pogledaj zadatak"). X,
 * a swipe down and Android Back close it. Every opening goes through the screen's own guarded `onOpen`.
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
  const measure = (event: LayoutChangeEvent) => {
    const content = Math.ceil(event.nativeEvent.layout.height);
    if (content > 0) onHeight?.(Math.min(PEEK_FRAME + content, Math.round(windowHeight * 0.5)));
  };
  return <PeekSheet label={item ? 'Zadatak na mapi' : 'Zadaci na ovom mestu'} active={active} bottomInset={bottomInset} reduced={reduced} onClose={onClose}>
    {dismiss => item ? <View style={s.stack} onLayout={measure}>
      <TaskCard item={item} compact onOpen={() => onOpen(item)} relation={applied(item) ? 'APPLIED' : undefined} />
      <View style={s.actions}>
        <V2Action label="Pogledaj zadatak" accessibilityLabel={`Pogledaj zadatak ${readableTitle(item.naslov)}`} onPress={() => onOpen(item)} style={[brandAction, s.grow]} />
        <ChromeIconButton label="Zatvori pregled" icon={X} onPress={dismiss} />
      </View>
    </View> : <View style={s.stack} onLayout={measure}>
      <View style={s.head}>
        <T variant="heading" accessibilityRole="header" style={s.title}>{`${zadataka(place.length)} na ovom mestu`}</T>
        <ChromeIconButton label="Zatvori pregled" icon={X} onPress={dismiss} />
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  title: { flex: 1, color: sys.color.ink },
  // A row inside the card is a flat tint at the control corner, never another card.
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingHorizontal: sys.space.md, paddingVertical: 10,
    borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  rowTitle: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  money: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: sys.color.money, fontVariant: ['tabular-nums'] },
  word: { maxWidth: 110, textAlign: 'right' },
});
