import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { PrilikaProjekcija } from '../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../data/marketplaceView';
import { taskRelationIndex } from '../data/taskRelation';
import { needScheduleText } from '../data/needDetailPresentation';
import { novac } from '../lib/novac';
import { DiscoveryPresentation } from '../ui/v2/DiscoveryPresentation';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';

/**
 * Inert native rendering fixture, never a server dataset or a concurrent-user load test.
 * Exact internal package only: uskociapp://dizajn-mapa?count=1 or count=1000.
 * The real Discovery component keeps its filters, map, sheet and virtualization. Its map tiles/attribution and
 * explicit local Nearby control are unchanged; fixtures have no media and no profile/contact/action reads.
 * Opening a row pushes this route's inert detail, so Back exercises native screen detachment and retained list state.
 */
type Count = 1 | 1000;
const noop = () => {};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TITLES = ['Prenos ormana do kombija', 'Montaža dve police', 'Pomoć pri selidbi stana sa trećeg sprata bez lifta i rasklapanje velikog ormara',
  'Košenje trave', 'Priprema sale i prenošenje stolova pre događaja', 'Šetnja psa u kraju'];
const CENTERS = [{ city: 'Novi Sad', lat: 45.25, lng: 19.84 }, { city: 'Novi Sad', lat: 45.25, lng: 19.84 },
  { city: 'Beograd', lat: 44.81, lng: 20.46 }, { city: 'Niš', lat: 43.32, lng: 21.90 }];

function fixtures(count: Count): PrilikaProjekcija[] {
  return Array.from({ length: count }, (_, index): PrilikaProjekcija => {
    // Per ten: eight public geographic tasks, one remote, one on-site with an unavailable public pin.
    const remote = index % 10 === 8, noPin = index % 10 === 9;
    const center = CENTERS[Math.floor(index / 10) % CENTERS.length];
    const slots = 1 + index % 4, filled = index % 3 === 0 && slots > 1 ? 1 : 0;
    const offers = index % 3 === 0, missingPrice = !offers && index % 7 === 0;
    const amount = 1500 + index % 12 * 500;
    const title = remote ? index % 20 === 8 ? 'Prevod kratkog uputstva na engleski' : 'Sređivanje tabele troškova na daljinu'
      : TITLES[index % TITLES.length];
    return {
      id: uuid(index + 1), naslov: `${title} · ${String(index + 1).padStart(4, '0')}`,
      opis: 'Lokalni probni zadatak za pregled rasporeda, filtera i povratka iz detalja. Nije objavljen i na njega se ne može prijaviti.',
      statusTekst: 'Otvoren', primaNovePrijave: true, rokZaPrijaveIso: null,
      podrucjeTekst: remote ? 'Na daljinu' : center.city, taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
      vremeTekst: remote ? 'Po dogovoru' : '26. sep · 10:00–12:00',
      schedule: remote ? { kind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null }
        : index % 4 === 1 ? { kind: 'FLEXIBLE', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-30T18:00:00Z' }
          : { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:00:00Z' },
      pokrivenost: { ukupno: slots, popunjeno: filled, preostalo: slots - filled, udeo: filled / slots },
      uslovi: index % 5 === 0 && !remote ? ['Ponesi rukavice', 'Zgrada bez lifta'] : [],
      narucilacProfilId: uuid(10001 + index), narucilacAvatarId: null,
      narucilacIme: `Probna osoba ${index % 20 + 1}`, narucilacOcena: null, narucilacBrojOcena: null,
      // Two-decimal public points deliberately repeat, exercising clusters and same-point groups.
      priblizno: remote || noPin ? null : { lat: Number((center.lat + (Math.floor(index / 40) % 9 - 4) * .01).toFixed(2)),
        lng: Number((center.lng + (Math.floor(index / 4) % 9 - 4) * .01).toFixed(2)) },
      rezimCene: offers ? 'OFFERS' : 'MY_PRICE', osnovaCene: index % 4 === 0 ? 'PER_PERSON' : 'TOTAL',
      ...(offers || missingPrice ? {} : { ponudjenaCena: { iznos: amount, valuta: 'RSD', prikaz: novac(amount) } }),
      detalji: { kategorija: remote ? 'Administrativna pomoć' : 'Pomoć u kući',
        geografija: remote ? { mode: 'REMOTE' } : { mode: 'STATIONARY', start: { city: center.city } },
        rezimLokacije: remote ? 'REMOTE' : 'STATIONARY',
        zahtevi: { vestine: [], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false } },
    };
  });
}

const leave = () => router.canGoBack() ? router.back() : router.replace('/dizajn-tabla');

export default function DizajnMapa() {
  const params = useLocalSearchParams<{ count?: string | string[]; detail?: string | string[] }>();
  const internal = Constants.expoConfig?.android?.package === 'rs.uskoci.dev';
  const count = params.count === undefined || params.count === '1' ? 1 : params.count === '1000' ? 1000 : null;
  const detail = params.detail === undefined ? null : typeof params.detail === 'string' && /^(0|[1-9]\d{0,2})$/.test(params.detail)
    ? Number(params.detail) : -1;
  if (!internal || count === null || (detail !== null && (detail < 0 || detail >= count))) {
    return <SafeAreaView style={s.screen}><T style={s.unavailable}>{internal ? 'Nepoznat prikaz galerije.' : 'Nije dostupno.'}</T>
      <GalleryFooter count={null} onBack={leave} /></SafeAreaView>;
  }
  return <LocalGallery key={count} count={count} detail={detail} />;
}

function LocalGallery({ count, detail }: { count: Count; detail: number | null }) {
  const items = useMemo(() => fixtures(count), [count]);
  const relations = useMemo(() => taskRelationIndex([], items.map(item => item.id)), [items]);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }));
  const open = (item: MarketplaceItem) => {
    const index = items.findIndex(row => row.id === item.id);
    if (index >= 0) router.push({ pathname: '/dizajn-mapa', params: { count: String(count), detail: String(index) } });
  };
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: '/dizajn-mapa', params: { count: String(count) } });
  const item = detail === null ? null : items[detail];
  return <View style={s.screen}>
    {item ? <SafeAreaView edges={['top']} style={s.grow}><ScrollView contentContainerStyle={s.detail}>
      <T variant="meta">LOKALNI PROBNI DETALJ · {detail! + 1}/{count}</T>
      <T variant="heading">{item.naslov}</T>
      <T>{item.podrucjeTekst}</T><T>{item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst}</T>
      <T>{item.rezimCene === 'OFFERS' ? 'Tražim ponude' : item.ponudjenaCena?.prikaz ?? 'Cena nije navedena'}</T>
      <T>{item.opis}</T>
      <T tone="muted">Nazad vraća isti ekran mape i liste. Ovde nema slanja, prijave ili čuvanja u bazu.</T>
    </ScrollView></SafeAreaView> : <View style={s.grow}>
      <DiscoveryPresentation items={items} loading={false} error={false} scopeKey={`local-map-gallery:${count}`}
        view={view} onView={setView} onOpen={open} onRefresh={noop} onProfile={noop} relations={relations} />
    </View>}
    <GalleryFooter count={count} onBack={item ? back : leave} detail={!!item} />
  </View>;
}

function GalleryFooter({ count, detail = false, onBack }: { count: Count | null; detail?: boolean; onBack: () => void }) {
  return <SafeAreaView edges={['bottom']} style={s.footer}>
    <View style={s.footerRow}>
      <T variant="meta" accessibilityLabel={count ? `DEV galerija, ${count} lokalnih probnih zadataka, bez podataka iz baze` : 'DEV galerija'}
        style={s.context}>{count ? `DEV · ${count === 1000 ? '1.000 zadataka' : '1 zadatak'} · bez baze` : 'DEV galerija'}</T>
      <Press accessibilityRole="button" accessibilityLabel={detail ? 'Nazad na probnu mapu' : 'Izađi iz galerije'}
        onPress={onBack} style={s.exit}><T variant="action">{detail ? 'Nazad' : 'Izađi'}</T></Press>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface }, grow: { flex: 1 },
  detail: { padding: sys.space.lg, gap: sys.space.base }, unavailable: { flex: 1, padding: sys.space.lg },
  footer: { borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base },
  context: { flex: 1 }, exit: { minHeight: 48, paddingHorizontal: sys.space.base, justifyContent: 'center' },
});
