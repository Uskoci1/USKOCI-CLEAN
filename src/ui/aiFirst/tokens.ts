/** V5 AI-FIRST tokens, scoped to conversation/review. Entry assets stay isolated. */
export const aiFirst = {
  color: { surface: '#FFFFFF', ink: '#183A30', muted: '#586B62', green: '#176B55',
    orange: '#FF850F', line: '#E3EBE6', wash: '#F2F7F4', warm: '#FFF6EC', danger: '#963F34', money: '#205C45' },
  radius: { card: 23, compactCard: 18, composer: 19, primary: 17, chip: 13 },
  text: { title: { fontSize: 21, lineHeight: 28, fontWeight: '700' as const },
    card: { fontSize: 20, lineHeight: 27, fontWeight: '700' as const },
    body: { fontSize: 16, lineHeight: 24 }, meta: { fontSize: 13, lineHeight: 19 },
    money: { fontSize: 23, lineHeight: 30, fontWeight: '700' as const } },
} as const;
