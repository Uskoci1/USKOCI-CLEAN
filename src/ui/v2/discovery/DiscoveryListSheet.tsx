import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import type { SharedValue } from 'react-native-reanimated';
import { SHEET_SPRING } from '../../product/ProductSheet';
import { sys } from '../../system/tokens';

/** The sheet's three heights, in this order: its top line only, half the map, the whole list under the tools. */
export const SNAP = { peek: 0, half: 1, full: 2 } as const;

const ListBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;

/**
 * The list of Zadaci as a sheet over the map (owner step 4, 2026-09-24): the sheet IS the list, so there is no Lista/Mapa
 * switch. It never closes; it rests at one of three heights and its top line (the count and "Prikaži listu") is always
 * there to take hold of. It sits inside the screen, and the screen ends where the tab bar begins, so the sheet never
 * slides under the bar. Under reduced motion it changes height at once.
 */
export function DiscoveryListSheet({ index, snapPoints, position, reduced, onIndex, header, children }: {
  index: number; snapPoints: readonly (number | string)[];
  /** Where the sheet's top edge is, for the map's controls that ride on it. */ position?: SharedValue<number>;
  reduced: boolean; onIndex: (index: number) => void;
  /** The top line: always visible, never scrolled away. */ header: ReactNode;
  /** The list itself (a `BottomSheetFlatList`). */ children: ReactNode;
}) {
  return <BottomSheet index={index} snapPoints={snapPoints as (number | string)[]} enableDynamicSizing={false} enablePanDownToClose={false}
    animateOnMount={false} animatedPosition={position} onChange={next => { if (next >= 0) onIndex(next); }}
    animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING} handleComponent={null} backgroundComponent={ListBackground}
    accessible={false} accessibilityRole="none" accessibilityLabel="Lista zadataka"
    keyboardBehavior="extend" keyboardBlurBehavior="restore">
    <View style={s.content}>{header}{children}</View>
  </BottomSheet>;
}

const s = StyleSheet.create({
  // It floats over the map: the sheet corner, the hairline along its top, a soft lift.
  background: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    borderWidth: 1, borderBottomWidth: 0, borderColor: sys.color.line,
    shadowColor: sys.color.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 6 },
  content: { flex: 1 },
});
