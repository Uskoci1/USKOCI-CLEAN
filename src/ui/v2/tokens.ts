/** Executable USKOCI_SPOJ_V2.html: final :root plus .phone.lineage/.phone.v2
 * overrides, checked against renders/after/06_ai.png (canvas pixel #FBFCFB).
 * Scoped presentation values while legacy surfaces migrate; no global override. */
export const v2 = {
  color: { teal: '#2E7A6A', orange: '#FF7908', ink: '#143D35', ground: '#F5F7F6', canvas: '#FBFCFB',
    header: '#FAFCFB', surface: '#FFFFFF', soft: '#E9F3EE', line: '#DFE7E2', muted: '#52665E',
    context: '#EFF6F2', contextEnd: '#F7FAF8', contextLine: '#E2EBE5', answer: '#EAF3ED',
    controlLine: '#AFC9BB', danger: '#943A30', warm: '#FFF0E2' },
  radius: { input: 11, button: 13, card: 18, sheet: 24 },
  space: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24 },
  text: {
    body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    label: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const },
    title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
    hero: { fontSize: 25, lineHeight: 31, fontWeight: '700' as const },
  },
  target: { minimum: 44, primary: 50 },
  motion: { screenMs: 190, translateY: 5 },
} as const;
