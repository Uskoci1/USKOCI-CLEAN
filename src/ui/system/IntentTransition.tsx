import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowsLeftRight } from 'phosphor-react-native';
import { useReducedMotion } from './motion';
import type { Uloga } from '../../contracts/projections';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { brandAction, intentTitle, sys } from './tokens';

export type IntentTransitionRequest = {
  /** Intent the action needs. */
  target: Uloga;
  /** Plain-language reason, from the user's point of view. */
  reason: string;
  /** What happens on confirm, named as the action itself ("Pređi i napravi Zadatak"). */
  confirmLabel: string;
};

/**
 * Explicit MENI TREBA ↔ JA MOGU transition (owner decision 2, 2026-09-16).
 * Nothing switches the saved intent silently: the sheet states where the user
 * is, where the action leads, and the one confirm does both the switch and the
 * navigation. Cancel (button, scrim, hardware back) leaves everything as is.
 * The store stays the single writer; this component only asks.
 */
export function IntentTransition({ request, current, onConfirm, onCancel }: {
  request: IntentTransitionRequest | null; current: Uloga; onConfirm: () => void; onCancel: () => void;
}) {
  const reduced = useReducedMotion();
  if (!request) return null;
  return <Modal visible transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onCancel}>
    <View style={s.scrim}>
      <SafeAreaView edges={['bottom']} style={s.sheet} accessibilityViewIsModal>
        <View style={s.handle} />
        <View style={s.badge}><ArrowsLeftRight size={20} color={sys.color.green} /></View>
        <T variant="meta" tone="muted">Promena namere</T>
        <T accessibilityRole="header" variant="title" style={s.title}>{`Prelazite u ${intentTitle(request.target)}`}</T>
        <T variant="body" style={s.body}>{request.reason}</T>
        <T variant="meta" tone="muted">{`Sada ste u ${intentTitle(current)}. Isti nalog ima obe namere; nazad se vraćate preko profila.`}</T>
        <View style={s.actions}>
          <V2Action label={request.confirmLabel} onPress={onConfirm} style={brandAction} />
          <V2Action label={`Ostani u ${intentTitle(current)}`} kind="quiet" onPress={onCancel} />
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim },
  sheet: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet, padding: 24, paddingTop: 12, gap: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong, marginBottom: 8 },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { color: sys.color.ink },
  body: { color: sys.color.ink },
  actions: { gap: 8, marginTop: 10 },
});
