import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import type { ActivityFilter, ActivityPage, HomeActivityRow, HomeTarget } from '../../data/homeSnapshot';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { DetailTopBar } from '../system/DetailTopBar';
import { Segmented } from '../system/Segmented';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';

/**
 * Moje aktivnosti v1: one list of the things I am part of. "Objavio sam" and "Prijavio sam se" are
 * filters of that list and change nothing about the app. A row only navigates; managing an
 * application, a task or a Dogovor stays on the screen that already owns it.
 */
const RELATIONS = [{ key: 'ALL', label: 'Sve' }, { key: 'OWNED', label: 'Moji zadaci' }, { key: 'APPLIED', label: 'Moje prijave' }] as const;
const PERIODS = [{ key: 'ACTIVE', label: 'Aktivno' }, { key: 'HISTORY', label: 'Istorija' }] as const;
const MISSING = { needs: 'Tvoji zadaci', applications: 'Tvoje prijave' } as const;

export function ActivitiesPresentation({ page, filter, loading, refreshing, error, onFilter, onOpen, onBack, onRefresh }: {
  page: ActivityPage | null; filter: ActivityFilter; loading: boolean; refreshing: boolean; error: boolean;
  onFilter: (filter: ActivityFilter) => void; onOpen: (target: HomeTarget) => void; onBack: () => void; onRefresh: () => void;
}) {
  const rows: HomeActivityRow[] = page && page.kind !== 'unavailable' ? page.value : [];
  const unread = (what: string) => <View style={s.state}>
    <T accessibilityLiveRegion="polite" variant="note" tone="muted">{`${what} trenutno nisu učitani.`}</T>
    <V2Action label="Pokušaj ponovo" kind="quiet" compact onPress={onRefresh} />
  </View>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <DetailTopBar title="Moje aktivnosti" onBack={onBack} />
    {/* V41: which things (underlined tabs) first, then when (the quiet pill), then the list. */}
    <View style={s.controls}>
      <Segmented options={RELATIONS} value={filter.relation} onChange={relation => onFilter({ ...filter, relation })} appearance="underline" />
      <Segmented options={PERIODS} value={filter.period} onChange={period => onFilter({ ...filter, period })} />
    </View>
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      {loading && !page ? <View accessibilityLabel="Učitavanje" style={s.skeletons}>{[0, 1, 2, 3].map(index => <View key={index} style={s.skeleton} />)}</View> : null}
      {(error && !page) || page?.kind === 'unavailable' ? unread(filter.relation === 'OWNED' ? MISSING.needs
        : filter.relation === 'APPLIED' ? MISSING.applications : 'Tvoji zadaci i prijave') : null}
      {rows.map(row => <Press key={row.id} accessibilityRole="button" accessibilityLabel={`${readableTitle(row.title)}. ${row.detail}`} haptic="select" scaleTo={0.99}
        onPress={() => onOpen(row.target)} style={s.row}>
        {/* The same coloured illustration Početna gives a task of mine and an offer I sent. */}
        <View style={s.rowIcon}><FactArt kind={row.relation === 'APPLIED' ? 'offers' : 'tasks'} size={28} /></View>
        <View style={s.copy}>
          <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{readableTitle(row.title)}</T>
          <T variant="note" tone="muted" numberOfLines={2}>{row.detail}</T>
        </View>
        <CaretRight size={18} color={sys.color.muted} />
      </Press>)}
      {page?.kind === 'known' && !rows.length ? <T variant="copy" tone="muted" style={s.state}>
        {filter.period === 'ACTIVE' ? 'Ovde trenutno nema ničeg aktivnog.' : 'Ovde još nema ničeg završenog.'}</T> : null}
      {page?.kind === 'partial' ? unread(MISSING[page.missing[0]]) : null}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  controls: { paddingHorizontal: 20, paddingBottom: 10, gap: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  ink: { color: sys.color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.lineStrong },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  rowIcon: { width: 44, height: 44, borderRadius: sys.radius.control, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' },
  state: { paddingVertical: 16, gap: 2, alignItems: 'flex-start' },
  skeletons: { gap: 12, paddingTop: 8 },
  skeleton: { height: 52, borderRadius: sys.radius.control, backgroundColor: sys.color.skeleton },
});
