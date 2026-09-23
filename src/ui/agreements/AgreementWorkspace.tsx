import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { type EyebrowTone } from '../system/DetailTopBar';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { brandAction, sys, inset } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Presentation pieces of the Agreement workspace, recomposed from zero (owner, 2026-09-23: the HTML
 * prototypes document function, not layout). A Dogovor is read in one pass: the terms, where it
 * stands, the people, then everything that can be opened as flat rows under hairlines. A tint is
 * spent only where something waits for a person (a proposal, a confirmation, a problem); nothing
 * else is a box. No state lives here; the route owns reads, writes, journals and guards.
 * This module must stay free of reanimated hooks and inbox reads (route tests isolate those),
 * so it uses only Press/T/icons/V2Action.
 */

export type WorkspaceTone = EyebrowTone;
const toneColor: Record<WorkspaceTone, string> = { green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted, danger: sys.color.danger };
const toneSoft: Record<WorkspaceTone, string> = { green: sys.color.greenSoft, warn: sys.color.warnSoft, muted: sys.color.wash, danger: sys.color.dangerSoft };

export const stateTone = (state: DogovorProjekcija['stanje']): WorkspaceTone =>
  state === 'CANCELLED' ? 'muted' : state === 'AWAITING_REQUESTER' ? 'warn' : 'green';

/** A part of the workspace. A tone tints it only when it asks for attention (warn, danger); otherwise it is a hairline and air. */
export function WorkspaceCard({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: WorkspaceTone }) {
  const tinted = tone === 'warn' || tone === 'danger';
  return <View style={[tinted ? [inset, s.tinted, { backgroundColor: toneSoft[tone!] }] : s.flat, style]}>{children}</View>;
}

/**
 * Where the Dogovor stands and what comes next, said once: a dot in the state's colour and a sentence.
 * The eyebrow "Sledeći korak" is gone (owner, 2026-09-23: no copy explaining where you are); a soft
 * tint remains only when the step waits for someone.
 */
export function NextStepCard({ title, body, tone = 'green', children }: { title: string; body?: string | null; tone?: WorkspaceTone; children?: ReactNode }) {
  const waits = tone === 'warn' || tone === 'danger';
  return <View accessibilityRole="summary" style={waits ? [inset, s.tinted, { backgroundColor: toneSoft[tone] }] : s.next}>
    <View style={s.nextHead}><View style={[s.dot, { backgroundColor: toneColor[tone] }]} />
      <T variant="bodyStrong" style={s.nextTitle}>{title}</T></View>
    {body ? <T variant="note" tone="muted" style={s.nextBody}>{body}</T> : null}
    {children}
  </View>;
}

/** Contextual action as a row: its art, the label, an optional hint, the caret. Label stays the screen's contract. */
export function WorkspaceRow({ label, hint, art, disabled = false, onPress }: { label: string; hint?: string; art?: FactArtKind; disabled?: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, disabled && s.rowDisabled]}>
    {art ? <View style={s.rowArt}><FactArt kind={art} size={26} /></View> : null}
    <View style={s.rowCopy}><T variant="bodyStrong" style={s.rowLabel}>{label}</T>{hint ? <T variant="note" tone="muted">{hint}</T> : null}</View>
    <CaretRight size={20} color={sys.color.muted} />
  </Press>;
}

/** Rows one under the other, each under its own hairline; no card around them. */
export function WorkspaceRows({ children }: { children: ReactNode }) { return <View>{children}</View>; }

export function WorkspaceNote({ children, tone = 'muted' }: { children: ReactNode; tone?: WorkspaceTone }) {
  return <View style={[s.note, { backgroundColor: toneSoft[tone] }]}>{children}</View>;
}

/**
 * Sticky footer: exactly one brand action per state. The second button, "Otvori poruke", is gone: the
 * Poruke tab stands at the top of the same screen, so the footer said it twice and took a quarter of it.
 */
export function WorkspaceFooter({ brand }: { brand: { label: string; onPress: () => void; disabled?: boolean } }) {
  return <View style={s.footer}>
    <V2Action label={brand.label} disabled={brand.disabled} onPress={brand.onPress} style={brandAction} />
  </View>;
}

const s = StyleSheet.create({
  flat: { gap: 10, paddingTop: 18, borderTopWidth: 1, borderTopColor: sys.color.line },
  tinted: { gap: 8, padding: 16 },
  next: { gap: 6 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill },
  nextTitle: { color: sys.color.ink, flexShrink: 1, fontSize: 17, lineHeight: 23 },
  nextBody: { paddingLeft: 17 },
  row: { minHeight: 60, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderColor: sys.color.line },
  rowArt: { width: 32, alignItems: 'center' },
  rowDisabled: { opacity: 0.5 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: sys.color.ink },
  note: { ...inset, padding: 16, gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
