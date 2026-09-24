import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetView, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { SHEET_SPRING } from '../product/ProductSheet';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { sys } from './tokens';

const shadow = Platform?.OS === 'android' && typeof Platform?.Version === 'number' && Platform.Version < 28
  ? { elevation: 6 } : { boxShadow: '0px 10px 28px rgba(23, 59, 39, 0.14), 0px 2px 6px rgba(23, 59, 39, 0.06)' };
const PeekBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;
const PeekHandle = () => <View accessible={false} importantForAccessibility="no" style={s.handleArea}><View style={s.handle} /></View>;

/**
 * A card that peeks up over a screen without taking it over: no backdrop, no dimming, no modal focus trap, detached
 * above the tab bar. Made for the pin card on the map, where the map must stay live around it. A drag down or Android Back
 * closes it (Back closes the card before it leaves the screen); the screen underneath keeps its own touches. Render it as
 * the last child of a full-screen container.
 */
export function PeekSheet({ label, active, onClose, children, bottomInset = sys.space.md, reduced: callerReduced }: {
  /** What assistive technology calls the card. */
  label: string;
  /** True while the screen that hosts the card is the one in front (the map passes `useIsFocused()`). Only then does
   *  Android Back belong to the card: with a task detail pushed over the map, Back goes to the detail, not the card. */
  active: boolean;
  /** Called once the card is gone, whatever closed it. */
  onClose: () => void;
  children: (dismiss: () => void) => ReactNode;
  /** The gap to the bottom of the screen it floats over. The tab bar sits outside the screen, so 12 clears it. */
  bottomInset?: number;
  reduced?: boolean;
}) {
  const systemReduced = useSystemReducedMotion();
  const reduced = callerReduced ?? systemReduced;
  const sheet = useRef<BottomSheet>(null), closing = useRef(false);
  const { height } = useWindowDimensions();
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (sheet.current) sheet.current.close(); else onClose();
  }, [onClose]);
  useEffect(() => {
    if (!active) return;
    // Once the card is on its way out, Back is the screen's again: it never swallows a second press.
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (closing.current) return false; dismiss(); return true; });
    return () => back.remove();
  }, [active, dismiss]);
  return <BottomSheet ref={sheet} index={0} enableDynamicSizing enablePanDownToClose detached bottomInset={bottomInset}
    style={s.sheet} accessible={false} accessibilityRole="none" accessibilityLabel={label}
    maxDynamicContentSize={height * 0.5} animateOnMount={!reduced} onClose={onClose}
    animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING}
    backgroundComponent={PeekBackground} handleComponent={PeekHandle}>
    <BottomSheetView style={s.content}>{children(dismiss)}</BottomSheetView>
  </BottomSheet>;
}

const s = StyleSheet.create({
  sheet: { marginHorizontal: sys.space.md },
  background: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine, ...shadow },
  handleArea: { height: 20, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong },
  content: { paddingHorizontal: sys.space.base, paddingBottom: sys.space.base },
});
