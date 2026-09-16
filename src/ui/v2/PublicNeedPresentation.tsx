import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needPeopleText, needRequirementRows } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { PublicProfileSheet, type PublicProfileState } from '../system/PublicProfileSheet';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * Public Task detail (the worker's view): editorial hierarchy — status, title,
 * where/when, price and people, description, photos, Q&A, location and
 * requirements behind rows, the requester with their public profile — and one
 * sticky brand action, "Sastavi prijavu", only while the server accepts
 * applications. Presentation only; the route owns reads, deadline and guards.
 */
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, back, retry, apply, photos, qa,
  onRequesterProfile, requesterProfile = null, onCloseRequesterProfile, publicPhoto }: {
  need: PrilikaProjekcija | null; loading: boolean; error: boolean; missing: boolean; stale: boolean; busy: boolean;
  canApply: boolean; canRetry: boolean; back: () => void; retry: () => void; apply: () => void;
  photos?: ReactNode; qa?: ReactNode;
  /** Owner decision 3: the requester's public profile as a sheet over the existing read. */
  onRequesterProfile?: () => void; requesterProfile?: PublicProfileState; onCloseRequesterProfile?: () => void; publicPhoto?: (profileId: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState<'location' | 'requirements' | null>(null);
  const rows = expanded === 'location' && need ? needGeographyRows(need) : expanded === 'requirements' && need ? needRequirementRows(need) : [];
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  const ready = !!need && !loading && !error && !missing;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.topBar}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad na Zadatke" accessibilityState={{ disabled: busy }} disabled={busy}
        onPress={back} haptic="select" style={s.back}><V2Icon name="back" /></Press>
      <View style={s.topCopy}>
        {need ? <T variant="meta" style={s.eyebrow}>{need.statusTekst}</T> : null}
        <T accessibilityRole="header" variant="title" style={s.ink}>Zadatak</T>
      </View>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      {loading || error || missing ? <View style={s.state} accessibilityLiveRegion="polite">
        {loading ? <><View accessibilityLabel="Učitavamo zadatak"><SkeletonCard rows={3} /></View><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T></>
          : <View style={s.card}><T variant="title" style={s.ink}>{error ? 'Zadatak trenutno nije moguće učitati.' : 'Zadatak nije dostupan.'}</T>
            <T variant="body" tone="muted">{error ? 'Proverite internet vezu i pokušajte ponovo.' : 'Možda je zatvoren ili više nije dostupan vašem nalogu. Vratite se na Zadatke.'}</T>
            {canRetry ? <V2Action label="Pokušajte ponovo" onPress={retry} disabled={busy} style={brandAction} /> : null}</View>}
        {stale ? <T variant="meta" tone="muted">Poslednji učitani podaci. Osvežite zadatak pre nastavka.</T> : null}
      </View> : null}
      {need ? <>
        <View style={s.card}>
          <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View>
          <T accessibilityRole="header" style={s.heroTitle}>{need.naslov}</T>
          <View style={s.facts}>
            <T variant="meta" tone="muted">{remote ? 'Na daljinu' : need.podrucjeTekst}</T>
            <T variant="meta" tone="muted">{need.vremeTekst}</T>
          </View>
          <View style={s.priceRow}>
            <T style={[s.price, need.rezimCene === 'OFFERS' && s.offers]}>{need.rezimCene === 'OFFERS' ? 'Tražim ponude' : need.ponudjenaCena?.prikaz ?? 'Cena nije navedena'}</T>
            <View style={s.pill}><T variant="meta" style={s.pillText}>{needPeopleText(need.pokrivenost.ukupno)}</T></View>
          </View>
          <T variant="meta" tone="muted">{`Popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`}</T>
        </View>
        {need.opis ? <View style={s.card}><T variant="heading" style={s.ink}>Šta treba uraditi</T><T variant="body" style={s.ink}>{need.opis}</T></View> : null}
        {ready && !stale ? photos : null}
        {ready && !stale ? qa : null}
        <View style={s.rows}>
          {(['location', 'requirements'] as const).map((section, index) => <View key={section} style={index ? s.rowDivider : null}>
            <Press accessibilityRole="button" accessibilityLabel={section === 'location' ? 'Mesto izvršenja' : 'Uslovi Zadatka'} accessibilityState={{ expanded: expanded === section }}
              onPress={() => setExpanded(value => value === section ? null : section)} haptic="select" scaleTo={0.99} style={s.row}>
              <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>{section === 'location' ? remote ? 'Na daljinu' : 'Mesto izvršenja' : 'Uslovi'}</T>
                <T variant="meta" tone="muted">{section === 'location' ? remote ? 'Bez fizičke lokacije' : 'Približno područje' : needRequirementRows(need).length ? 'Pogledaj navedene uslove' : 'Bez dodatnih navedenih uslova'}</T></View>
              <View style={{ transform: [{ rotate: expanded === section ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} color={sys.color.muted} /></View>
            </Press>
            {expanded === section ? <View style={s.rowBody}>
              {rows.length ? rows.map((row, i) => <View key={i} style={s.fact}><T variant="meta" tone="muted">{row.label}</T><T variant="body" style={s.ink}>{row.value}</T></View>)
                : <T variant="meta" tone="muted">Nema dodatnih navedenih uslova.</T>}
              {section === 'location' && !remote ? <T variant="meta" tone="muted">Precizni podaci o pristupu dele se u Dogovoru uz dozvolu.</T> : null}
            </View> : null}
          </View>)}
        </View>
        <View style={s.card}>
          <T variant="meta" tone="muted">Naručilac</T>
          <View style={s.requester}>
            <View style={s.avatar}><T variant="label" style={s.initial}>{(need.narucilacIme || 'N').slice(0, 1).toLocaleUpperCase('sr-Latn-RS')}</T></View>
            <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>{need.narucilacIme || 'Ime trenutno nije dostupno'}</T>
              {need.narucilacOcena !== null ? <T variant="meta" tone="muted">{`Ocena ${need.narucilacOcena}`}</T> : null}</View>
          </View>
          {onRequesterProfile ? <V2Action label="Javni profil naručioca" kind="quiet" disabled={busy} onPress={onRequesterProfile} style={s.quietLeft} /> : null}
        </View>
      </> : null}
    </ScrollView>
    {ready ? <View style={s.footer}>
      {canApply ? <V2Action label="Sastavi prijavu" onPress={apply} disabled={busy} style={brandAction} />
        : <T variant="meta" tone="muted" style={s.center}>Nove prijave trenutno nisu dostupne za ovaj zadatak.</T>}
    </View> : null}
    {onCloseRequesterProfile ? <PublicProfileSheet state={requesterProfile} onClose={onCloseRequesterProfile} onRetry={onRequesterProfile ?? onCloseRequesterProfile}
      photo={publicPhoto} roleLabel="Naručilac" /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topCopy: { flex: 1, minWidth: 0, gap: 1 }, eyebrow: { color: sys.color.green, fontWeight: '600' },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' },
  content: { padding: 20, paddingTop: 4, gap: 14, paddingBottom: 32 },
  state: { gap: 12 },
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18, gap: 10 },
  badgeRow: { flexDirection: 'row' },
  heroTitle: { ...sys.type.display, fontSize: 27, lineHeight: 32, color: sys.color.ink },
  facts: { gap: 4 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 },
  price: { ...sys.type.price, fontSize: 26, lineHeight: 32, color: sys.color.money, flex: 1, minWidth: 150 },
  offers: { color: sys.color.ink, fontSize: 20, lineHeight: 26 },
  pill: { backgroundColor: sys.color.greenSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, pillText: { color: sys.color.ink, fontWeight: '700' },
  rows: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, overflow: 'hidden' },
  rowDivider: { borderTopWidth: 1, borderColor: sys.color.line },
  row: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
  fact: { gap: 2 },
  requester: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initial: { color: sys.color.green },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  footer: { padding: 18, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
