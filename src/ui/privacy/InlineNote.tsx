import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { inset, sys } from '../system/tokens';

/**
 * A note that sits in a screen's flow: a flat tint at control radius, a 22 px fact drawing and one or two sentences
 * (round 5, privacy / data / legal / support, owner step 11b). It replaces the pale green panels those screens used
 * for everything, where green said "fine" even over "not available", "not confirmed" and "failed".
 *
 * - `neutral`: the wash, ink words: a plain fact about the state.
 * - `quiet`: the wash, muted words: the same, said more softly ("Potpun raspored … još nije dostupan").
 * - `warn`: warnSoft, ink words: something waits for the person (an unconfirmed send, a preparation that did not run).
 * - `danger`: dangerSoft, danger words: a read or a command failed. Always spoken as an alert.
 *
 * It is never a card: it lies inside a screen or a card as a tint, so there is no card inside a card.
 */
export type NoteTone = 'neutral' | 'quiet' | 'warn' | 'danger';

export function InlineNote({ tone = 'neutral', art = 'info', artMuted, alert, children, testID }: {
  tone?: NoteTone; art?: FactArtKind | null; artMuted?: boolean;
  /** Spoken as an alert when it appears; `danger` always is. */ alert?: boolean;
  children: ReactNode; testID?: string;
}) {
  const spoken = alert || tone === 'danger';
  return <View testID={testID} style={[s.note, tone === 'warn' ? s.warn : tone === 'danger' ? s.danger : s.wash]}
    accessibilityLiveRegion={spoken ? 'polite' : undefined}>
    {art ? <View style={s.art}><FactArt kind={art} size={22} muted={artMuted ?? (tone === 'danger' || tone === 'quiet')} /></View> : null}
    <View style={s.copy}>
      {typeof children === 'string'
        ? <T variant="note" tone={tone === 'danger' ? 'danger' : tone === 'quiet' ? 'muted' : 'ink'} accessibilityRole={spoken ? 'alert' : undefined}>{children}</T>
        : children}
    </View>
  </View>;
}

/**
 * The header of a settings group without its card: the same small muted label `SettingsGroup` draws, for a group whose
 * content is not a list (a loading placeholder, a note), where a card around it would be a card around a card.
 */
export function PlainSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={s.section}>
    <T variant="label" accessibilityRole="header" style={s.sectionTitle}>{title}</T>
    {children}
  </View>;
}

/** One line of a list that opens nothing: the settings row's measure, with no caret and no press. */
export function PlainRow({ label, detail, last = false }: { label: string; detail?: string; last?: boolean }) {
  return <View style={[s.row, last && s.last]}>
    <T variant="bodyStrong">{label}</T>
    {detail ? <T variant="note" tone="muted">{detail}</T> : null}
  </View>;
}

/** A fact drawing beside one quiet line, with no box: a statement about the whole screen (who sees a support request). */
export function QuietLine({ art, children }: { art: FactArtKind; children: ReactNode }) {
  return <View style={s.line}>
    <View style={s.art}><FactArt kind={art} size={22} /></View>
    <T variant="note" tone="muted" style={s.lineCopy}>{children}</T>
  </View>;
}

const s = StyleSheet.create({
  note: { ...inset, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  wash: { backgroundColor: sys.color.wash },
  warn: { backgroundColor: sys.color.warnSoft },
  danger: { backgroundColor: sys.color.dangerSoft },
  art: { paddingTop: 1 },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // SettingsGroup's own header measure, so a group with a card and one without read as one family.
  section: { marginBottom: 20, gap: 10 },
  sectionTitle: { color: sys.color.muted, letterSpacing: 0.4, paddingHorizontal: 2 },
  row: { minHeight: 54, paddingVertical: 13, gap: 2, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: sys.color.line },
  last: { borderBottomWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  lineCopy: { flex: 1, minWidth: 0 },
});
