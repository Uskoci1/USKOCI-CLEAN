import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useBreath } from './Arrive';
import { sys, cardCompact } from './tokens';

/** Placeholder that matches the final geometry; the list breathes as one while it waits (V41), never per block. */
function SkeletonBlock({ width, height, radius = 8 }: { width: DimensionValue; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: sys.color.skeleton }} />;
}
/**
 * One line of text as a block, centred in the line's own height so rows keep their measure. A share of the width
 * ("60%") takes the rest of its row first, so the share has a width to be measured against.
 */
function SkeletonLine({ width, line, height }: { width: DimensionValue; line: number; height: number }) {
  return <View style={[s.line, { minHeight: line }, typeof width === 'string' && s.grow]}><SkeletonBlock width={width} height={height} radius={6} /></View>;
}

/**
 * Which shape is coming (r6 on the emulator, b4531ef4: every loading state drew a task card, with an avatar and chips,
 * where a flat thread, three facts or a bare face arrived, so the layout jumped and a card stood where the rule forbids
 * one). Each variant is the geometry of one real screen, at that screen's own padding, gaps and line heights:
 *
 * - `task`: the task card of the Zadaci and Moji zadaci lists (card review r3 item 11, after its foot gained a 32 px
 *   avatar and two lines): the title with its value beside it, the fact lines with their 16 px drawings, and the foot
 *   with the count on the left and the person on the right, at TaskCard's measure.
 * - `plain`: every other card (a Prijava, a Dogovor, a task's detail, legal documents, the export): a title and its
 *   lines over a quiet foot, with no person drawn, because what arrives there has none in that place (verifier r3b vc,
 *   nit 4).
 * - `preview`: the publish review's "Ovako će drugi videti zadatak" card (ReviewPreview): the task head and `rows`
 *   fact lines on a compact card, no foot and no person.
 * - `face`: the application composer's task face (TaskHead): the same head and fact lines, bare, closed by the
 *   composer's own hairline; no card.
 * - `thread`: one item of the Q&A thread (TaskQaPresentation): the question in bold, the answer behind a 3 px rule and
 *   indented, parted from the next item by a hairline; no frame. `count` is the number of items, `rows` the answer's
 *   lines.
 * - `facts`: the Izmene terms (AgreementActionsPresentation's Fact): a 24 px drawing beside a label and its value,
 *   `rows` of them, no frame.
 * - `person`: the rating screen (AgreementReviewPresentation, eligible): the 56 px face beside the name and role, the
 *   question, five star blanks and the tag pills under a hairline; no frame.
 */
export type SkeletonVariant = 'plain' | 'task' | 'preview' | 'face' | 'thread' | 'facts' | 'person';

/** What every placeholder tells assistive technology: nothing to read here, the sentence under it says it all. */
const hidden = { importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true } as const;

/** TaskFace's head: the title line with the value slot beside it. */
function Head() {
  return <View style={s.head}>
    <SkeletonLine width="78%" line={22} height={18} />
    <SkeletonLine width={72} line={22} height={18} />
  </View>;
}
/** TaskFace's fact line: a 16 px drawing and the fact at its 19 px line. */
function FactLine({ width }: { width: DimensionValue }) {
  return <View style={s.fact}><SkeletonBlock width={16} height={16} radius={sys.radius.pill} /><SkeletonLine width={width} line={19} height={13} /></View>;
}
const factWidth = (index: number): DimensionValue => index ? '44%' : '60%';

export function SkeletonCard({ rows = 2, variant = 'plain' }: { rows?: number; variant?: SkeletonVariant }) {
  if (variant === 'plain') return <View {...hidden} style={s.plain}>
    <SkeletonBlock width="78%" height={22} radius={7} />
    {Array.from({ length: rows }, (_, index) => <SkeletonBlock key={index} width={index ? '44%' : '60%'} height={14} radius={6} />)}
    <View style={s.plainFoot}><SkeletonBlock width={112} height={24} radius={7} /><SkeletonBlock width={58} height={18} radius={6} /></View>
  </View>;
  if (variant === 'preview' || variant === 'face') return <View {...hidden} style={variant === 'preview' ? s.preview : s.face}>
    <Head />
    {Array.from({ length: rows }, (_, index) => <FactLine key={index} width={factWidth(index)} />)}
  </View>;
  if (variant === 'thread') return <View {...hidden} style={s.threadItem}>
    <SkeletonLine width="72%" line={24} height={18} />
    <View style={s.answer}>
      <SkeletonLine width={64} line={18} height={12} />
      {Array.from({ length: rows }, (_, index) => <SkeletonLine key={index} width={index ? '58%' : '88%'} line={24} height={14} />)}
    </View>
  </View>;
  if (variant === 'facts') return <View {...hidden} style={s.factRows}>
    {Array.from({ length: rows }, (_, index) => <View key={index} style={s.factRow}>
      <SkeletonBlock width={24} height={24} radius={sys.radius.pill} />
      <View style={s.factCopy}>
        <SkeletonLine width={56} line={18} height={12} />
        <SkeletonLine width={index ? '52%' : '40%'} line={24} height={14} />
      </View>
    </View>)}
  </View>;
  if (variant === 'person') return <View {...hidden} style={s.personScreen}>
    <View style={s.personRow}>
      <SkeletonBlock width={56} height={56} radius={sys.radius.pill} />
      <View style={s.personCopy}>
        <SkeletonLine width="64%" line={26} height={20} />
        <SkeletonLine width={96} line={18} height={12} />
      </View>
    </View>
    <SkeletonLine width="56%" line={24} height={18} />
    <View style={s.starRow}>{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} width={40} height={40} radius={sys.radius.control} />)}</View>
    <View style={s.tagSection}>
      <SkeletonLine width="48%" line={24} height={18} />
      <View style={s.tags}>{[104, 80, 128, 96].map((width, index) => <SkeletonBlock key={index} width={width} height={48} radius={sys.radius.pill} />)}</View>
    </View>
  </View>;
  return <View {...hidden} style={s.card}>
    <Head />
    <View style={s.facts}>
      {Array.from({ length: rows }, (_, index) => <FactLine key={index} width={factWidth(index)} />)}
    </View>
    <View style={s.foot}>
      <View style={s.fact}><SkeletonBlock width={16} height={16} radius={sys.radius.pill} /><SkeletonLine width={96} line={19} height={13} /></View>
      <View style={s.person}>
        <SkeletonBlock width={32} height={32} radius={sys.radius.pill} />
        <View><SkeletonLine width={84} line={17} height={12} /><SkeletonLine width={48} line={17} height={12} /></View>
      </View>
    </View>
  </View>;
}

export function SkeletonList({ count = 3, rows, variant }: { count?: number; rows?: number; variant?: SkeletonVariant }) {
  const opacity = useBreath();
  // Thread items part themselves with their own hairline, as the loaded thread does; every other shape stands 12 apart.
  return <Animated.View style={[variant === 'thread' ? s.thread : s.list, { opacity }]}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} rows={rows} variant={variant} />)}</Animated.View>;
}

const s = StyleSheet.create({
  // The plain card: the card frame, its lines 10 apart, and a quiet foot under a hairline.
  plain: { ...cardCompact, gap: 10 },
  plainFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: sys.color.line },
  // TaskCard's frame and body: the card corner and hairline, 16 across, 15 over and 14 under, 8 between the lines.
  card: { ...cardCompact, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14, gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  line: { justifyContent: 'center' },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { gap: 12 },
  thread: {},
  // ReviewPreview's card (ReviewPresentation s.card): the compact card, head and facts 8 apart, nothing under them.
  preview: { ...cardCompact, gap: sys.space.sm },
  // The composer's task face (ApplicationComposerPresentation s.task): bare, over its own hairline.
  face: { gap: sys.space.sm, paddingBottom: sys.space.lg, borderBottomWidth: 1, borderColor: sys.color.line },
  // One Q&A item (TaskQaPresentation s.item / s.answer): the rule is drawn in the placeholder tone, not the green.
  threadItem: { gap: sys.space.sm, paddingVertical: sys.space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.cardLine },
  answer: { gap: sys.space.xs, paddingLeft: sys.space.md, borderLeftWidth: 3, borderLeftColor: sys.color.skeleton },
  // The Izmene terms (AgreementActionsPresentation s.facts / s.fact): 24 px drawing, label over value.
  factRows: { gap: sys.space.md },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  // The rating screen (AgreementReviewPresentation s.content / s.person / s.starRow / s.section / s.tags).
  personScreen: { gap: sys.space.lg },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  personCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: sys.space.sm },
  tagSection: { gap: sys.space.sm, paddingTop: sys.space.lg, borderTopWidth: 1, borderColor: sys.color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingTop: sys.space.xs },
});
