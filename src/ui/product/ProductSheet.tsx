import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFooter, BottomSheetScrollView, type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps, type BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import { X } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';

const SheetBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;
const SheetHandle = () => <View accessible={false} importantForAccessibility="no" style={s.handleArea}><View style={s.handle} /></View>;

/** Every command in a sheet is an important one: a full 48 even where the shared minimum is smaller. */
export const SHEET_TOUCH = Math.max(48, sys.touch.min);
/** The one settle for every sheet: critically damped, no bounce. Reduced motion replaces it with no motion at all. */
export const SHEET_SPRING = { stiffness: 300, damping: 30, mass: 1, overshootClamping: true } as const;

export type ProductSheetProps = {
  /** The visible title. A sheet without one (a menu) names itself through `label`. */
  title?: string;
  /** What assistive technology calls a sheet that has no visible title. */
  label?: string;
  /** The × and the backdrop say this. */
  closeLabel?: string;
  /** The caller's own reading of the system setting; the sheet reads it itself when this is left out. */
  reduced?: boolean;
  /** Called once the sheet is gone, whatever closed it. */
  onClose: () => void;
  children: (dismiss: () => void) => ReactNode;
  /** Actions pinned under the content. They never scroll away, however long the content or large the text. */
  footer?: (dismiss: () => void) => ReactNode;
  /** Unsaved input. Every way out the person can take (×, Back, backdrop) asks before throwing it away, and a drag
   *  down no longer closes. `dismiss`, handed to the content, is the caller's own commit and never asks. */
  dirty?: boolean;
  /** False while something the sheet started is still running: nothing the person does closes it until it settles. */
  dismissible?: boolean;
  /** A sheet whose own buttons already close it (a confirmation) leaves the × out. */
  closeButton?: boolean;
};

/**
 * The one sheet engine. The native Modal owns focus and Android Back; Gorhom owns the drag, the scrolling and the
 * settling motion. The caller commits a draft explicitly, and every dismissal route only invokes onClose.
 */
export function ProductSheet({ title, label, closeLabel = 'Zatvori', reduced: callerReduced, onClose, children, footer,
  dirty = false, dismissible = true, closeButton = true }: ProductSheetProps) {
  const systemReduced = useSystemReducedMotion();
  const reduced = callerReduced ?? systemReduced;
  const sheet = useRef<BottomSheet>(null), closing = useRef(false);
  const { height } = useWindowDimensions();
  const [asking, setAsking] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  // The guard reads the newest values: Back and the backdrop call it from outside this render.
  const state = useRef({ dirty, dismissible, asking }); state.current = { dirty, dismissible, asking };
  useEffect(() => { if (!dirty) setAsking(false); }, [dirty]);
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (sheet.current) sheet.current.close(); else onClose();
  }, [onClose]);
  /** Every way out the person takes: ×, Android Back, the backdrop. */
  const requestClose = useCallback(() => {
    const now = state.current;
    if (!now.dismissible) return;
    // Back or a tap outside while the question is open means "no, keep editing".
    if (now.asking) { setAsking(false); return; }
    if (now.dirty) { setAsking(true); return; }
    dismiss();
  }, [dismiss]);
  const guarded = dirty || !dismissible;
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.3}
    // A tap outside a guarded sheet stays where it is (snap to the open index) and asks the guard instead.
    pressBehavior={guarded ? 0 : 'close'} onPress={guarded ? requestClose : undefined}
    accessibilityLabel={closeLabel} accessibilityHint="Zatvara pregled bez primene izbora." />, [closeLabel, guarded, requestClose]);
  const pinned = asking ? <View style={s.discard} accessibilityLiveRegion="polite">
    <T accessibilityRole="alert" variant="heading" style={s.discardTitle}>Odbaciti izmene?</T>
    <T variant="copy" tone="muted">Unete izmene neće biti sačuvane.</T>
    <Press accessibilityRole="button" accessibilityLabel="Odbaci izmene" testID="product-sheet-discard" haptic="medium"
      onPress={dismiss} style={[s.command, s.danger]}>
      <T variant="action" style={s.onFilled}>Odbaci izmene</T></Press>
    <Press accessibilityRole="button" accessibilityLabel="Nastavi uređivanje" testID="product-sheet-keep" haptic="select"
      onPress={() => setAsking(false)} style={s.command}>
      <T variant="action" style={s.quiet}>Nastavi uređivanje</T></Press>
  </View> : footer ? footer(dismiss) : null;
  const renderFooter = useCallback((props: BottomSheetFooterProps) => <BottomSheetFooter {...props}>
    <SafeAreaView edges={['bottom']} testID="product-sheet-footer" style={s.footer}
      onLayout={event => setFooterHeight(Math.ceil(event.nativeEvent.layout.height))}>{pinned}</SafeAreaView>
  </BottomSheetFooter>, [pinned]);
  return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
    <GestureHandlerRootView style={s.root}>
      <BottomSheet ref={sheet} index={0} enableDynamicSizing enablePanDownToClose={!guarded}
        accessible={false} accessibilityRole="none" accessibilityLabel={title ?? label}
        maxDynamicContentSize={height * 0.85} animateOnMount={!reduced} onClose={onClose}
        animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING}
        backdropComponent={backdrop} backgroundComponent={SheetBackground} handleComponent={SheetHandle}
        footerComponent={pinned ? renderFooter : undefined}
        keyboardBehavior="interactive" keyboardBlurBehavior="restore" enableBlurKeyboardOnGesture>
        <BottomSheetScrollView keyboardShouldPersistTaps="handled"
          // The pinned actions sit over the end of the content; the content makes room for them, so the last line
          // is never hidden under a button.
          contentContainerStyle={[s.content, pinned ? { paddingBottom: footerHeight + 8 } : null]}>
          <SafeAreaView edges={pinned ? [] : ['bottom']} style={s.stack}>
            {title ? <View style={s.heading}><T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
              {closeButton ? <Press accessibilityRole="button" accessibilityLabel={closeLabel} accessibilityState={{ disabled: !dismissible }}
                disabled={!dismissible} onPress={requestClose} haptic="select" style={s.close}>
                <X size={22} color={sys.color.ink} /></Press> : null}</View> : null}
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
  close: { width: SHEET_TOUCH, height: SHEET_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 8, backgroundColor: sys.color.surface },
  discard: { gap: 8 }, discardTitle: { color: sys.color.ink },
  command: { minHeight: SHEET_TOUCH, borderRadius: sys.radius.primary, paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  danger: { backgroundColor: sys.color.danger, minHeight: 54 },
  onFilled: { color: sys.color.surface, textAlign: 'center' }, quiet: { color: sys.color.green, textAlign: 'center' },
});
