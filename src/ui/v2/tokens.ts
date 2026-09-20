import { space, type } from '../../theme/tokens';
import { sys } from '../system/tokens';

/**
 * The last screens still speaking the older V2 palette, brought into the one system.
 *
 * These values came from the executable USKOCI_SPOJ_V2.html and were right for that moment. They
 * are not right beside PKG-011: teal #2E7A6A where the app now says green #176B55, ink #143D35
 * where it says #183A30, orange #FF7908 where it says #FF850F. Three colours that are almost the
 * app's colours, on the review screens the owner looks at most.
 *
 * Mapped by role rather than by nearest number, which is what a scale is for. The one visible
 * consequence is deliberate: a task title on the review used a 25px step of its own, and the
 * system calls a detail screen's real title `hero`. It is now that, and reads as the title it is.
 */
export const v2 = {
  color: {
    canvas: sys.color.surface,
    surface: sys.color.surface,
    header: sys.color.surface,
    ground: sys.color.wash,
    teal: sys.color.green,
    orange: sys.color.orange,
    ink: sys.color.ink,
    muted: sys.color.muted,
    line: sys.color.line,
    controlLine: sys.color.lineStrong,
    soft: sys.color.greenSoft,
    context: sys.color.wash,
    contextEnd: sys.color.surface,
    contextLine: sys.color.line,
    answer: sys.color.greenSoft,
    danger: sys.color.danger,
    warm: sys.color.orangeSoft,
  },
  space: { xs: space.xs, sm: space.sm, md: space.md, lg: space.lg, xl: space.xl },
  text: { body: type.body, label: type.label, title: type.title, hero: type.hero },
  target: { minimum: 44, primary: 50 },
  motion: { screenMs: 190, translateY: 5 },
} as const;
