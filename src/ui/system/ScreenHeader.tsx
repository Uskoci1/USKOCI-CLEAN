import type { ReactNode } from 'react';
import type { Icon } from 'phosphor-react-native';
import { InboxBell } from '../InboxBell';
import { ChromeIconButton, ScreenChrome } from './ScreenChrome';

/**
 * A toggle beside the profile and the bell (search, filters): the one chrome icon button, spoken as selected or not;
 * `active` is shown by weight and colour together. A plain command uses `ChromeIconButton` itself.
 */
export function HeaderIconButton({ label, hint, icon, active = false, onPress, children }: {
  label: string; hint?: string; icon: Icon; active?: boolean; onPress: () => void; children?: ReactNode;
}) {
  return <ChromeIconButton label={label} hint={hint} icon={icon} active={active} onPress={onPress}>{children}</ChromeIconButton>;
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
