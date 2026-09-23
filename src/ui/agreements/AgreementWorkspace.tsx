import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { type EyebrowTone } from '../system/DetailTopBar';
import { brandAction, card, sys, inset } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Presentation pieces of the Agreement workspace (DESIGN.md "Dogovor": a calm
 * workspace that leads with status and the next action; scan blocks; chat is
 * first-class; changes, cancellation and problems live under contextual rows).
 * No state lives here; the route owns reads, writes, journals and guards.
 * This module must stay free of reanimated hooks and inbox reads (route tests
 * isolate those), so it uses only Press/T/icons/V2Action.
 */

export type WorkspaceTone = EyebrowTone;
const toneColor: Record<WorkspaceTone, string> = { green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted, danger: sys.color.danger };
const toneSoft: Record<WorkspaceTone, string> = { green: sys.color.greenSoft, warn: sys.color.warnSoft, muted: sys.color.wash, danger: sys.color.dangerSoft };

export const stateTone = (state: DogovorProjekcija['stanje']): WorkspaceTone =>
  state === 'CANCELLED' ? 'muted' : state === 'AWAITING_REQUESTER' ? 'warn' : 'green';

export function WorkspaceCard({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: WorkspaceTone }) {
  return <View style={[card, s.cardGap, tone ? { backgroundColor: toneSoft[tone], borderColor: toneSoft[tone] } : null, style]}>{children}</View>;
}

/** The one dominant thing on the overview: what happens next, in the user's words, on a tinted surface. */
export function NextStepCard({ title, body, tone = 'green', children }: { title: string; body?: string | null; tone?: WorkspaceTone; children?: ReactNode }) {
  return <View accessibilityRole="summary" style={[s.next, { backgroundColor: toneSoft[tone] }]}>
    <View style={s.nextHead}><View style={[s.dot, { backgroundColor: toneColor[tone] }]} /><T variant="label" style={[s.eyebrow, { color: toneColor[tone] }]}>Sledeći korak</T></View>
    <T variant="heading" style={s.nextTitle}>{title}</T>
    {body ? <T variant="copy" tone="muted">{body}</T> : null}
    {children}
  </View>;
}

/** Contextual action as a row: label, optional hint, chevron. Label stays the screen's contract. */
export function WorkspaceRow({ label, hint, disabled = false, onPress }: { label: string; hint?: string; disabled?: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, disabled && s.rowDisabled]}>
    <View style={s.rowCopy}><T variant="bodyStrong" style={s.rowLabel}>{label}</T>{hint ? <T variant="note" tone="muted">{hint}</T> : null}</View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

export function WorkspaceRows({ children }: { children: ReactNode }) { return <View style={[card, s.rows]}>{children}</View>; }

export function WorkspaceNote({ children, tone = 'muted' }: { children: ReactNode; tone?: WorkspaceTone }) {
  return <View style={[s.note, { backgroundColor: toneSoft[tone] }]}>{children}</View>;
}

/** Sticky footer: exactly one brand action per state, optional secondary. */
export function WorkspaceFooter({ brand, secondary }: {
  brand: { label: string; onPress: () => void; disabled?: boolean };
  secondary?: { label: string; onPress: () => void; disabled?: boolean } | null;
}) {
  return <View style={s.footer}>
    <V2Action label={brand.label} disabled={brand.disabled} onPress={brand.onPress} style={brandAction} />
    {secondary ? <V2Action label={secondary.label} disabled={secondary.disabled} onPress={secondary.onPress} /> : null}
  </View>;
}

const s = StyleSheet.create({
  cardGap: { gap: 10 },
  eyebrow: { fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  next: { borderRadius: sys.radius.card, padding: 20, gap: 8 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  nextTitle: { color: sys.color.ink },
  rows: { padding: 0, overflow: 'hidden' },
  row: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: sys.color.line, marginTop: -1 },
  rowDisabled: { opacity: 0.5 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: sys.color.ink },
  note: { ...inset, padding: 16, gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
