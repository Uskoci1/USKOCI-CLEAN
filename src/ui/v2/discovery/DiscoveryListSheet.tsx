import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { type BottomSheetBackdropProps, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { SHEET_SPRING } from '../../product/ProductSheet';
import { sheetLift, sys } from '../../system/tokens';

/** The sheet's three heights, in this order: its top line only, half the map, the whole list under the tools. */
export const SNAP = { peek: 0, half: 1, full: 2 } as const;

const ListBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;
/** The sunk sheet draws nothing: its edge and upward shadow would show as a sliver under the pin card. */
const SunkBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background, s.sunk]} />;

/** A real dim, driven by the sheet on the UI thread. The search stays above it and it never steals a map gesture. */
function MapBackdrop({ animatedIndex, style, topInset }: BottomSheetBackdropProps & { topInset: number }) {
  const animated = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, animatedIndex.value - SNAP.half)) * 0.18 }));
  return <Animated.View testID="discovery-sheet-dim" pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[style, s.backdrop, { top: topInset }, animated]} />;
}

/**
 * The list of Zadaci as a sheet over the map (owner step 4, 2026-09-24): the sheet IS the list, so there is no Lista/Mapa
 * switch. It never closes; it rests at one of three heights and its top line (the count, which is also the button that
 * opens the list; Discovery V47) is there to take hold of, except while a pin's card covers it: then the screen lowers
 * the lowest height to a sliver behind the card and the sheet is `sunk`: its background is not drawn (no hairline, no
 * shadow peeking out under the card) and nothing in it reaches a screen reader. It sits inside the screen, and the
 * screen ends where the tab bar begins, so the sheet never slides under the bar and the bar shows at every height. Under
 * reduced motion it changes height at once.
 */
export function DiscoveryListSheet({ index, snapPoints, position, reduced, onIndex, header, sunk = false,
  mapVisible = false, topInset = 0, children }: {
  index: number; snapPoints: readonly (number | string)[];
  /** Where the sheet's top edge is, for the map's controls that ride on it. */ position?: SharedValue<number>;
  reduced: boolean; onIndex: (index: number) => void;
  /** Map-only backdrop; the search header is never dimmed. */ mapVisible?: boolean; topInset?: number;
  /** The top line: always visible, never scrolled away. */ header: ReactNode;
  /** A pin's card lies over the sheet's top line: the sheet steps out of sight and out of reach behind it. */ sunk?: boolean;
  /** The list itself (a `BottomSheetFlatList`). */ children: ReactNode;
}) {
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <MapBackdrop {...props} topInset={topInset} />, [topInset]);
  return <BottomSheet index={index} snapPoints={snapPoints as (number | string)[]} enableDynamicSizing={false} enablePanDownToClose={false}
    animateOnMount={false} animatedPosition={position} onChange={next => { if (next >= 0) onIndex(next); }}
    backdropComponent={mapVisible && !sunk ? backdrop : undefined}
    animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING} handleComponent={null} backgroundComponent={sunk ? SunkBackground : ListBackground}
    accessible={false} accessibilityRole="none" accessibilityLabel={sunk ? null : 'Lista zadataka'}
    keyboardBehavior="extend" keyboardBlurBehavior="restore">
    <View testID="list-sheet-content" style={s.content} accessibilityElementsHidden={sunk}
      importantForAccessibility={sunk ? 'no-hide-descendants' : 'auto'}>{header}{children}</View>
  </BottomSheet>;
}

const s = StyleSheet.create({
  // It floats over the map: the sheet corner, the hairline along its top, a soft lift cast upwards because the sheet
  // rises from the bottom (the system's docked sheet lift, review r3 item 5 and r3b).
  background: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    borderWidth: 1, borderBottomWidth: 0, borderColor: sys.color.line, ...sheetLift.docked },
  sunk: { opacity: 0 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  content: { flex: 1 },
});
