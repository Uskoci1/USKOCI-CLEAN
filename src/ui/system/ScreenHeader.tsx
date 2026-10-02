import type { ReactNode } from 'react';
import { InboxBell } from '../InboxBell';
import type { GlyphIcon, GlyphName } from './Glyph';
import { ChromeIconButton, ScreenChrome } from './ScreenChrome';

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
 * The section's name reaches a screen reader as the header's label. `right` holds at most one screen control,
 * drawn before the bell.
 */
export function ScreenHeader({ title, onProfile, right }: { title: string; onProfile: () => void; right?: ReactNode }) {
  return <ScreenChrome variant="root" title={title} onProfile={onProfile} right={right} bell={<InboxBell />} />;
}
