import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, Plus } from 'phosphor-react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import type { HomeRow, HomeSection, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import type { OwnedTaskCounts } from '../../data/marketplaceView';
import type { ApplicationCounts } from '../../data/myApplicationsView';
import { ScreenHeader } from '../system/ScreenHeader';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys, card, cardCompact } from '../system/tokens';
import { plural, prijava } from '../system/plural';
import { HomeIllustration } from './HomeIllustration';

/**
 * Početna, the overview (owner's information architecture, 2026-09-23): the two big start tiles, what waits for me,
 * the next Dogovor when there is one, and two front doors — "Moji zadaci" and "Moje prijave" — each counted by the
 * rule of the list it opens. The display headline greets only a first run. The HTML is visual evidence only: no
 * example people, dates, counts or commands enter the app. Both start actions remain available before any read
 * completes and when a read fails.
 *
 * A row only ever navigates. Nothing here confirms, withdraws, selects or completes.
 */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /** The Dogovori tab, where a finished Dogovor waits for its rating. */
  onAgreements: () => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
};

/** A start tile: its picture, what it does and one quiet line. The destination's own icon, no arrow (2026-09-23). */
function StartTile({ label, hint, publish = false, stacked, onPress }: {
  label: string; hint: string; publish?: boolean; stacked: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    haptic="select" onPress={onPress} style={[s.action, stacked && s.actionStacked, publish && s.publish]}>
    <View style={s.actionTop}>
      {publish ? <Plus size={24} weight="bold" color={sys.color.onOrange} /> : <FactArt kind="map" size={26} />}
      <T variant="action" style={[s.actionLabel, publish && s.onOrange]}>{label}</T>
    </View>
    <T variant="meta" style={publish ? s.onOrange : s.muted}>{hint}</T>
  </Press>;
}

function Row({ row, onOpen, kind, last = false }: {
  row: HomeRow; onOpen: (target: HomeTarget) => void; kind: 'attention' | 'agreement'; last?: boolean;
}) {
  // The same coloured illustration the cards use for this kind of thing (owner, 2026-09-23: thin grey glyphs sat here while the rest of the app was illustrated).
  const art: FactArtKind = kind === 'agreement' ? 'calendar' : row.target.kind === 'CANDIDATES' ? 'users'
    : row.target.kind === 'APPLICATION' ? 'offers' : row.target.kind === 'AGREEMENT' ? 'agreements' : 'tasks';
  return <Press accessibilityRole="button" accessibilityLabel={`${readableTitle(row.title)}. ${row.detail}`} haptic="select" scaleTo={0.99}
    onPress={() => onOpen(row.target)} style={[s.row, kind === 'agreement' && s.agreement, last && s.lastRow]}>
    <View style={[s.rowIcon, kind === 'attention' && s.attentionIcon, kind === 'agreement' && s.calendarIcon]}>
      <FactArt kind={art} size={kind === 'agreement' ? 30 : 28} />
    </View>
    <View style={s.rowCopy}>
      <T variant="bodyStrong">{readableTitle(row.title)}</T>
      <T variant="note" tone="muted">{row.detail}</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

/** A front door to one of my lists: its name and, once read, what is in it. It opens the list even when unread. */
function MineRow({ art, title, detail, onPress, last = false }: {
  art: FactArtKind; title: string; detail: string | null; onPress: () => void; last?: boolean;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={detail ? `${title}. ${detail}` : title} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, s.mineRow, last && s.lastRow]}>
    <View style={s.rowIcon}><FactArt kind={art} size={28} /></View>
    <View style={s.rowCopy}>
      <T variant="bodyStrong">{title}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead}>
      <T accessibilityRole="header" variant="heading" style={s.flexible}>{title}</T>
      {count != null && count > 0 ? <View style={s.counter}><T variant="meta" style={s.link}>{count}</T></View> : null}
    </View>
    {children}
  </View>;
}

/** A section that could not be read says so and offers the read again. It is never drawn as empty. */
function Unavailable({ what, onRefresh }: { what: string; onRefresh: () => void }) {
  return <View style={s.unavailable}>
    <T accessibilityLiveRegion="polite" variant="note" tone="muted">{`${what} trenutno nisu učitani.`}</T>
    <V2Action label="Pokušaj ponovo" kind="quiet" compact onPress={onRefresh} />
  </View>;
}

const Skeleton = () => <View accessibilityLabel="Učitavanje" style={s.skeletonBlock}>
  {[0, 1].map(index => <View key={index} style={s.skeletonRow} />)}
</View>;

// The two doors count what their lists hold, never what waits: that is said once, under "Čeka te", from the server's
// own attention list (PKG-042: no inference fallback). A door that also said "1 čeka izbor" contradicted a known empty
// "Čeka te", and stood in for it when that list could not be read.
/** "2 aktivna · 1 nacrt" — the sets of "Moji zadaci", counted by the list's own filter. */
function tasksLine(section: HomeSection<OwnedTaskCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nisu učitani';
  const c = section.value;
  const parts = [c.active ? plural(c.active, 'aktivan', 'aktivna', 'aktivnih') : null,
    c.drafts ? plural(c.drafts, 'nacrt', 'nacrta', 'nacrta') : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.total ? 'Nema aktivnih zadataka' : 'Još nemaš Zadatak';
}
/**
 * "3 aktivne" — the "Aktivne" set of "Moje prijave", counted by the list's own tabs. An application that waits for me
 * sits in the list's own "Čeka te" set, not in "Aktivne", so a door with nothing active that is not all finished names
 * how many applications there are instead of saying "Nema aktivnih prijava" over one that waits.
 */
function applicationsLine(section: HomeSection<ApplicationCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nisu učitane';
  const c = section.value;
  if (c.active) return plural(c.active, 'aktivna', 'aktivne', 'aktivnih');
  return !c.total ? 'Još nemaš prijavu' : c.finished === c.total ? 'Nema aktivnih prijava' : prijava(c.total);
}

export function HomePresentation(p: HomePresentationProps) {
  const home = p.home;
  const { width, fontScale } = useWindowDimensions();
  const expanded = fontScale >= 1.3 || width < 340;
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a
  // genuinely new one moves, and each list remembers what it has already shown.
  const waiting = useAppear(), agreements = useAppear();
  waiting.settle((home?.attention ?? []).map(item => item.id));
  const next = home?.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  agreements.settle(next ? [next.id] : []);
  const attentionUnavailable = home?.attentionState === 'unavailable';
  // Server rows keep their own count; a finished Dogovor waiting for my rating stands under them, never counted with them.
  const waitingShown = !!home && (attentionUnavailable || home.attention.length > 0 || home.ratingsDue > 0);
  // Before the first answer a front door has no line; after a failed read it says so, never "0".
  const tasksDetail = home ? tasksLine(home.mine.tasks) : p.error ? 'Trenutno nisu učitani' : null;
  const applicationsDetail = home ? applicationsLine(home.mine.applications) : p.error ? 'Trenutno nisu učitane' : null;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.canvas}>
    {/* The one header of the three tabs (V41): profile left, the mark in the middle, the inbox right. */}
    <ScreenHeader title="Početna" onProfile={p.onProfile} />
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      {/* The tiles are the first thing on screen and never move: nothing above them waits for a read. */}
      <View style={[s.actions, expanded && s.actionsStacked]}>
        <StartTile label="Objavi zadatak" hint="Opiši šta ti treba" publish stacked={expanded} onPress={p.onPublish} />
        <StartTile label="Uskoči i zaradi" hint="Pronađi posao blizu" stacked={expanded} onPress={p.onEarn} />
      </View>

      {p.loading && !home ? <Skeleton /> : null}
      {p.error && !home ? <View style={s.section}><Unavailable what="Tvoji zadaci, prijave i Dogovori" onRefresh={p.onRefresh} /></View> : null}
      {/* The greeting belongs to a first visit, and a first visit is known only once every read has answered. Above
          the tiles it pushed them down under the finger at the first impression; here it takes the loading's place. */}
      {home?.firstRun ? <View style={s.hero}>
        <T accessibilityRole="header" variant="display" style={s.heroCopy}>{'Šta rešavamo\ndanas?'}</T>
        {!expanded ? <HomeIllustration size={width < 375 ? 88 : 109} /> : null}
      </View> : null}

      {home && waitingShown ? <Section title="Čeka te"
        count={home.attention.length > 0 && (home.attentionState === 'known' || !home.partial) ? home.attention.length + home.attentionMore : undefined}>
        {attentionUnavailable ? <Unavailable what="Podaci o obavezama" onRefresh={p.onRefresh} /> : null}
        {home.attention.length > 0 ? <View style={s.attention}>
          {home.attention.map((item, index) => <Appear key={item.id} index={index} animate={waiting.isNew(item.id)}>
            <Row row={item} onOpen={p.onOpen} kind="attention" last={index === home.attention.length - 1} /></Appear>)}
        </View> : null}
        {home.attentionMore > 0 ? <T variant="note" tone="muted" style={s.more}>I još {home.attentionMore} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
        {/* Dogovori/Aktivni lists a completed Dogovor until it is rated; Home names the same thing (2026-09-23). */}
        {home.ratingsDue > 0 ? <Press accessibilityRole="button" onPress={p.onAgreements} haptic="select" style={s.ratingsDue}
          accessibilityLabel={`${dogovoraCekaOcenu(home.ratingsDue)} · otvori Dogovore`}>
          <View style={s.ratingsDot} />
          <T variant="note" style={s.ratingsDueText}>{dogovoraCekaOcenu(home.ratingsDue)}</T>
          <CaretRight size={18} color={sys.color.warn} />
        </Press> : null}
      </Section> : null}

      {/* One next Dogovor, and only when there is one; the rest are in the Dogovori tab. A failed read says so. */}
      {home?.agreements.kind === 'unavailable' ? <Section title="Sledeći Dogovor"><Unavailable what="Dogovori" onRefresh={p.onRefresh} /></Section>
        : next ? <Section title="Sledeći Dogovor">
          <Appear index={0} animate={agreements.isNew(next.id)}><Row row={next} onOpen={p.onOpen} kind="agreement" /></Appear>
        </Section> : null}

      <View style={s.mine}>
        <MineRow art="tasks" title="Moji zadaci" detail={tasksDetail} onPress={p.onMyTasks} />
        <MineRow art="offers" title="Moje prijave" detail={applicationsDetail} onPress={p.onMyApplications} last />
      </View>
    </ScrollView>
  </SafeAreaView>;
}


/** "Jedan završen Dogovor čeka tvoju ocenu" / "2 završena Dogovora čekaju tvoju ocenu". */
function dogovoraCekaOcenu(count: number): string {
  return count === 1 ? 'Jedan završen Dogovor čeka tvoju ocenu'
    // plural() already carries the count; the emulator showed "2 2 završena Dogovora" when it was added twice.
    : `${plural(count, 'završen Dogovor čeka', 'završena Dogovora čekaju', 'završenih Dogovora čeka')} tvoju ocenu`;
}

const s = StyleSheet.create({
  // V41 strip: what waits for me reads on a warm band in dark orange (orange text on white was 2.5:1).
  ratingsDue: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, marginTop: sys.space.sm, paddingHorizontal: 14,
    borderRadius: sys.radius.control, backgroundColor: sys.color.orangeSoft, borderWidth: 1, borderColor: sys.color.orangeHalo },
  ratingsDot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  ratingsDueText: { flex: 1, color: sys.color.warn, fontWeight: '600' },
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flexible: { flexShrink: 1 }, muted: { color: sys.color.muted }, onOrange: { color: sys.color.onOrange },
  hero: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 108, marginTop: sys.space.xl },
  heroCopy: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: sys.space.md },
  actionsStacked: { flexDirection: 'column' },
  // Lower than before (120 → 96) and without the arrow: the tile is the button, its picture says where it goes.
  action: { ...card, flex: 1, minWidth: 0, minHeight: 96, padding: sys.space.base, gap: sys.space.sm, justifyContent: 'space-between' },
  actionStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  publish: { backgroundColor: sys.color.orange, borderColor: sys.color.orange },
  actionTop: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  actionLabel: { flexShrink: 1 },
  // V41: what needs my answer sits on one warm band, its rows white inside it.
  attention: { borderRadius: sys.radius.card, backgroundColor: sys.color.orangeSoft, borderWidth: 1,
    borderColor: sys.color.orangeHalo, paddingHorizontal: 14 },
  section: { marginTop: sys.space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 40, marginBottom: sys.space.xs },
  counter: { minWidth: 26, minHeight: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  link: { color: sys.color.green, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 76, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  attentionIcon: { width: 40, height: 42, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface },
  calendarIcon: { width: 48, height: 58, borderRadius: sys.radius.chip, backgroundColor: sys.color.wash },
  agreement: { ...cardCompact, padding: 14, borderBottomWidth: 1, borderBottomColor: sys.color.cardLine },
  rowCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The two front doors close the screen as plain rows under a hairline, not as two more cards.
  mine: { marginTop: sys.space.xl },
  mineRow: { minHeight: 64, paddingVertical: sys.space.md },
  more: { paddingVertical: sys.space.sm },
  unavailable: { gap: sys.space.xs, paddingVertical: sys.space.md, alignItems: 'flex-start' },
  skeletonBlock: { marginTop: sys.space.xl, gap: sys.space.base },
  skeletonRow: { height: 76, borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.skeleton },
});
