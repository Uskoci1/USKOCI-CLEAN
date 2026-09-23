import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { FactArt, type FactArtKind } from './FactArt';
import { SkeletonList } from './Skeleton';
import { brandAction, sys } from './tokens';

export type StateKind = 'empty' | 'loading' | 'error' | 'offline';
type StateAction = { label: string; onPress: () => void; accessibilityLabel?: string };

/** The picture each kind uses when the screen does not name one: its own subject for an empty list, a quiet sign otherwise. */
const DEFAULT_ART: Record<Exclude<StateKind, 'loading'>, FactArtKind> = { empty: 'tasks', error: 'info', offline: 'info' };

/**
 * Empty, loading, error and offline in one look (master design plan, 2026-09-24): a list that has nothing to show,
 * is still reading, could not read or has no connection says so the same way on every screen.
 *
 * - empty / error / offline: the FactArt picture at 56 px in a soft well, one title, one sentence, and at most one
 *   primary action (green) and one quiet action. Error and offline draw the picture grey and are announced as alerts;
 *   an empty list's title is a heading.
 * - loading: the existing breathing placeholders in the shape of the cards that are coming, and one quiet sentence a
 *   screen reader hears ("Učitavamo Dogovore…"). No action: nothing can be done while it reads.
 *
 * Presentation only; every action is the screen's own command.
 */
export function StateView({ kind = 'empty', art, title, body, primary, quiet, skeleton }: {
  kind?: StateKind;
  /** The picture; defaults to the kind's own. Not drawn while loading. */ art?: FactArtKind;
  /** One line. While loading it is the quiet sentence under the placeholders. */ title: string;
  /** One sentence under the title. */ body?: string;
  /** The one way forward, drawn as the screen's green action. */ primary?: StateAction;
  /** A second, quieter way. */ quiet?: StateAction;
  /** While loading: how many placeholder cards, and lines in each. */ skeleton?: { count?: number; rows?: number };
}) {
  if (kind === 'loading') return <View style={s.loading} accessibilityLiveRegion="polite">
    <SkeletonList count={skeleton?.count ?? 3} rows={skeleton?.rows} />
    <T variant="meta" tone="muted" style={s.center}>{title}</T>
  </View>;
  const trouble = kind === 'error' || kind === 'offline';
  return <View style={s.state} accessibilityLiveRegion="polite">
    <View style={s.art}><FactArt kind={art ?? DEFAULT_ART[kind]} size={56} muted={trouble} /></View>
    <T variant="title" accessibilityRole={trouble ? 'alert' : 'header'} style={s.title}>{title}</T>
    {body ? <T variant="copy" tone="muted" style={s.body}>{body}</T> : null}
    {primary ? <V2Action label={primary.label} accessibilityLabel={primary.accessibilityLabel} onPress={primary.onPress} style={brandAction} /> : null}
    {quiet ? <V2Action label={quiet.label} accessibilityLabel={quiet.accessibilityLabel} onPress={quiet.onPress} kind="quiet" /> : null}
  </View>;
}

const s = StyleSheet.create({
  loading: { gap: 16 },
  center: { textAlign: 'center' },
  state: { paddingVertical: 28, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  art: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { color: sys.color.ink },
  body: { marginBottom: 6 },
});
