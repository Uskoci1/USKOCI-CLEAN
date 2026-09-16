import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Icon } from '../v2/icons';
import { V2Action } from '../v2/V2Action';

/**
 * Presentation pieces of the Agreement workspace (DESIGN.md "Dogovor": a calm
 * workspace that leads with status and the next action; scan blocks; chat is
 * first-class; changes, cancellation and problems live under contextual rows).
 * No state lives here; the route owns reads, writes, journals and guards.
 * This module must stay free of reanimated hooks and inbox reads (route tests
 * isolate those), so it uses only Press/T/V2Icon/V2Action.
 */

export type WorkspaceTone = 'green' | 'warn' | 'muted' | 'danger';
const toneColor: Record<WorkspaceTone, string> = { green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted, danger: sys.color.danger };
const toneSoft: Record<WorkspaceTone, string> = { green: sys.color.greenSoft, warn: sys.color.warnSoft, muted: sys.color.ground, danger: sys.color.dangerSoft };

export const stateTone = (state: DogovorProjekcija['stanje']): WorkspaceTone =>
  state === 'CANCELLED' ? 'muted' : state === 'AWAITING_REQUESTER' ? 'warn' : 'green';

/** Back + eyebrow + title. The eyebrow carries the Agreement state (or the other party in Poruke). */
export function WorkspaceTopBar({ eyebrow, title, tone = 'muted', onBack }: { eyebrow: string; title: string; tone?: WorkspaceTone; onBack: () => void }) {
  return <View style={s.topBar}>
    <Press accessibilityRole="button" accessibilityLabel="Nazad" haptic="select" onPress={onBack} style={s.back}><V2Icon name="back" /></Press>
    <View style={s.topCopy}>
      <T variant="meta" style={[s.eyebrow, { color: toneColor[tone] }]}>{eyebrow}</T>
      <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
    </View>
  </View>;
}

export function WorkspaceCard({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: WorkspaceTone }) {
  return <View style={[s.card, tone ? { backgroundColor: toneSoft[tone], borderColor: toneSoft[tone] } : null, style]}>{children}</View>;
}

/** The one dominant thing on the overview: what happens next, in the user's words. */
export function NextStepCard({ title, body, tone = 'green', children }: { title: string; body?: string | null; tone?: WorkspaceTone; children?: ReactNode }) {
  return <View accessibilityRole="summary" style={[s.next, { borderColor: toneColor[tone] }]}>
    <View style={s.nextHead}><View style={[s.dot, { backgroundColor: toneColor[tone] }]} /><T variant="meta" style={[s.eyebrow, { color: toneColor[tone] }]}>Sledeći korak</T></View>
    <T variant="heading" style={s.nextTitle}>{title}</T>
    {body ? <T variant="body" tone="muted">{body}</T> : null}
    {children}
  </View>;
}

/** Contextual action as a row: label, optional hint, chevron. Label stays the screen's contract. */
export function WorkspaceRow({ label, hint, disabled = false, onPress }: { label: string; hint?: string; disabled?: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, disabled && s.rowDisabled]}>
    <View style={s.rowCopy}><T variant="bodyStrong" style={s.rowLabel}>{label}</T>{hint ? <T variant="meta" tone="muted">{hint}</T> : null}</View>
    <V2Icon name="chevron" size={18} color={sys.color.muted} />
  </Press>;
}

export function WorkspaceRows({ children }: { children: ReactNode }) { return <View style={s.rows}>{children}</View>; }

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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topCopy: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { fontWeight: '600' },
  title: { color: sys.color.ink },
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18, gap: 10 },
  next: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1.5, padding: 18, gap: 8 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nextTitle: { color: sys.color.ink },
  rows: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, overflow: 'hidden' },
  row: { minHeight: 58, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: sys.color.line, marginTop: -1 },
  rowDisabled: { opacity: 0.5 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: sys.color.ink },
  note: { borderRadius: sys.radius.card, padding: 16, gap: 8 },
  footer: { padding: 18, paddingTop: 12, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
