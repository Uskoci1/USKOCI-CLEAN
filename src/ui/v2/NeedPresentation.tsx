import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import type { PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import { readinessCopy, type NeedPublicationReadiness } from '../../data/needPublicationReadiness';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { DetailPairs, DisclosureGroup, DisclosureRow, NextStrip, QuietNote, SectionTitle } from '../system/Detail';
import { ProductDivider, ProductFactPair, ProductFooterAction, ProductHeader, ProductLabeledFact, ProductPeopleFact, ProductPrice,
  ProductRequirements, ProductTitle, ProductWhenFact, productPriceParts } from '../product/ProductDetails';
import { FactArt } from '../system/FactArt';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' };
import { osoba, prijava as prijave } from '../system/plural';
import { countryName } from '../location/CountryField';

export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  remainingClosed: boolean;
  onBack: () => void; onRefresh: () => void; onReview: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
  /** What the publish gate says about a draft, asked of the gate itself. Absent means not asked. */
  readiness?: NeedPublicationReadiness | null;
  photos?: ReactNode;
  /** Where the job is, as an approximate pin. The map owns a focus lifetime, so the route builds it. */
  map?: ReactNode;
  lifecycleActions?: ReactNode;
  qaAction?: ReactNode;
};

/** What the state means and what comes next, in one strip. */
function nextStep(need: PotrebaProjekcija, remainingClosed: boolean, blocked?: { title: string; detail: string } | null): { title: string; detail?: string; tone: 'green' | 'warn' | 'muted' } {
  const { popunjeno, ukupno } = need.pokrivenost;
  switch (need.stanje) {
    case 'NACRT': return blocked
      ? { title: blocked.title, detail: blocked.detail, tone: 'warn' }
      // An unknown answer from the publish gate is not a yes. Until it answers, the draft says what
      // it knows - that it is a draft - rather than promising a step that may be refused.
      : { title: STATUS.NACRT, detail: 'Otvori pregled da vidiš da li može da se objavi.', tone: 'muted' };
    case 'OBJAVLJENA': case 'CEKA_PRIJAVE':
      return { title: STATUS[need.stanje], detail: (need.brojPrijavaZaIzbor ?? 0) > 0 ? 'Sledeće: izbor. Izbor odmah formira potvrđen Dogovor.' : 'Sledeće: prijave stižu ovde, izbor formira Dogovor.', tone: 'green' };
    case 'DELIMICNO_POPUNJENA':
      return { title: STATUS.DELIMICNO_POPUNJENA, detail: remainingClosed ? `${popunjeno} od ${ukupno} dogovoreno · preostala potraga je zatvorena.` : `${popunjeno} od ${ukupno} dogovoreno · potraga za ostalima traje.`, tone: 'green' };
    case 'POPUNJENA': return { title: STATUS.POPUNJENA, detail: 'Sva mesta su dogovorena.', tone: 'green' };
    default: return { title: STATUS.ZATVORENA, tone: 'muted' };
  }
}

/**
 * What the one orange action says about the applications, with the same number the screen already
 * shows (PKG-035): the ones that can be chosen when the server says, the total only when it does not.
 * A known zero is not drawn as "· 0"; the spoken label says which number it is either way.
 */
function applicationsAction(need: PotrebaProjekcija): { count: number | null; spoken: string } {
  const selectable = need.brojPrijavaZaIzbor;
  if (typeof selectable === 'number') return selectable > 0
    ? { count: selectable, spoken: `Pregledaj prijave, ${prijave(selectable)} za izbor` }
    : { count: null, spoken: `Pregledaj prijave, trenutno nema prijava za izbor, ukupno ${prijave(need.brojPrijava)}` };
  return { count: need.brojPrijava > 0 ? need.brojPrijava : null, spoken: `Pregledaj prijave, ukupno ${prijave(need.brojPrijava)}` };
}

/**
 * The owner's Task, as the owner's V41 reference sets it (2026-09-23): the title, its state, the place,
 * Termin beside Potrebno, the price large, then the description, requirements, photos, applications,
 * the approximate map and lifecycle. One footer action: review for a draft, applications for a
 * published Task. Only existing controller callbacks act.
 */
export function NeedPresentation(props: NeedPresentationProps) {
  const { need, loading, error, busy, remainingClosed } = props;
  const [expanded, setExpanded] = useState(false);
  // This is the owner's view of their own Zadatak: the route reads it through the owner-only read,
  // so there is no "other side of the app" from which it could be seen without the right to act.
  const draft = need?.stanje === 'NACRT';
  const usable = !!need && !loading && !error;
  const rows = need ? needGeographyRows(need) : [], requirements = need ? needRequirementRows(need) : [];
  // A draft the gate refuses is not sent to a review that will refuse it again: the action leads
  // to the conversation, which is where the missing thing is asked for.
  const blocked = draft ? readinessCopy(props.readiness ?? { kind: 'UNKNOWN' }) : null;
  // `busy` is true while anything on the screen is loading, including the first read, so the one
  // action announced work in progress before anything had been asked for.
  const working = busy && !loading;
  const applications = need && !working && !blocked && !draft ? applicationsAction(need) : null;
  const primaryLabel = working ? 'Radnja je u toku…'
    : blocked ? 'Otvori razgovor i dopuni' : draft ? 'Pregledaj za objavu' : 'Pregledaj prijave';
  const primaryAction = blocked ? props.onEdit : draft ? props.onReview : props.onCandidates;
  const remote = need?.detalji?.geografija?.mode === 'REMOTE';
  // The owner's own task shows the same price a stranger sees, totals included; only the line under an
  // open price speaks to the owner instead of to the person applying.
  const price = need ? productPriceParts(need, 'Svako u prijavi predlaže ukupan iznos.') : null;
  const step = need ? nextStep(need, remainingClosed, blocked) : null;
  const forSelection = need?.brojPrijavaZaIzbor;
  const hasSelection = (forSelection ?? 0) > 0;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader back={props.onBack} />
    {loading ? <View style={s.state} accessibilityLiveRegion="polite"><SkeletonCard rows={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Zadatak…</T>
        {props.lifecycleActions}
      </View>
      : error || !need ? <View style={s.state}>
        <View style={card}>
          <T accessibilityRole="header" variant="title" style={s.ink}>Zadatak nije dostupan</T><T variant="copy" tone="muted" style={s.gapTop}>{error ?? 'Pokušaj ponovo.'}</T>
          <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={[brandAction, s.gapTop]} />
        </View>
        {props.lifecycleActions}
      </View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          {/* People never see a category (owner decision 2026-09-21); the server reads kinds of work only to match. */}
          {need.urgency ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View> : null}
          <ProductTitle>{readableTitle(need.naslov)}</ProductTitle>
        </View>
        {/* The title leads, as in V41; the state and the next step follow it instead of standing above it. */}
        {step ? <NextStrip art="offers" title={step.title} detail={step.detail} tone={step.tone} /> : null}
        <View style={s.facts}>
          <ProductLabeledFact art={remote ? 'remote' : 'pin'} label={remote ? 'Način rada' : 'Lokacija'} value={remote ? 'Na daljinu' : need.podrucjeTekst} />
          <ProductFactPair>
            <ProductWhenFact text={need.vremeTekst} exactWindow={need.schedule?.kind === 'FIXED_WINDOW'} />
            {/* A draft has no places that could be taken yet, so it says only how many people it needs. */}
            <ProductPeopleFact value={osoba(need.pokrivenost.ukupno)}
              note={draft ? undefined : `${need.pokrivenost.popunjeno} / ${need.pokrivenost.ukupno} popunjeno`}
              spokenNote={draft ? undefined : `popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`} />
          </ProductFactPair>
          {price ? <ProductPrice value={price.value} note={price.note} isAmount={price.isAmount} /> : null}
        </View>
        <ProductDivider />
        {need.opis ? <T variant="body" style={s.description}>{need.opis}</T> : null}
        <ProductRequirements rows={requirements} />
        {props.photos}
        {/* The strip under the title already carries the blocking reason; this card repeated it word for
            word further down, so a blocked draft stated its one problem twice in two boxes. It is
            now only what it was for: what to do with a draft that is not blocked. */}
        {draft && !blocked ? <View style={[card, s.draftCard]}>
          <T variant="heading" style={s.ink}>Spremi zadatak za objavu</T>
          <T variant="copy" tone="muted">Pregledaj podatke, fotografije i rok za prijave. Objavljuješ jednom akcijom na pregledu.</T>
          <V2Action label="Izmeni nacrt" kind="quiet" disabled={busy} onPress={props.onEdit} style={s.quietLeft} />
        </View> : null}
        {!draft ? <DisclosureGroup>
          <Press accessibilityRole="button" accessibilityLabel={`Otvori prijave, ukupno ${need.brojPrijava}`} onPress={props.onCandidates} haptic="select" scaleTo={0.99} style={s.row}>
            <FactArt kind="offers" size={32} />
            <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>Prijave za ovaj zadatak</T>
              <T variant="note" tone={hasSelection ? 'ink' : 'muted'} style={hasSelection ? s.attention : null}>{hasSelection ? `${prijave(forSelection!)} za izbor` : forSelection == null ? 'Broj prijava za izbor trenutno nije dostupan.' : need.brojPrijava ? 'Trenutno nema prijava za izbor.' : 'Još nema pristiglih ponuda.'}</T>
              {need.brojPrijava > 0 ? <T variant="note" tone="muted">{`Ukupno ${prijave(need.brojPrijava)}`}</T> : null}</View>
            {hasSelection ? <View style={s.countPill}><T variant="label" style={s.countText}>{String(forSelection)}</T></View> : null}
            <CaretRight size={18} color={sys.color.muted} />
          </Press>
          {need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA' ? <View style={s.rowDivider}><V2Action label="Izmeni Zadatak" kind="quiet" disabled={busy} onPress={props.onEdit} style={s.rowAction} /></View> : null}
        </DisclosureGroup> : null}
        {/* A stranger saw this Task on a map before its owner did: the public projection carried the
            point and the owner's own read never asked for it. Same coarse pair, same map. */}
        {!remote && props.map ? <View style={s.section}><SectionTitle>Mesto zadatka</SectionTitle>{props.map}
          <T variant="note" tone="muted">Ovako drugi vide mesto. Tačna adresa se deli tek u Dogovoru.</T></View> : null}
        <DisclosureGroup>
          <DisclosureRow first label="Mesto izvršenja" detail={need.detalji?.geografija ? rows[0]?.value : 'Približno područje'} expanded={expanded} onPress={() => setExpanded(current => !current)}>
            {!need.detalji?.geografija ? <T variant="note" tone="muted">Javna struktura lokacije nije dostupna. Prikazano je približno područje.</T> : null}
            <DetailPairs rows={[...rows, ...(need.taskCountryCode ? [{ label: 'Država', value: countryName(need.taskCountryCode) ?? need.taskCountryCode }] : [])]} />
          </DisclosureRow>
        </DisclosureGroup>
        {remainingClosed ? <View style={[card, s.mutedCard]}><T variant="heading" style={s.ink}>Preostala potraga je zatvorena</T><T variant="note" tone="muted">Originalni Zadatak i postojeći Dogovori ostaju nepromenjeni.</T></View>
          : need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0
            ? <View style={card}><T variant="copy" tone="muted">Dogovoreno je {need.pokrivenost.popunjeno} od {need.pokrivenost.ukupno}. Ako više niko ne treba, zatvori potragu za preostala mesta.</T>
              <V2Action label="Ne traži više nikoga" kind="quiet" disabled={busy} onPress={props.onCloseRemaining} style={s.quietLeft} /></View> : null}
        <QuietNote>Tačna lokacija i privatne napomene ostaju privatni.</QuietNote>
        {props.lifecycleActions}
        {props.qaAction}
      </ScrollView>}
    {/* A published Zadatak nobody has applied to yet has no next step for its owner: the orange "Pregledaj prijave"
        opened an empty list (phone, 2026-09-23). The strip under the title already says applications arrive here, and
        the applications row still opens the list, so the footer waits for the first application. */}
    {usable && (draft || blocked || busy || need!.brojPrijava > 0) ? <View style={s.footer}>
      <ProductFooterAction label={primaryLabel} count={applications?.count} accessibilityLabel={applications?.spoken}
        disabled={busy} arrow={!working} onPress={primaryAction} />
    </View> : null}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 },
  state: { padding: 20, gap: 16 },
  content: { padding: 20, paddingTop: 12, paddingBottom: 28, gap: 20 },
  hero: { gap: 8, marginTop: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  section: { gap: 8 },
  facts: { gap: 18 },
  description: { color: sys.color.ink, lineHeight: 26 },
  // Orange is the one action and the one mark of attention. This box is neither: the strip at the
  // top already says the Task is a draft, and the footer already carries the step in orange. Tinting
  // a static instruction as well left three orange things on one screen, none of them the step.
  draftCard: { gap: 8 }, mutedCard: { backgroundColor: sys.color.wash, gap: 6 },
  row: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 }, rowDivider: { borderTopWidth: 1, borderColor: sys.color.line },
  rowAction: { alignSelf: 'flex-start', marginHorizontal: 12 },
  attention: { color: sys.color.warn, fontWeight: '600' },
  countPill: { minWidth: 26, height: 26, borderRadius: sys.radius.pill, paddingHorizontal: 8, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  countText: { color: sys.color.onOrange, letterSpacing: 0, lineHeight: 16 },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
});
