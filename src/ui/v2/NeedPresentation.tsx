import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, Clock, MapPin, PaperPlaneTilt, Users, Wallet } from 'phosphor-react-native';
import type { PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import { needGeographyRows, needPeopleText, needRequirementRows } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { DetailPairs, DetailTopBar, DisclosureGroup, DisclosureRow, Fact, FactGrid, NextStrip, QuietNote, SectionTitle } from '../system/Detail';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljena', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena', POPUNJENA: 'Popunjena', ZATVORENA: 'Zatvorena' };
const prijave = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'prijava' : n % 10 >= 2 && n % 10 <= 4 ? 'prijave' : 'prijava'}`;

export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  ownerIntent: boolean; remainingClosed: boolean;
  onBack: () => void; onRefresh: () => void; onReview: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
  photos?: ReactNode;
  lifecycleActions?: ReactNode;
  qaAction?: ReactNode;
};

/** What the state means and what comes next, in one strip. */
function nextStep(need: PotrebaProjekcija, remainingClosed: boolean): { title: string; detail?: string; tone: 'green' | 'warn' | 'muted' } {
  const { popunjeno, ukupno } = need.pokrivenost;
  switch (need.stanje) {
    case 'NACRT': return { title: STATUS.NACRT, detail: 'Sledeće: pregled i objava jednim korakom.', tone: 'muted' };
    case 'OBJAVLJENA': case 'CEKA_PRIJAVE':
      return { title: STATUS[need.stanje], detail: need.brojPrijava ? 'Sledeće: izbor. Izbor odmah formira potvrđen Dogovor.' : 'Sledeće: prijave stižu ovde, izbor formira Dogovor.', tone: 'green' };
    case 'DELIMICNO_POPUNJENA':
      return { title: STATUS.DELIMICNO_POPUNJENA, detail: remainingClosed ? `${popunjeno} od ${ukupno} dogovoreno · preostala potraga je zatvorena.` : `${popunjeno} od ${ukupno} dogovoreno · potraga za ostalima traje.`, tone: 'green' };
    case 'POPUNJENA': return { title: STATUS.POPUNJENA, detail: 'Sva mesta su dogovorena.', tone: 'green' };
    default: return { title: STATUS.ZATVORENA, tone: 'muted' };
  }
}

/**
 * The owner's Task (V5 "Jedna objava"): what comes next, the title, four facts in a
 * grid, the description, photos, the applications row, place and conditions behind
 * two rows, lifecycle. One brand action in the footer: review for a draft,
 * applications for a published Task. Only existing controller callbacks act.
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
  const remote = need?.detalji?.geografija?.mode === 'REMOTE';
  const price = need ? need.rezimCene === 'OFFERS' ? 'Tražim ponude' : need.ponudjenaCena ? need.ponudjenaCena.prikaz : 'Cena nije navedena' : '';
  const step = need ? nextStep(need, remainingClosed) : null;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Zadatak" onBack={props.onBack} />
    {loading ? <View style={s.state} accessibilityLiveRegion="polite"><SkeletonCard rows={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Zadatak…</T>
        {props.lifecycleActions}
      </View>
      : error || !need ? <View style={s.state}>
        <View style={card}>
          <T variant="title" style={s.ink}>Zadatak nije dostupan</T><T variant="copy" tone="muted" style={s.gapTop}>{error ?? 'Pokušajte ponovo.'}</T>
          <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={[brandAction, s.gapTop]} />
        </View>
        {props.lifecycleActions}
      </View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {step ? <NextStrip icon={PaperPlaneTilt} title={step.title} detail={step.detail} tone={step.tone} /> : null}
        <View style={s.hero}>
          {need.urgency || need.detalji?.kategorija ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} />{need.detalji?.kategorija ? <T variant="meta" tone="muted">{need.detalji.kategorija}</T> : null}</View> : null}
          <T accessibilityRole="header" style={s.heroTitle}>{need.naslov}</T>
        </View>
        <FactGrid>
          <Fact icon={MapPin} label="Mesto" value={remote ? 'Na daljinu' : need.podrucjeTekst} />
          <Fact icon={Clock} label="Termin" value={need.vremeTekst} />
          <Fact icon={Wallet} label="Budžet" value={price} money={need.rezimCene !== 'OFFERS' && !!need.ponudjenaCena} />
          <Fact icon={Users} label="Potrebno" value={needPeopleText(need.pokrivenost.ukupno)} note={`${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} dogovoreno`} />
        </FactGrid>
        {need.opis ? <View style={s.section}><SectionTitle>Šta treba uraditi</SectionTitle><T variant="body" style={s.description}>{need.opis}</T></View> : null}
        {props.photos}
        {draft ? <View style={[card, s.draftCard]}>
          <T variant="heading" style={s.ink}>Spremi zadatak za objavu</T>
          <T variant="copy" tone="muted">Pregledaj podatke, fotografije i rok za prijave. Objavljuješ jednom akcijom na pregledu.</T>
          <V2Action label="Izmeni nacrt" kind="quiet" disabled={busy} onPress={props.onEdit} style={s.quietLeft} />
        </View> : null}
        {!draft && ownerIntent ? <DisclosureGroup>
          <Press accessibilityRole="button" accessibilityLabel={`Otvori prijave, ukupno ${need.brojPrijava}`} onPress={props.onCandidates} haptic="select" scaleTo={0.99} style={s.row}>
            <View style={s.rowIcon}><PaperPlaneTilt size={20} color={sys.color.green} /></View>
            <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>Prijave za ovaj zadatak</T>
              <T variant="note" tone={need.brojPrijava ? 'ink' : 'muted'} style={need.brojPrijava ? s.attention : null}>{need.brojPrijava ? `${prijave(need.brojPrijava)} za pregled` : 'Još nema pristiglih ponuda.'}</T></View>
            {need.brojPrijava ? <View style={s.countPill}><T variant="label" style={s.countText}>{String(need.brojPrijava)}</T></View> : null}
            <CaretRight size={18} color={sys.color.muted} />
          </Press>
          {need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA' ? <View style={s.rowDivider}><V2Action label="Izmeni Zadatak" kind="quiet" disabled={busy} onPress={props.onEdit} style={s.rowAction} /></View> : null}
        </DisclosureGroup> : null}
        <DisclosureGroup>
          <DisclosureRow first label="Mesto izvršenja" detail={need.detalji?.geografija ? rows[0]?.value : 'Približno područje'} expanded={expanded === 'location'} onPress={() => toggle('location')}>
            {!need.detalji?.geografija ? <T variant="note" tone="muted">Javna struktura lokacije nije dostupna. Prikazano je približno područje.</T> : null}
            <DetailPairs rows={[...rows, ...(need.taskCountryCode ? [{ label: 'Država zadatka', value: need.taskCountryCode }] : [])]} />
          </DisclosureRow>
          <DisclosureRow label="Svi uslovi" detail={requirements.length ? 'Veštine, oprema i uslovi rada' : 'Nema dodatih uslova'} expanded={expanded === 'requirements'} onPress={() => toggle('requirements')}>
            {requirements.length ? <DetailPairs rows={requirements} /> : <T variant="note" tone="muted">Nema dodatih uslova.</T>}
          </DisclosureRow>
        </DisclosureGroup>
        {remainingClosed ? <View style={[card, s.mutedCard]}><T variant="heading" style={s.ink}>Preostala potraga je zatvorena</T><T variant="note" tone="muted">Originalni Zadatak i postojeći Dogovori ostaju nepromenjeni.</T></View>
          : ownerIntent && need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0
            ? <View style={card}><T variant="copy" tone="muted">Dogovoreno je {need.pokrivenost.popunjeno} od {need.pokrivenost.ukupno}. Ako više niko ne treba, zatvori potragu za preostala mesta.</T>
              <V2Action label="Ne traži više nikoga" kind="quiet" disabled={busy} onPress={props.onCloseRemaining} style={s.quietLeft} /></View> : null}
        <QuietNote>Tačna lokacija i privatne napomene ostaju privatni.</QuietNote>
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
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 },
  state: { padding: 20, gap: 16 },
  content: { padding: 20, paddingTop: 6, paddingBottom: 28, gap: 16 },
  hero: { gap: 8, marginTop: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroTitle: { ...sys.type.hero, color: sys.color.ink },
  section: { gap: 8 },
  description: { color: sys.color.ink, lineHeight: 26 },
  draftCard: { borderColor: sys.color.lineStrong, backgroundColor: sys.color.orangeSoft, gap: 8 }, mutedCard: { backgroundColor: sys.color.wash, gap: 6 },
  row: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 }, rowDivider: { borderTopWidth: 1, borderColor: sys.color.line },
  rowAction: { alignSelf: 'flex-start', marginHorizontal: 12 },
  attention: { color: sys.color.warn, fontWeight: '600' },
  countPill: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  countText: { color: sys.color.onOrange, letterSpacing: 0, lineHeight: 16 },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
});
