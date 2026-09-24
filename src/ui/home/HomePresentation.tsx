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
import { useTextScale } from '../system/textScale';
import { HomeIllustration } from './HomeIllustration';

/**
 * Početna, the overview (owner's information architecture, 2026-09-23): the two big start tiles, what waits for me,
 * the next Dogovor when there is one, and two front doors — "Moji zadaci" and "Moje prijave" — each counted by the
 * rule of the list it opens. The display headline greets only a first run. The HTML is visual evidence only: no
 * example people, dates, counts or commands enter the app. Both start actions remain available before any read
 * completes and when a read fails.
 *
 * One orange fill on the screen, the publish tile (emulator critique B1, 2026-09-24); what waits for me is marked by
 * orange dots and dark-orange words on a pale band, never by another orange surface or an orange outline.
 *
 * A row only ever navigates. Nothing here confirms, withdraws, selects or completes.
 */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /**
   * What waits for my rating. With the one Dogovor's id (the Dogovori read already gave it) the route opens that
   * rating; with null — several, or none known — it opens Dogovori, where each one waits (critique A1, 2026-09-24).
   */
  onRatings: (agreementId: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
};

/**
 * A start tile: its picture above what it does and one quiet line (critique B3, 2026-09-24). Side by side the picture
 * leads at 28, the title reads 18/22 and the hint 14/18, all from the top, so two tiles that wrap differently still
 * start on one line. Stacked — a narrow phone or large text — the tile becomes a 72 dp row with the picture beside the
 * words, instead of two tall boxes that pushed everything under the tab bar (B4).
 */
function StartTile({ label, title, hint, publish = false, stacked, onPress }: {
  label: string; title: string; hint: string; publish?: boolean; stacked: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    haptic="select" onPress={onPress} style={[s.action, stacked && s.actionStacked, publish && s.publish]}>
    {publish ? <Plus size={28} weight="bold" color={sys.color.onOrange} /> : <FactArt kind="map" size={28} />}
    <View style={[s.actionCopy, stacked && s.actionCopyStacked]}>
      <T variant="heading" style={[s.actionTitle, publish && s.onOrange]}>{title}</T>
      <T variant="note" style={[s.actionHint, publish ? s.onOrange : s.muted]}>{hint}</T>
    </View>
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
      {/* Something here waits for me: an orange dot on the picture, the one mark of attention (B1). */}
      {kind === 'attention' ? <View style={s.attentionDot} /> : null}
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
    onPress={onPress} style={[s.row, last && s.lastRow]}>
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
  const { width } = useWindowDimensions();
  // Rounded, because Android reports its "Large" text as 1.2999999523 and the raw value never reached 1.3.
  const stacked = useTextScale() >= 1.3 || width < 340;
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
      <View style={[s.actions, stacked && s.actionsStacked]}>
        <StartTile label="Objavi zadatak" title="Objavi zadatak" hint="Opiši šta ti treba" publish stacked={stacked} onPress={p.onPublish} />
        {/* A no-break space keeps "i" with "zaradi": the tile wrapped as "Uskoči i / zaradi", a lone "i" (B3). */}
        <StartTile label="Uskoči i zaradi" title={'Uskoči i zaradi'} hint="Nađi posao blizu" stacked={stacked} onPress={p.onEarn} />
      </View>

      {p.loading && !home ? <Skeleton /> : null}
      {p.error && !home ? <View style={s.section}><Unavailable what="Tvoji zadaci, prijave i Dogovori" onRefresh={p.onRefresh} /></View> : null}
      {/* The greeting belongs to a first visit, and a first visit is known only once every read has answered. Above
          the tiles it pushed them down under the finger at the first impression; here it takes the loading's place. */}
      {home?.firstRun ? <View style={s.hero}>
        <T accessibilityRole="header" variant="display" style={s.heroCopy}>{'Šta rešavamo\ndanas?'}</T>
        {!stacked ? <HomeIllustration size={width < 375 ? 88 : 109} /> : null}
      </View> : null}

      {home && waitingShown ? <Section title="Čeka te"
        count={home.attention.length > 0 && (home.attentionState === 'known' || !home.partial) ? home.attention.length + home.attentionMore : undefined}>
        {attentionUnavailable ? <Unavailable what="Podaci o obavezama" onRefresh={p.onRefresh} /> : null}
        {home.attention.length > 0 ? <View style={s.attention}>
          {home.attention.map((item, index) => <Appear key={item.id} index={index} animate={waiting.isNew(item.id)}>
            <Row row={item} onOpen={p.onOpen} kind="attention" last={index === home.attention.length - 1} /></Appear>)}
        </View> : null}
        {home.attentionMore > 0 ? <T variant="note" tone="muted" style={s.more}>I još {home.attentionMore} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
        {/* Dogovori/Aktivni lists a completed Dogovor until it is rated; Home names the same thing, verb first, and
            with exactly one it opens that rating in one tap instead of four (critique A1, 2026-09-24). */}
        {home.ratingsDue > 0 ? <Press accessibilityRole="button" haptic="select" style={s.ratingsDue}
          onPress={() => p.onRatings(home.ratingDueAgreementId)}
          accessibilityLabel={oceniDogovore(home.ratingsDue)}
          accessibilityHint={home.ratingDueAgreementId ? 'Otvara ocenu saradnje.' : 'Otvara Dogovore.'}>
          <View style={s.ratingsDot} />
          <T variant="note" style={s.ratingsDueText}>{oceniDogovore(home.ratingsDue)}</T>
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


/** "Oceni završen Dogovor" / "Oceni 2 završena Dogovora" / "Oceni 5 završenih Dogovora": the verb leads (A1). */
function oceniDogovore(count: number): string {
  return count === 1 ? 'Oceni završen Dogovor'
    // plural() already carries the count; the emulator showed "2 2 završena Dogovora" when it was added twice.
    : `Oceni ${plural(count, 'završen Dogovor', 'završena Dogovora', 'završenih Dogovora')}`;
}

const s = StyleSheet.create({
  // What waits for my rating: a pale warm band with an orange dot and dark-orange words, no outline (B1: the orange
  // halo border was one more orange line on a screen whose one orange fill is the publish tile).
  ratingsDue: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 52, marginTop: sys.space.sm,
    paddingHorizontal: sys.space.base, borderRadius: sys.radius.control, backgroundColor: sys.color.orangeSoft },
  ratingsDot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  ratingsDueText: { flex: 1, color: sys.color.warn, fontWeight: '600' },
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  // The bottom padding keeps the last row clear of the floating tab bar when the list is scrolled to its end.
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.huge, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flexible: { flexShrink: 1 }, muted: { color: sys.color.muted }, onOrange: { color: sys.color.onOrange },
  hero: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 108, marginTop: sys.space.xxl },
  heroCopy: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: sys.space.md },
  actionsStacked: { flexDirection: 'column' },
  // Picture, title and hint from the top; no arrow: the tile is the button, its picture says where it goes.
  action: { ...card, flex: 1, minWidth: 0, minHeight: 96, padding: sys.space.base, gap: sys.space.md, justifyContent: 'flex-start' },
  // Stacked: one 72 dp row, the picture beside the words.
  actionStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', flexDirection: 'row', alignItems: 'center', minHeight: 72,
    paddingVertical: sys.space.md },
  publish: { backgroundColor: sys.color.orange, borderColor: sys.color.orange },
  actionCopy: { gap: sys.space.xs },
  actionCopyStacked: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 18, lineHeight: 22 },
  actionHint: { fontSize: 14, lineHeight: 18 },
  // What needs my answer: a hairline card like every other list, each row marked by its orange dot.
  attention: { ...cardCompact, paddingVertical: 0 },
  // Sections sit 32 apart, and a title stands 8 above what it names (critique B20).
  section: { marginTop: sys.space.xxl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 26, marginBottom: sys.space.sm },
  counter: { minWidth: 26, minHeight: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  link: { color: sys.color.green, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingVertical: sys.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  attentionIcon: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell },
  attentionDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 1, borderColor: sys.color.surface },
  calendarIcon: { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.wash },
  // A card on its own: its bottom edge is the card's hairline, not the thinner row divider.
  agreement: { ...cardCompact, paddingVertical: sys.space.md, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  rowCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The two front doors close the screen as plain rows under a hairline, not as two more cards.
  mine: { marginTop: sys.space.xxl },
  more: { paddingVertical: sys.space.sm },
  unavailable: { gap: sys.space.xs, paddingVertical: sys.space.md, alignItems: 'flex-start' },
  skeletonBlock: { marginTop: sys.space.xxl, gap: sys.space.base },
  skeletonRow: { height: 64, borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.skeleton },
});
