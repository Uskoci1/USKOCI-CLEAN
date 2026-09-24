import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sys } from './tokens';

/**
 * The pinned foot of a flow step (round 6, Izmene scenes 11 and 12: step 1's only action was below the fold of a long
 * form and step 2's sat at the top of an empty screen). It holds the step's one action on the surface under a hairline,
 * and belongs BELOW the ScrollView and INSIDE the KeyboardAvoidingView, so the action stays on screen however long the
 * form is and rises with the keyboard. Its measure is the closure flow's footer (ClosurePresentation): the screen gutter
 * across, `md` over and under, `sm` between two lines.
 *
 * Safe area: a screen whose SafeAreaView already covers the bottom edge (every flow screen, edges top and bottom)
 * leaves `edge` out and the foot draws nothing extra. A screen whose frame stops short of the bottom passes
 * `edge="bottom"`, and the foot keeps clear of the home indicator itself, its surface reaching the edge of the screen.
 */
export function FlowFooter({ children, edge, testID = 'flow-footer' }: { children: ReactNode; edge?: 'bottom'; testID?: string }) {
  if (edge === 'bottom') return <SafeAreaView edges={['bottom']} testID={testID} style={s.footer}>{children}</SafeAreaView>;
  return <View testID={testID} style={s.footer}>{children}</View>;
}

const s = StyleSheet.create({
  footer: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.md, gap: sys.space.sm,
    backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
});
