import { sys } from '../system/tokens';

/** Auth uses the same white reading surfaces as the app. Names stay compatible with the guarded forms. */
export const authTheme = {
  surface: sys.color.surface, input: sys.color.surface,
  ink: sys.color.ink, muted: sys.color.muted, placeholder: sys.color.muted, line: sys.color.lineStrong,
  accent: sys.color.green, accentLight: sys.color.green, accentPressed: sys.conversation.user, buttonInk: sys.color.onGreen,
  error: sys.color.danger, soft: sys.color.wash, cream: sys.color.surface,
  divider: sys.color.line,
  sheet: sys.color.surface, methodSurface: sys.color.surface, methodLine: sys.color.cardLine,
  methodInk: sys.color.ink, methodIcon: sys.color.green, stateWell: sys.color.iconWell,
} as const;
