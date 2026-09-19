import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, User } from 'phosphor-react-native';
import type { HomeRow, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { CanonicalMark } from '../referenceEntry/ReferenceEntryHero';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { brandAction, iconButton, sys } from '../system/tokens';

/**
 * Početna v1. The two things a person can start sit above everything that waits for them, and they
 * never wait for a read: opening the app with no network still offers both. What follows is what
 * the account is already part of — what needs it first, its Dogovori, its tasks and applications —
 * each row saying what the person is to that thing. Rows are lines on the ground, not cards: the
 * only filled surfaces are the brand action and the block of things that are waiting.
 *
 * A row only ever navigates. Nothing here confirms, withdraws, selects or completes.
 */
export type HomePresentationProps = {
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  onAllAgreements: () => void; onAllActivities: () => void; onRefresh: () => void;
};

function Row({ row, onOpen }: { row: HomeRow; onOpen: (target: HomeTarget) => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={`${row.title}. ${row.detail}`} haptic="select" scaleTo={0.99}
    onPress={() => onOpen(row.target)} style={s.row}>
    <View style={s.rowCopy}>
      <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{row.title}</T>
      <T variant="note" tone="muted" numberOfLines={2}>{row.detail}</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead}>
      <T accessibilityRole="header" variant="heading" style={[s.ink, s.grow]}>{title}</T>
      {action && onAction ? <Press accessibilityRole="button" accessibilityLabel={action} haptic="select" onPress={onAction} style={s.sectionAction}>
        <T variant="meta" style={s.link}>{action}</T>
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
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a
  // genuinely new one moves, and each list remembers what it has already shown.
  const waiting = useAppear(), agreements = useAppear(), activities = useAppear();
  waiting.settle((home?.attention ?? []).map(item => item.id));
  if (home?.agreements.kind === 'known') agreements.settle(home.agreements.value.rows.map(row => row.id));
  if (home && home.activities.kind !== 'unavailable') activities.settle(home.activities.value.rows.map(row => row.id));
  const nothingYet = !!home && !home.partial && !home.attention.length
    && home.agreements.kind === 'known' && !home.agreements.value.rows.length
    && home.activities.kind === 'known' && !home.activities.value.rows.length;
  return <SafeAreaView edges={['top']} style={s.canvas}>
    <View style={s.header}>
      <View style={s.mark}><CanonicalMark size={26} /></View>
      <T accessibilityRole="header" variant="title" style={[s.ink, s.grow]}>Početna</T>
      <InboxBell />
      <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={p.onProfile} haptic="select" style={iconButton}>
        <User size={22} color={sys.color.ink} />
      </Press>
    </View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      <View style={s.actions}>
        <V2Action label="Objavi zadatak" onPress={p.onPublish} style={[brandAction, s.action]} />
        <V2Action label="Uskoči i zaradi" onPress={p.onEarn} style={[s.action, s.earn]} />
      </View>

      {p.loading && !home ? <Skeleton /> : null}
      {p.error && !home ? <Unavailable what="Tvoji zadaci, prijave i Dogovori" onRefresh={p.onRefresh} /> : null}

      {home?.attention.length ? <View style={s.attention}>
        <T accessibilityRole="header" variant="label" style={s.attentionLabel}>ČEKA TE</T>
        {home.attention.map((item, index) => <Appear key={item.id} index={index} animate={waiting.isNew(item.id)}>
          <Row row={item} onOpen={p.onOpen} /></Appear>)}
        {home.attentionMore > 0 ? <T variant="note" tone="muted" style={s.more}>I još {home.attentionMore} u tvojim aktivnostima i Dogovorima.</T> : null}
      </View> : null}

      {nothingYet ? <T variant="copy" tone="muted" style={s.empty}>Ovde će stajati ono što te čeka: tvoji zadaci, tvoje prijave i tvoji Dogovori.</T> : null}

      {home && !nothingYet ? <Section title="Dogovori" action="Svi Dogovori" onAction={p.onAllAgreements}>
        {home.agreements.kind === 'unavailable' ? <Unavailable what="Dogovori" onRefresh={p.onRefresh} />
          : home.agreements.value.rows.length ? <>
            {home.agreements.value.rows.map((row, index) => <Appear key={row.id} index={index} animate={agreements.isNew(row.id)}>
              <Row row={row} onOpen={p.onOpen} /></Appear>)}
            {home.agreements.value.more > 0 ? <T variant="note" tone="muted" style={s.more}>Još {home.agreements.value.more} aktivnih u listi Dogovora.</T> : null}
          </> : <T variant="note" tone="muted" style={s.more}>Nemaš aktivan Dogovor.</T>}
      </Section> : null}

      {home && !nothingYet ? <Section title="Moje aktivnosti" action="Vidi sve" onAction={p.onAllActivities}>
        {home.activities.kind === 'unavailable' ? <Unavailable what="Tvoji zadaci i prijave" onRefresh={p.onRefresh} /> : <>
          {home.activities.value.rows.map((row, index) => <Appear key={row.id} index={index} animate={activities.isNew(row.id)}>
            <Row row={row} onOpen={p.onOpen} /></Appear>)}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 62, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  mark: { width: 44, height: 36, borderRadius: sys.radius.pill, backgroundColor: sys.color.ink, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 24 },
  ink: { color: sys.color.ink }, grow: { flex: 1, minWidth: 0 },
  actions: { gap: 10 },
  action: { minHeight: 56 },
  earn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  attention: { borderRadius: sys.radius.cardCompact, backgroundColor: sys.color.orangeSoft, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  attentionLabel: { color: sys.color.warn, fontWeight: '700', letterSpacing: 0.6 },
  section: { gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  sectionAction: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  link: { color: sys.color.green, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.lineStrong },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  more: { paddingVertical: 10 },
  empty: { paddingVertical: 4 },
  unavailable: { gap: 2, paddingVertical: 8, alignItems: 'flex-start' },
  skeletonBlock: { gap: 12 },
  skeletonRow: { height: 52, borderRadius: sys.radius.control, backgroundColor: sys.color.skeleton },
});
