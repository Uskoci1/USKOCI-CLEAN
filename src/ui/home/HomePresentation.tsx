import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, CalendarBlank, CaretRight, ClipboardText, Handshake, MapPin, PaperPlaneTilt, Plus, User, Users } from 'phosphor-react-native';
import type { HomeRow, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { BrandLockup } from '../entry/BrandAssets';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';
import { HomeIllustration } from './HomeIllustration';

/**
 * The owner's white HTML direction, rendered natively over the existing account-owned snapshot.
 * The HTML is visual evidence only: no example people, dates, counts or commands enter the app.
 * Both start actions remain available before any read completes and when a read fails.
 *
 * A row only ever navigates. Nothing here confirms, withdraws, selects or completes.
 */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  onAllAgreements: () => void; onAllActivities: () => void; onRefresh: () => void;
};

function StartTile({ label, hint, publish = false, stacked, onPress }: {
  label: string; hint: string; publish?: boolean; stacked: boolean; onPress: () => void;
}) {
  const Icon = publish ? Plus : MapPin;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    haptic="select" onPress={onPress} style={[s.action, stacked && s.actionStacked, publish && s.publish]}>
    <View style={s.actionTop}>
      <View style={[s.actionGlyph, publish && s.publishGlyph]}><Icon size={22} color={sys.color.ink} /></View>
      <ArrowRight size={18} color={sys.color.ink} />
    </View>
    <View style={s.actionCopy}>
      <T variant="action">{label}</T>
      <T variant="meta" style={publish ? s.publishHint : s.muted}>{hint}</T>
    </View>
  </Press>;
}

function Row({ row, onOpen, kind = 'activity', last = false }: {
  row: HomeRow; onOpen: (target: HomeTarget) => void; kind?: 'attention' | 'agreement' | 'activity'; last?: boolean;
}) {
  const Icon = kind === 'agreement' ? CalendarBlank : row.target.kind === 'CANDIDATES' ? Users
    : row.target.kind === 'APPLICATION' ? PaperPlaneTilt : row.target.kind === 'AGREEMENT' ? Handshake : ClipboardText;
  return <Press accessibilityRole="button" accessibilityLabel={`${row.title}. ${row.detail}`} haptic="select" scaleTo={0.99}
    onPress={() => onOpen(row.target)} style={[s.row, kind === 'agreement' && s.agreement, last && s.lastRow]}>
    <View style={[s.rowIcon, kind === 'attention' && s.attentionIcon, kind === 'agreement' && s.calendarIcon]}>
      <Icon size={kind === 'agreement' ? 25 : 22} color={sys.color.green} />
    </View>
    <View style={s.rowCopy}>
      <T variant="bodyStrong">{row.title}</T>
      <T variant="note" tone="muted">{row.detail}</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

function Section({ title, count, action, onAction, children }: { title: string; count?: number; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead}>
      <View style={s.sectionTitle}>
        <T accessibilityRole="header" variant="heading" style={s.flexible}>{title}</T>
        {count != null && count > 0 ? <View style={s.counter}><T variant="meta" style={s.link}>{count}</T></View> : null}
      </View>
      {action && onAction ? <Press accessibilityRole="button" accessibilityLabel={action} haptic="select" onPress={onAction} style={s.sectionAction}>
        <T variant="meta" style={s.link}>{action}</T><CaretRight size={16} color={sys.color.green} />
      </Press> : null}
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
  {[0, 1, 2].map(index => <View key={index} style={s.skeletonRow} />)}
</View>;

export function HomePresentation(p: HomePresentationProps) {
  const home = p.home;
  const { width, fontScale } = useWindowDimensions();
  const expanded = fontScale >= 1.3 || width < 340;
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a
  // genuinely new one moves, and each list remembers what it has already shown.
  const waiting = useAppear(), agreements = useAppear(), activities = useAppear();
  waiting.settle((home?.attention ?? []).map(item => item.id));
  if (home?.agreements.kind === 'known') agreements.settle(home.agreements.value.rows.map(row => row.id));
  if (home && home.activities.kind !== 'unavailable') activities.settle(home.activities.value.rows.map(row => row.id));
  const nothingYet = !!home && !home.partial && !home.attention.length
    && home.agreements.kind === 'known' && !home.agreements.value.rows.length
    && home.activities.kind === 'known' && !home.activities.value.rows.length;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.canvas}>
    <View style={s.header}>
      <View style={s.grow}><BrandLockup width={123} /></View>
      <InboxBell />
      <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={p.onProfile} haptic="select" style={s.profile}>
        <User size={22} color={sys.color.ink} />
      </Press>
    </View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      <View style={s.hero}>
        <View style={s.heroCopy}>
          <T variant="meta" tone="muted">Manje obaveza. Više vremena.</T>
          <T accessibilityRole="header" variant="display">{'Šta rešavamo\ndanas?'}</T>
        </View>
        {!expanded ? <HomeIllustration size={width < 375 ? 88 : 109} /> : null}
      </View>
      <View style={[s.actions, expanded && s.actionsStacked]}>
        <StartTile label="Objavi zadatak" hint="Opiši šta ti treba" publish stacked={expanded} onPress={p.onPublish} />
        <StartTile label="Uskoči i zaradi" hint="Pronađi posao blizu" stacked={expanded} onPress={p.onEarn} />
      </View>

      {p.loading && !home ? <Skeleton /> : null}
      {p.error && !home ? <Unavailable what="Tvoji zadaci, prijave i Dogovori" onRefresh={p.onRefresh} /> : null}

      {home && home.attention.length > 0 ? <Section title="Čeka te" count={home.partial ? undefined : home.attention.length + home.attentionMore}>
        <View style={s.attention}>
        {home.attention.map((item, index) => <Appear key={item.id} index={index} animate={waiting.isNew(item.id)}>
          <Row row={item} onOpen={p.onOpen} kind="attention" last={index === home.attention.length - 1} /></Appear>)}
        </View>
        {home.attentionMore > 0 ? <T variant="note" tone="muted" style={s.more}>I još {home.attentionMore} u tvojim aktivnostima i Dogovorima.</T> : null}
      </Section> : null}

      {nothingYet ? <View style={s.empty}><T variant="heading">Tvoj prvi korak.</T>
        <T variant="copy" tone="muted">Ovde će stajati ono što te čeka: tvoji zadaci, tvoje prijave i tvoji Dogovori.</T></View> : null}

      {home && !nothingYet ? <Section title={home.agreements.kind === 'known' && home.agreements.value.rows.length === 1 ? 'Sledeći Dogovor' : 'Sledeći Dogovori'} action="Svi Dogovori" onAction={p.onAllAgreements}>
        {home.agreements.kind === 'unavailable' ? <Unavailable what="Dogovori" onRefresh={p.onRefresh} />
          : home.agreements.value.rows.length ? <View style={s.agreementList}>
            {home.agreements.value.rows.map((row, index) => <Appear key={row.id} index={index} animate={agreements.isNew(row.id)}>
              <Row row={row} onOpen={p.onOpen} kind="agreement" /></Appear>)}
            {home.agreements.value.more > 0 ? <T variant="note" tone="muted" style={s.more}>Još {home.agreements.value.more} aktivnih u listi Dogovora.</T> : null}
          </View> : <T variant="note" tone="muted" style={s.more}>Nemaš aktivan Dogovor.</T>}
      </Section> : null}

      {home && !nothingYet ? <Section title="Moje aktivnosti" action="Vidi sve" onAction={p.onAllActivities}>
        {home.activities.kind === 'unavailable' ? <Unavailable what="Tvoji zadaci i prijave" onRefresh={p.onRefresh} /> : <>
          {home.activities.value.rows.map((row, index, rows) => <Appear key={row.id} index={index} animate={activities.isNew(row.id)}>
            <Row row={row} onOpen={p.onOpen} last={index === rows.length - 1} /></Appear>)}
          {!home.activities.value.rows.length && home.activities.kind === 'known' ? <T variant="note" tone="muted" style={s.more}>Nemaš aktivan zadatak ni prijavu.</T> : null}
          {home.activities.value.more > 0 ? <T variant="note" tone="muted" style={s.more}>Još {home.activities.value.more} u svim aktivnostima.</T> : null}
          {home.activities.kind === 'partial' ? <Unavailable onRefresh={p.onRefresh}
            what={home.activities.missing.includes('needs') ? 'Tvoji zadaci' : 'Tvoje prijave'} /> : null}
        </>}
      </Section> : null}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, paddingHorizontal: 20, paddingVertical: 8,
    width: '100%', maxWidth: 640, alignSelf: 'center' },
  profile: { width: 44, height: 44, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line,
    backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grow: { flex: 1, minWidth: 0 }, flexible: { flexShrink: 1 }, muted: { color: sys.color.muted },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 108, marginBottom: 16 },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  actionsStacked: { flexDirection: 'column' },
  action: { flex: 1, minWidth: 0, minHeight: 120, borderRadius: sys.radius.card, backgroundColor: sys.color.iconWell,
    borderWidth: 1, borderColor: sys.color.line, padding: 14, gap: 12 },
  actionStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  publish: { backgroundColor: sys.color.orange, borderColor: sys.color.orange },
  actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionGlyph: { width: 30, height: 30, borderRadius: sys.radius.badge, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  publishGlyph: { backgroundColor: '#FFFFFF38' }, publishHint: { color: '#584022' },
  actionCopy: { gap: 4 },
  attention: { borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.surface, borderWidth: 1,
    borderColor: sys.color.line, paddingHorizontal: 14 },
  section: { marginTop: 16 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, minHeight: 48, marginBottom: 4 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  counter: { minWidth: 26, minHeight: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, paddingLeft: 4 },
  link: { color: sys.color.green, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  attentionIcon: { width: 40, height: 42, borderRadius: sys.radius.chip, backgroundColor: sys.color.greenSoft },
  calendarIcon: { width: 48, height: 58, borderRadius: sys.radius.chip, backgroundColor: sys.color.wash },
  agreement: { padding: 14, borderWidth: 1, borderBottomWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.cardCompact },
  agreementList: { gap: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  more: { paddingVertical: 8 },
  empty: { marginTop: 28, padding: 20, borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.wash, gap: 8 },
  unavailable: { gap: 4, paddingVertical: 12, alignItems: 'flex-start' },
  skeletonBlock: { marginTop: 24, gap: 16 },
  skeletonRow: { height: 76, borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.skeleton },
});
