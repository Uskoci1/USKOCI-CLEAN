import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';
import { InboxBell } from '../InboxBell';
import type { GlyphIcon, GlyphName } from './Glyph';
import { chrome, ChromeIconButton, ScreenChrome } from './ScreenChrome';

type HeaderIconButtonProps = ({ icon: GlyphIcon; glyph?: never } | { glyph: GlyphName; icon?: never }) & {
  label: string; hint?: string; active?: boolean; onPress: () => void;
  /** A word beside the glyph, for a command nobody can guess from a drawing (see `ChromeIconButton`). */ caption?: string;
  children?: ReactNode;
};

/**
 * A toggle beside the profile and the bell (search, filters): the one chrome icon button, spoken as selected or not;
 * `active` is shown by weight and colour together. A plain command uses `ChromeIconButton` itself. It takes a Glyph name
 * (`glyph="filters"`, the way forward) or a Phosphor component (`icon`, still accepted), and an optional `caption`.
 */
export function HeaderIconButton({ label, hint, active = false, onPress, caption, children, ...art }: HeaderIconButtonProps) {
  return <ChromeIconButton {...art} label={label} hint={hint} active={active} caption={caption} onPress={onPress}>{children}</ChromeIconButton>;
}

/**
 * The one header of the three tabs (V41, owner 2026-09-23): the profile on the left, the USKOČI mark in the middle,
 * the inbox on the right, and nothing between them. It is `ScreenChrome`'s root bar; this wrapper hands it the bell.
 * The default section name is spoken with the mark; showTitle opts into visible title chrome. `right` holds at most one screen control,
 * drawn before the bell.
 */
type ScreenHeaderProps = { title: string; onProfile: () => void; right?: ReactNode;
  /** A visible section title instead of the brand mark. Only opt-in callers omit their duplicate content heading. */
  showTitle?: boolean;
};

export function ScreenHeader({ title, onProfile, right, showTitle = false }: ScreenHeaderProps) {
  if (showTitle) return <TitledRootHeader title={title} onProfile={onProfile} right={right} />;
  return <ScreenChrome variant="root" title={title} onProfile={onProfile} right={right} bell={<InboxBell />} />;
}

/** One in-flow title. Large text/narrow windows put it below the controls, with no clipping or font cap.
 * The profile and bell retain the same host positions when the layout class changes; the bell never remounts for layout. */
function TitledRootHeader({ title, onProfile, right }: ScreenHeaderProps) {
  const { stacked } = useLayoutClass();
  const heading = <T variant="title" accessibilityRole="header" style={s.title}>{title}</T>;
  return <View style={s.header}>
    <View style={s.row}>
      <ChromeIconButton label="Moj profil" glyph="profile" tone="green" onPress={onProfile} />
      {!stacked ? <View style={s.copy}>{heading}</View> : null}
      <View style={s.actions}>{right}<InboxBell /></View>
    </View>
    {stacked ? <View style={s.stackedTitle}>{heading}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  header: { paddingHorizontal: chrome.paddingHorizontal, paddingVertical: chrome.paddingVertical },
  row: { minHeight: chrome.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: chrome.gap },
  copy: { flex: 1, minWidth: 0 },
  title: { color: sys.color.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, flexShrink: 0 },
  stackedTitle: { paddingTop: sys.space.sm },
});
