import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import type { HomeRow, HomeSection, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import type { OwnedTaskCounts } from '../../data/marketplaceView';
import type { ApplicationCounts } from '../../data/myApplicationsView';
import { ScreenHeader } from '../system/ScreenHeader';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys, floating } from '../system/tokens';
import { plural, prijava } from '../system/plural';
import { useTextScale } from '../system/textScale';
import { HomeIllustration } from './HomeIllustration';
import { HomeLaunchArt } from './HomeLaunchArt';

/**
 * Početna, the overview (owner's information architecture, 2026-09-23): the two big start tiles, what waits for me,
 * the next Dogovor when there is one, and two front doors — "Moji zadaci" and "Moje prijave" — each counted by the
 * rule of the list it opens. The display headline greets only a first run. The HTML is visual evidence only: no
 * example people, dates, counts or commands enter the app. Both start actions remain available before any read
 * completes and when a read fails.
 *
 * R13 composition: two illustrated white start doors, an open attention list, one distinct appointment and quiet
 * personal-list navigation. The artwork carries the brand; reading surfaces stay white. No decorative stats,
 * inferred greeting or made-up task state enters this presentation.
 *
 * A row only ever navigates. Nothing here confirms, withdraws, selects or completes.
 */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  /** Internal galleries supply the same chrome with an inert bell; the live header remains the default. */
  header?: ReactNode;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /**
   * What waits for my rating. With the one Dogovor's id (the Dogovori read already gave it) the route opens that
   * rating; with null — several, or none known — it opens Dogovori, where each one waits (critique A1, 2026-09-24).
   */
  onRatings: (agreementId: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
};

/**
 * Two equally useful front doors share a white launch area. Large purpose-made illustrations sit directly on white,
 * above the action and its short explanation. Narrow/large-text layouts become rows without a fixed height.
 */
function StartTile({ label, title, hint, publish = false, stacked, onPress }: {
  label: string; title: string; hint: string; publish?: boolean; stacked: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    haptic="select" onPress={onPress} style={[s.action, stacked && s.actionStacked]}>
    <HomeLaunchArt kind={publish ? 'publish' : 'discover'} compact={stacked} />
    <View style={[s.actionCopy, stacked && s.actionCopyStacked]}>
      <T variant="heading" style={s.actionTitle}>{title}</T>
      <T variant="note" style={[s.actionHint, s.muted]}>{hint}</T>
    </View>
  </Press>;
}

function AttentionRow({ row, onOpen, last = false }: {
  row: HomeRow; onOpen: (target: HomeTarget) => void; last?: boolean;
}) {
  // The same coloured illustration the cards use for this kind of thing (owner, 2026-09-23: thin grey glyphs sat here while the rest of the app was illustrated).
  const art: FactArtKind = row.target.kind === 'CANDIDATES' ? 'users'
    : row.target.kind === 'APPLICATION' ? 'offers' : row.target.kind === 'AGREEMENT' ? 'agreements' : 'tasks';
  return <Press accessibilityRole="button" accessibilityLabel={`${readableTitle(row.title)}. ${row.detail}`} haptic="select" scaleTo={0.99}
    onPress={() => onOpen(row.target)} style={[s.row, last && s.lastRow]}>
    <View style={[s.rowIcon, s.attentionIcon]}>
      <FactArt kind={art} size={32} />
      {/* Something here waits for me: an orange dot on the picture, the one mark of attention (B1). */}
      <View style={s.attentionDot} />
    </View>
    <View style={s.rowCopy}>
      <T variant="bodyStrong">{readableTitle(row.title)}</T>
      <T variant="note" tone="muted">{row.detail}</T>
    </View>
    <View style={s.rowDirection}><CaretRight size={18} color={sys.color.ink} /></View>
  </Press>;
}

/** The projection's time can be exact, flexible or absent; no date is extracted from a display sentence. */
function AppointmentCard({ row, onOpen, stacked }: {
  row: HomeRow; onOpen: (target: HomeTarget) => void; stacked: boolean;
}) {
  const appointment = row.appointment;
  return <Press accessibilityRole="button" accessibilityLabel={`${readableTitle(row.title)}. ${row.detail}`}
    accessibilityHint="Otvara Dogovor." haptic="select" scaleTo={0.99} onPress={() => onOpen(row.target)} style={s.appointment}>
    <View style={[s.appointmentWhen, stacked && s.appointmentWhenStacked]}>
      <View style={[s.appointmentMarker, stacked && s.appointmentMarkerStacked]}>
        <View style={s.calendarIcon}><FactArt kind="calendar" size={32} /></View>
        {stacked ? <View style={s.appointmentDirection}><CaretRight size={20} color={sys.color.green} /></View> : null}
      </View>
      <View style={[s.rowCopy, stacked && s.appointmentTimeStacked]}>
        {appointment?.timeText ? <T variant="heading" style={s.appointmentTime}>{appointment.timeText}</T> : null}
        {appointment?.roleLabel ? <T variant="note" tone="muted">{appointment.roleLabel}</T> : null}
      </View>
      {!stacked ? <View style={s.appointmentDirection}><CaretRight size={20} color={sys.color.green} /></View> : null}
    </View>
    <View style={s.appointmentBody}>
      <T variant="cardTitle" style={s.appointmentTitle}>{readableTitle(row.title)}</T>
      {appointment ? appointment.counterpartName ? <View style={s.appointmentPerson}>
        <FactArt kind="person" size={28} />
        <T variant="bodyStrong" style={s.rowCopy}>{appointment.counterpartName}</T>
      </View> : null : <T variant="note" tone="muted">{row.detail}</T>}
    </View>
  </Press>;
}

/** A front door to one of my lists: its name and, once read, what is in it. It opens the list even when unread. */
function MineRow({ art, title, detail, onPress, last = false }: {
  art: FactArtKind; title: string; detail: string | null; onPress: () => void; last?: boolean;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={detail ? `${title}. ${detail}` : title} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, last && s.lastRow]}>
    <View style={s.mineIcon}><FactArt kind={art} size={32} /></View>
    <View style={s.rowCopy}>
      <T variant="bodyStrong">{title}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead} accessible accessibilityRole="header"
      accessibilityLabel={count != null && count > 0 ? `${title}: ${plural(count, 'stavka', 'stavke', 'stavki')}` : title}>
      <T variant="heading" style={[s.flexible, s.sectionTitle]}>{title}</T>
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
    {p.header ?? <ScreenHeader title="Početna" onProfile={p.onProfile} />}
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      {/* The tiles are the first thing on screen and never move: nothing above them waits for a read. */}
      <View style={[s.actions, stacked && s.actionsStacked]}>
        <StartTile label="Objavi zadatak" title="Objavi zadatak" hint="Opiši šta ti treba" publish stacked={stacked} onPress={p.onPublish} />
        <View style={stacked ? s.actionDividerStacked : s.actionDivider} />
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
            <AttentionRow row={item} onOpen={p.onOpen} last={index === home.attention.length - 1} /></Appear>)}
        </View> : null}
        {home.attentionMore > 0 ? <T variant="note" tone="muted" style={s.more}>I još {home.attentionMore} u tvojim zadacima, prijavama i Dogovorima.</T> : null}
        {/* Dogovori/Aktivni lists a completed Dogovor until it is rated; Home names the same thing, verb first, and
            with exactly one it opens that rating in one tap instead of four (critique A1, 2026-09-24). */}
        {home.ratingsDue > 0 ? <Press accessibilityRole="button" haptic="select" style={s.ratingsDue}
          onPress={() => p.onRatings(home.ratingDueAgreementId)}
          accessibilityLabel={oceniDogovore(home.ratingsDue)}
          accessibilityHint={home.ratingDueAgreementId ? 'Otvara ocenu saradnje.' : 'Otvara Dogovore.'}>
          <FactArt kind="star" size={24} />
          <T variant="note" style={s.ratingsDueText}>{oceniDogovore(home.ratingsDue)}</T>
          <CaretRight size={18} color={sys.color.warn} />
        </Press> : null}
      </Section> : null}

      {/* One next Dogovor, and only when there is one; the rest are in the Dogovori tab. A failed read says so. */}
      {home?.agreements.kind === 'unavailable' ? <Section title="Sledeći Dogovor"><Unavailable what="Dogovori" onRefresh={p.onRefresh} /></Section>
        : next ? <Section title="Sledeći Dogovor">
          <Appear index={0} animate={agreements.isNew(next.id)}><AppointmentCard row={next} onOpen={p.onOpen} stacked={stacked} /></Appear>
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
  // A rating is still a real pending action, but its illustration and words carry the accent, not a tinted band.
  ratingsDue: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 52, marginTop: sys.space.sm,
    paddingVertical: sys.space.md, backgroundColor: sys.color.surface },
  ratingsDueText: { flex: 1, color: sys.color.warn, fontWeight: '600' },
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  // The bottom padding leaves air between the last row and the inset tab bar below the list when it is scrolled to its end.
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.huge, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flexible: { flexShrink: 1 }, muted: { color: sys.color.muted },
  hero: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 108, marginTop: sys.space.xxl },
  heroCopy: { flex: 1, minWidth: 0 },
  // One open launch area, not another pair of boxed content cards. The large illustrations are the primary targets.
  actions: { flexDirection: 'row', alignItems: 'stretch', paddingTop: sys.space.sm, paddingBottom: sys.space.base,
    borderBottomWidth: 1, borderBottomColor: sys.color.line },
  actionsStacked: { flexDirection: 'column', paddingTop: 0, paddingBottom: sys.space.sm },
  action: { flex: 1, minWidth: 0, minHeight: 152, paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm,
    gap: sys.space.sm, borderRadius: sys.radius.control, backgroundColor: sys.color.surface, justifyContent: 'flex-start' },
  actionStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', flexDirection: 'row', alignItems: 'center', minHeight: 84,
    paddingHorizontal: sys.space.xs, paddingVertical: sys.space.md, gap: sys.space.base },
  actionDivider: { width: 1, alignSelf: 'stretch', marginVertical: sys.space.base, marginHorizontal: sys.space.xs,
    backgroundColor: sys.color.line },
  actionDividerStacked: { height: StyleSheet.hairlineWidth, marginLeft: 72, backgroundColor: sys.color.line },
  actionCopy: { gap: sys.space.xs },
  actionCopyStacked: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 20, lineHeight: 25, letterSpacing: -0.6, color: sys.color.ink },
  actionHint: { fontSize: 14, lineHeight: 20 },
  // Attention is an open inbox: the action comes first, the exact subject/reason is never truncated.
  attention: { backgroundColor: sys.color.surface },
  section: { marginTop: sys.space.xxl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 28, marginBottom: sys.space.md },
  sectionTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.6 },
  counter: { minWidth: 28, minHeight: 28, paddingHorizontal: sys.space.xs,
    backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  link: { color: sys.color.attentionInk, fontSize: 18, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingVertical: sys.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  attentionIcon: { width: 40, height: 40, backgroundColor: sys.color.surface },
  rowDirection: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  attentionDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 1, borderColor: sys.color.surface },
  calendarIcon: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center' },
  // Home's one elevated object is the appointment; a green leading rule groups the work and the person below its time.
  appointment: { ...floating, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine,
    backgroundColor: sys.color.surface, padding: sys.space.base },
  appointmentWhen: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingBottom: sys.space.base,
    backgroundColor: sys.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  appointmentWhenStacked: { flexDirection: 'column', alignItems: 'stretch', gap: sys.space.sm },
  appointmentMarker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  appointmentMarkerStacked: { alignSelf: 'stretch' },
  appointmentTime: { color: sys.color.green, fontSize: 20, lineHeight: 27, letterSpacing: -0.4 },
  appointmentDirection: { width: 32, height: 32, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash,
    alignItems: 'center', justifyContent: 'center' },
  appointmentTimeStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  appointmentBody: { gap: sys.space.md, borderLeftWidth: 3, borderLeftColor: sys.color.green,
    paddingLeft: sys.space.md, marginTop: sys.space.base, paddingBottom: sys.space.xs },
  appointmentTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.6 },
  appointmentPerson: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  rowCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // Open navigation rows: the illustrated icons supply color, without a tinted group behind them.
  mine: { marginTop: sys.space.xxl, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line,
    paddingTop: sys.space.xs },
  mineIcon: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center' },
  more: { paddingVertical: sys.space.sm },
  unavailable: { gap: sys.space.xs, paddingVertical: sys.space.md, alignItems: 'flex-start' },
  skeletonBlock: { marginTop: sys.space.xxl, gap: sys.space.base },
  skeletonRow: { height: 64, borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.skeleton },
});
