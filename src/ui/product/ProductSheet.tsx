import { useCallback, useRef, type ReactNode } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { X } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

const SheetBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;
const SheetHandle = () => <View accessible={false} importantForAccessibility="no" style={s.handleArea}><View style={s.handle} /></View>;

/** Native Modal owns focus/back; Gorhom owns the drag, scrolling and settling motion.
 * The caller commits a draft explicitly. Every dismissal route only invokes onClose. */
export function ProductSheet({ title, closeLabel, reduced, onClose, children }: {
  title: string; closeLabel: string; reduced: boolean; onClose: () => void;
  children: (dismiss: () => void) => ReactNode;
}) {
  const sheet = useRef<BottomSheet>(null), closing = useRef(false);
  const { height } = useWindowDimensions();
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (sheet.current) sheet.current.close(); else onClose();
  }, [onClose]);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.3} pressBehavior="close"
    accessibilityLabel={closeLabel} accessibilityHint="Zatvara pregled bez primene izbora." />, [closeLabel]);
  return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
    <GestureHandlerRootView style={s.root}>
      <BottomSheet ref={sheet} index={0} enableDynamicSizing enablePanDownToClose
        accessible={false} accessibilityRole="none" accessibilityLabel={title}
        maxDynamicContentSize={height * 0.85} animateOnMount={!reduced} onClose={onClose}
        animationConfigs={reduced ? { duration: 0 } : { stiffness: 300, damping: 30, mass: 1, overshootClamping: true }}
        backdropComponent={backdrop} backgroundComponent={SheetBackground} handleComponent={SheetHandle}
        keyboardBehavior="interactive" keyboardBlurBehavior="restore" enableBlurKeyboardOnGesture>
        <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <SafeAreaView edges={['bottom']} style={s.stack}>
            <View style={s.heading}><T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
              <Press accessibilityRole="button" accessibilityLabel={closeLabel} onPress={dismiss} haptic="select" style={s.close}>
                <X size={22} color={sys.color.ink} /></Press></View>
            {children(dismiss)}
          </SafeAreaView>
        </BottomSheetScrollView>
      </BottomSheet>
    </GestureHandlerRootView>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, background: { backgroundColor: sys.color.surface, borderRadius: sys.radius.sheet },
  handleArea: { height: 24, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong },
  content: { paddingHorizontal: 20, paddingBottom: 16 }, stack: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { flex: 1, color: sys.color.green },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
});
