import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, MapPin, Users } from 'phosphor-react-native';
import type { PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import { needGeographyRows, needPeopleText, needRequirementRows } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljena', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena', POPUNJENA: 'Popunjena', ZATVORENA: 'Zatvorena' };
const statusTone = (state: StanjePotrebe) => state === 'NACRT' ? sys.color.muted : state === 'ZATVORENA' ? sys.color.muted : sys.color.green;
export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  ownerIntent: boolean; remainingClosed: boolean;
  onBack: () => void; onRefresh: () => void; onReview: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
  photos?: ReactNode;
  lifecycleActions?: ReactNode;
  qaAction?: ReactNode;
};
function DetailRows({ rows }: { rows: { label: string; value: string }[] }) {
  return <View style={s.details}>{rows.map((row, index) => <View key={`${index}:${row.label}`} style={s.detailRow}>
    <T variant="meta" tone="muted">{row.label}</T><T variant="body" style={s.ink}>{row.value}</T>
  </View>)}</View>;
}
/**
 * The owner's Task: status → title → where/when → price and people → description,
 * photos, applications row, location and requirements rows, lifecycle. One brand
 * action in the footer: review for a draft, applications for a published Task.
 * Only existing controller callbacks can perform business actions.
 */
export function NeedPresentation(props: NeedPresentationProps) {
  const { need, loading, error, busy, ownerIntent, remainingClosed } = props;
  const [expanded, setExpanded] = useState<'location' | 'requirements' | null>(null);
  const draft = need?.stanje === 'NACRT' && ownerIntent;
  const usable = !!need && !loading && !error;
  const rows = need ? needGeographyRows(need) : [], requirements = need ? needRequirementRows(need) : [];
  const primaryLabel = busy ? 'Radnja je u toku…' : draft ? 'Pregledaj za objavu' : 'Pogledaj prijave';
  const primaryAction = draft ? props.onReview : props.onCandidates;
  const toggle = (key: 'location' | 'requirements') => setExpanded(current => current === key ? null : key);
  const applications = need ? need.brojPrijava === 0 ? 'Još nema pristiglih ponuda.' : `${need.brojPrijava} ${need.brojPrijava === 1 ? 'prijava' : 'prijave'} za pregled` : '';
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <View style={s.topBar}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={props.onBack} haptic="select" style={s.back}><V2Icon name="back" /></Press>
      <View style={s.topCopy}>
        <T variant="meta" style={[s.eyebrow, need ? { color: statusTone(need.stanje) } : null]}>{need ? STATUS[need.stanje] : 'Tvoj radni prostor'}</T>
        <T accessibilityRole="header" variant="title" style={s.ink}>Zadatak</T>
      </View>
    </View>
    {loading ? <View style={s.state} accessibilityLiveRegion="polite"><SkeletonCard rows={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Zadatak…</T>
        {props.lifecycleActions}
      </View>
      : error || !need ? <View style={s.state}>
        <View style={s.card}>
          <T variant="title" style={s.ink}>Zadatak nije dostupan</T><T variant="body" tone="muted">{error ?? 'Pokušajte ponovo.'}</T>
          <Press accessibilityRole="button" accessibilityLabel="Pokušaj ponovo" haptic="light" onPress={props.onRefresh} style={s.retry}>
            <T variant="action" style={{ color: sys.color.onOrange }}>Pokušajte ponovo</T>
          </Press>
        </View>
        {props.lifecycleActions}
      </View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} />{need.detalji ? <T variant="meta" tone="muted">{need.detalji.kategorija}</T> : null}</View>
          <T accessibilityRole="header" style={s.heroTitle}>{need.naslov}</T>
          <View style={s.fact}><MapPin size={16} color={sys.color.green} /><T variant="meta" tone="muted" style={s.grow}>{need.detalji?.geografija?.mode === 'REMOTE' ? 'Na daljinu' : need.podrucjeTekst}</T></View>
          <View style={s.fact}><Clock size={16} color={sys.color.green} /><T variant="meta" tone="muted" style={s.grow}>{need.vremeTekst}</T></View>
          <View style={s.moneyRow}>
            <T style={[s.price, s.grow, need.rezimCene === 'OFFERS' && s.offers]}>{need.rezimCene === 'OFFERS' ? 'Tražim ponude' : need.ponudjenaCena ? need.ponudjenaCena.prikaz : 'Cena nije navedena'}</T>
            <View accessible accessibilityLabel={`${need.pokrivenost.popunjeno} od ${needPeopleText(need.pokrivenost.ukupno)} dogovoreno`} style={s.pill}>
              <Users size={16} color={sys.color.ink} /><T variant="meta" style={s.pillText}>{need.pokrivenost.popunjeno} / {need.pokrivenost.ukupno}</T>
            </View>
          </View>
          <T variant="meta" tone="muted">{`${needPeopleText(need.pokrivenost.ukupno)} potrebno`}</T>
        </View>
        {need.opis ? <View style={s.card}><T variant="heading" style={s.ink}>Šta treba uraditi</T><T variant="body" style={s.ink}>{need.opis}</T></View> : null}
        {props.photos}
        {draft ? <View style={[s.card, s.draftCard]}>
          <T variant="heading" style={s.ink}>Spremi zadatak za objavu</T>
          <T variant="body" tone="muted">Pregledaj sve podatke, fotografije i rok za prijave. Zadatak objavljuješ jednom akcijom na detaljnom pregledu.</T>
          <V2Action label="Izmeni nacrt" kind="quiet" disabled={busy} onPress={props.onEdit} style={s.quietLeft} />
        </View> : null}
        {!draft && ownerIntent ? <View style={s.rows}>
          <Press accessibilityRole="button" accessibilityLabel={`Otvori prijave, ukupno ${need.brojPrijava}`} onPress={props.onCandidates} haptic="select" scaleTo={0.99} style={s.row}>
            <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>Prijave za ovaj zadatak</T><T variant="meta" tone={need.brojPrijava ? 'ink' : 'muted'} style={need.brojPrijava ? s.attention : null}>{applications}</T></View>
            {need.brojPrijava ? <View style={s.countPill}><T variant="label" style={s.countText}>{String(need.brojPrijava)}</T></View> : null}<V2Icon name="chevron" size={18} color={sys.color.muted} />
          </Press>
          {need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA' ? <View style={s.rowDivider}><V2Action label="Izmeni Zadatak" kind="quiet" disabled={busy} onPress={props.onEdit} style={s.rowAction} /></View> : null}
        </View> : null}
        <View style={s.rows}>
          <Press accessibilityRole="button" accessibilityLabel="Mesto izvršenja" accessibilityState={{ expanded: expanded === 'location' }} onPress={() => toggle('location')} haptic="select" scaleTo={0.99} style={s.row}>
            <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>Mesto izvršenja</T><T variant="meta" tone="muted">{need.detalji?.geografija ? rows[0].value : 'Približno područje'}</T></View>
            <View style={{ transform: [{ rotate: expanded === 'location' ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} color={sys.color.muted} /></View>
          </Press>
          {expanded === 'location' ? <View style={s.rowBody}>
            {!need.detalji?.geografija ? <T variant="meta" tone="muted">Javna struktura lokacije nije dostupna. Prikazano je približno područje.</T> : null}
            <DetailRows rows={[...rows, ...(need.taskCountryCode ? [{ label: 'Država zadatka', value: need.taskCountryCode }] : [])]} />
          </View> : null}
          <View style={s.rowDivider}>
            <Press accessibilityRole="button" accessibilityLabel="Svi uslovi" accessibilityState={{ expanded: expanded === 'requirements' }} onPress={() => toggle('requirements')} haptic="select" scaleTo={0.99} style={s.row}>
              <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>Svi uslovi</T><T variant="meta" tone="muted">{requirements.length ? 'Veštine, oprema i uslovi rada' : 'Nema dodatih uslova'}</T></View>
              <View style={{ transform: [{ rotate: expanded === 'requirements' ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} color={sys.color.muted} /></View>
            </Press>
            {expanded === 'requirements' ? <View style={s.rowBody}>{requirements.length ? <DetailRows rows={requirements} /> : <T variant="meta" tone="muted">Nema dodatih uslova.</T>}</View> : null}
          </View>
        </View>
        {remainingClosed ? <View style={[s.card, s.mutedCard]}><T variant="heading" style={s.ink}>Preostala potraga je zatvorena</T><T variant="meta" tone="muted">Originalni Zadatak i postojeći Dogovori ostaju nepromenjeni.</T></View>
          : ownerIntent && need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0
            ? <View style={s.card}><T variant="body" tone="muted">Već ste dogovorili {need.pokrivenost.popunjeno} od {need.pokrivenost.ukupno}. Ako vam više niko ne treba, zatvorite potragu za preostala mesta.</T>
              <V2Action label="Ne traži više nikoga" kind="quiet" disabled={busy} onPress={props.onCloseRemaining} style={s.quietLeft} /></View> : null}
        <T variant="meta" tone="muted" style={s.center}>Tačna lokacija i privatne napomene ostaju privatni.</T>
        {props.lifecycleActions}
        {props.qaAction}
      </ScrollView>}
    {usable && ownerIntent ? <View style={s.footer}>
      <V2Action label={primaryLabel} disabled={busy} onPress={primaryAction} style={brandAction} />
    </View> : null}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topCopy: { flex: 1, minWidth: 0, gap: 1 }, eyebrow: { color: sys.color.green, fontWeight: '600' },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, grow: { flex: 1, minWidth: 0 },
  state: { padding: 20, gap: 16 },
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18, gap: 10 },
  draftCard: { borderColor: sys.color.lineStrong, backgroundColor: sys.color.orangeSoft }, mutedCard: { backgroundColor: sys.color.wash },
  retry: { minHeight: 50, borderRadius: sys.radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.orange, paddingHorizontal: 16 },
  content: { padding: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroTitle: { ...sys.type.display, fontSize: 27, lineHeight: 32, color: sys.color.ink },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  moneyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 },
  price: { ...sys.type.price, fontSize: 26, lineHeight: 32, color: sys.color.money, minWidth: 150 }, offers: { color: sys.color.ink, fontSize: 20, lineHeight: 26 },
  pill: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: sys.color.greenSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  pillText: { color: sys.color.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rows: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, overflow: 'hidden' },
  row: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 }, rowDivider: { borderTopWidth: 1, borderColor: sys.color.line }, rowBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
  rowAction: { alignSelf: 'flex-start', marginHorizontal: 12 },
  attention: { color: sys.color.warn, fontWeight: '600' },
  countPill: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  countText: { color: sys.color.onOrange, letterSpacing: 0, lineHeight: 16 },
  details: { gap: 12 }, detailRow: { gap: 2 },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
});
