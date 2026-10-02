import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Glyph } from '../system/Glyph';
import type { PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import { readinessCopy, type NeedPublicationReadiness } from '../../data/needPublicationReadiness';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { DetailDescription, DetailRoute, DetailSection, routeAddsToArea, ProductFooterAction, ProductHeader,
  productPriceParts, useDetailMenu, useDetailScrollTitle } from '../product/ProductDetails';
import type { SheetAction } from '../system/ActionSheet';
import { FactArt, type FactArtKind, type FactArtRole } from '../system/FactArt';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, card, inset, sys } from '../system/tokens';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';
import { osoba, prijava as prijave } from '../system/plural';
import { countryName } from '../location/CountryField';
import { TaskDecisionRequirements, TaskDecisionTitle } from './detail/TaskDecision';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Objavljen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' };

export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  remainingClosed: boolean;
  onBack: () => void; onRefresh: () => void; onReview: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
  /** Opens the existing personal Agreements list, not a task-filtered list. */
  onAgreements?: () => void;
  /** What the publish gate says about a draft, asked of the gate itself. Absent means not asked. */
  readiness?: NeedPublicationReadiness | null;
  photos?: ReactNode;
  /** Where the job is, as an approximate pin. The map owns a focus lifetime, so the route builds it. */
  map?: ReactNode;
  /** The lifecycle's recovery (NeedLifecycleActions in its "···" placement): drawn only while it has something to say. */
  lifecycleActions?: ReactNode;
  /** The lifecycle's own ways in (cancel, delete a draft, the Dogovori), for the "···" beside the edits. */
  lifecycleMenu?: readonly SheetAction[];
  qaAction?: ReactNode;
};

/** A short lifecycle word above the title; the capacity fraction lives with the task facts.
 * Only an early closed search needs a sentence here, because the fraction alone would imply that
 * more people can still apply. The same rule covers a later cancellation that returns the count to 0. */
function stateLine(need: PotrebaProjekcija, remainingClosed: boolean): { title: string; detail?: string; tone: 'green' | 'muted' } {
  const { popunjeno, ukupno } = need.pokrivenost;
  const closedEarly = remainingClosed && popunjeno < ukupno ? `${popunjeno} od ${ukupno} dogovoreno · preostala potraga je zatvorena` : null;
  switch (need.stanje) {
    case 'NACRT': return { title: STATUS.NACRT, tone: 'muted' };
    case 'OBJAVLJENA': case 'CEKA_PRIJAVE': return { title: STATUS[need.stanje], ...(closedEarly ? { detail: closedEarly } : {}), tone: 'green' };
    case 'DELIMICNO_POPUNJENA':
      return { title: STATUS.DELIMICNO_POPUNJENA, ...(closedEarly ? { detail: closedEarly } : {}), tone: 'green' };
    case 'POPUNJENA': return { title: STATUS.POPUNJENA, ...(closedEarly ? { detail: closedEarly } : {}), tone: 'green' };
    default: return { title: STATUS.ZATVORENA, tone: 'muted' };
  }
}

/**
 * What the one action says about the applications, with the same number the screen already
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

/** The applications row's quiet line: how many can be chosen, and the total when it says something more. */
function applicationsDetail(need: PotrebaProjekcija): { text: string; attention: boolean } {
  const selectable = need.brojPrijavaZaIzbor;
  if (typeof selectable === 'number' && selectable > 0) return { attention: true,
    text: need.brojPrijava > selectable ? `${prijave(selectable)} za izbor · ukupno ${prijave(need.brojPrijava)}` : `${prijave(selectable)} za izbor` };
  if (selectable == null) return { attention: false, text: need.brojPrijava ? `Ukupno ${prijave(need.brojPrijava)}` : 'Još nema prijava' };
  return { attention: false, text: need.brojPrijava ? `Trenutno nema prijava za izbor. Ukupno ${prijave(need.brojPrijava)}` : 'Još nema prijava' };
}

/** The owner's next step is one distinct white surface; the facts below remain a reading group. */
function OwnTaskLink({ art, role, label, detail, accessibilityLabel, onPress, disabled, trailing }: {
  art: FactArtKind; role: FactArtRole; label: string; detail: string; accessibilityLabel?: string;
  onPress: () => void; disabled: boolean; trailing?: ReactNode;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} haptic="select"
    scaleTo={sys.motion.scale.row} style={[s.actionRow, disabled && s.disabled]}>
    <View style={s.actionArt}><FactArt kind={art} size={32} cut="art" role={role} /></View>
    <View style={s.actionCopy}><T style={s.sectionTitle}>{label}</T><T variant="note" tone="muted">{detail}</T></View>
    {trailing}<Glyph name="caret-right" size={20} tone="muted" />
  </Press>;
}

/** Full supplied strings wrap; the smaller reading scale leaves room for the actual dimensional illustration. */
function OwnTaskFact({ art, role, spoken, children }: {
  art: FactArtKind; role: FactArtRole; spoken: string; children: ReactNode;
}) {
  return <View accessible accessibilityLabel={spoken} style={s.factRow}>
    <View style={s.factArt}><FactArt kind={art} size={28} cut="art" role={role} /></View>
    <T variant="copy" style={s.factText}>{children}</T>
  </View>;
}

/**
 * The owner's own Task, recomposed from zero (owner, 2026-09-23). The owner comes here to see whether the
 * task is live and who applied, so the screen reads: the name and its state, what happened to a command
 * they sent (only while there is something to say), the applications (the owner's next step),
 * real photos, the same compact terms and work description a stranger sees, requirements, the place and the
 * questions. What changes the task is needed rarely, so it waits behind the bar's "···" (owner step 5b,
 * 2026-09-24): the edit, closing the remaining search, cancelling or deleting, each with its own
 * confirmation. One footer action: review for a draft, applications once there are any. Only existing
 * controller callbacks act.
 */
export function NeedPresentation(props: NeedPresentationProps) {
  const { need, loading, error, busy, remainingClosed } = props;
  // This is the owner's view of their own Zadatak: the route reads it through the owner-only read,
  // so there is no "other side of the app" from which it could be seen without the right to act.
  const draft = need?.stanje === 'NACRT';
  const usable = !!need && !loading && !error;
  const requirements = need ? needRequirementRows(need) : [];
  // A draft the gate refuses is not sent to a review that will refuse it again: the action leads
  // to the conversation, which is where the missing thing is asked for.
  const blocked = draft ? readinessCopy(props.readiness ?? { kind: 'UNKNOWN' }) : null;
  // `busy` is true while anything on the screen is loading, including the first read, so the one
  // action announced work in progress before anything had been asked for.
  const working = busy && !loading;
  const hasAgreements = !!need && need.pokrivenost.popunjeno > 0 && !!props.onAgreements;
  const agreementsNext = hasAgreements && !draft && (remainingClosed || need?.stanje === 'POPUNJENA'
    || need?.stanje === 'ZATVORENA' || need?.brojPrijavaZaIzbor === 0);
  const applications = need && !working && !blocked && !draft && !agreementsNext ? applicationsAction(need) : null;
  const primaryLabel = working ? 'Radnja je u toku…'
    : blocked ? 'Otvori razgovor i dopuni' : draft ? 'Pregledaj za objavu'
      : agreementsNext ? 'Otvori moje Dogovore' : 'Pregledaj prijave';
  const primaryAction = blocked ? props.onEdit : draft ? props.onReview
    : agreementsNext ? props.onAgreements! : props.onCandidates;
  const remote = need?.detalji?.geografija?.mode === 'REMOTE';
  // The owner's own task shows the same price a stranger sees, totals included; only the line under an
  // open price speaks to the owner instead of to the person applying.
  const price = need ? productPriceParts(need, 'Svako u prijavi predlaže ukupan iznos.') : null;
  const state = need ? stateLine(need, remainingClosed) : null;
  const selectable = need?.brojPrijavaZaIzbor;
  const counted = need ? applicationsDetail(need) : null;
  // The place as others see it, with the public stops of a route and the country when the task has them.
  const route = need?.detalji?.geografija && !remote && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  const country = need?.taskCountryCode ? countryName(need.taskCountryCode) ?? need.taskCountryCode : null;
  const canEdit = !!need && need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA';
  const canCloseRemaining = !!need && !remainingClosed && need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0;
  // "Stalno / ponekad / retko" (owner, 2026-09-23): changing the task is rare, so it waits behind "···". Every entry calls
  // the same callback the screen's own button called, and that callback asks before it acts.
  const rare: SheetAction[] = usable && need ? [
    ...(draft ? [{ key: 'edit', label: 'Izmeni nacrt', icon: 'document' as const, onPress: props.onEdit }]
      : canEdit ? [{ key: 'edit', label: 'Izmeni Zadatak', icon: 'document' as const, onPress: props.onEdit }] : []),
    ...(canCloseRemaining ? [{ key: 'close-remaining', label: 'Ne traži više nikoga', icon: 'users' as const, destructive: true,
      hint: `Dogovoreno je ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno}. Zatvara potragu za preostala mesta.`, onPress: props.onCloseRemaining }] : []),
    ...(props.lifecycleMenu ?? []),
  ] : [];
  const menu = useDetailMenu(rare, { disabled: busy });
  const scrollTitle = useDetailScrollTitle();
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader back={props.onBack} title={need ? readableTitle(need.naslov) : undefined} titleVisible={scrollTitle.titleVisible}
      right={menu.button} />
    {/* The lifecycle's recovery stays on the screen whatever the read is doing: a retained command is checked, and its
        outcome shown, even while the task loads or cannot be read. */}
    {loading && !need ? <View style={s.state} accessibilityLiveRegion="polite"><SkeletonCard rows={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Zadatak…</T>
        {props.lifecycleActions}
      </View>
      : !need ? <View style={s.state}>
        <View style={card}>
          <T accessibilityRole="header" variant="title" style={s.ink}>Zadatak nije dostupan</T><T variant="copy" tone="muted" style={s.gapTop}>{error ?? 'Pokušaj ponovo.'}</T>
          <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={[brandAction, s.gapTop]} />
        </View>
        {props.lifecycleActions}
      </View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} onScroll={scrollTitle.onScroll} scrollEventThrottle={16}>
        <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
          {/* People never see a category (owner decision 2026-09-21); the server reads kinds of work only to match. */}
          {need.urgency ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View> : null}
          <TaskDecisionTitle onLayout={scrollTitle.onTitleLayout}>{readableTitle(need.naslov)}</TaskDecisionTitle>
          {state ? <View style={s.stateCopy} accessible accessibilityLabel={`Stanje: ${state.title}${state.detail ? `, ${state.detail}` : ''}`}>
            <View style={s.stateRow}>
              <View style={[s.dot, { backgroundColor: state.tone === 'green' ? sys.color.green : sys.color.muted }]} />
              <T variant="copy" tone="muted">{state.title}</T>
            </View>
            {state.detail ? <T variant="note" tone="muted">{state.detail}</T> : null}
          </View> : null}
        </View>
        {loading || error ? <View accessibilityLiveRegion="polite" style={s.refreshNotice}>
          <T variant="note" tone="muted">{loading ? 'Osvežavamo podatke…' : 'Prikazan je prethodni pregled. Osveži podatke pre sledeće radnje.'}</T>
          {error && !loading ? <T variant="note" tone="danger" accessibilityRole="alert">{error}</T> : null}
          {error && !loading ? <V2Action label="Osveži zadatak" kind="quiet" compact onPress={props.onRefresh} /> : null}
        </View> : null}
        {/* A draft the publish gate refuses says why, once, where the owner reads first. */}
        {blocked ? <View style={[inset, s.blocked]} accessibilityLiveRegion="polite">
          <T variant="bodyStrong" style={s.warnTitle}>{blocked.title}</T>
          <T variant="note" style={s.ink}>{blocked.detail}</T>
        </View> : null}
        {/* What happened to a cancel or a delete the owner sent is said where they read first, never inside the "···"
            they pressed: the check, the command running, its uncertain, confirmed or refused outcome. It draws nothing
            while there is nothing to say. */}
        {props.lifecycleActions}
        {!draft && counted ? <View style={s.applications}>
          <OwnTaskLink art="offers" role="people" label="Prijave" detail={counted.text} onPress={props.onCandidates} disabled={busy || !usable}
            accessibilityLabel={`Otvori prijave. ${counted.text}`}
            trailing={counted.attention ? <View style={s.countPill}><T variant="label" style={s.countText}>{String(selectable)}</T></View> : null} />
          {hasAgreements ? <View style={s.agreementsRow}><OwnTaskLink art="agreements" role="confirmed" label="Moji dogovori"
            detail="Razgovor, uslovi i završetak posla." onPress={props.onAgreements!} disabled={busy || !usable} /></View> : null}
        </View> : null}
        <View style={s.brief}>
          <View style={s.logistics}>
            <OwnTaskFact art={remote ? 'remote' : 'pin'} role="location"
              spoken={`${remote ? 'Način rada' : 'Lokacija'}: ${remote ? 'Na daljinu' : need.podrucjeTekst}`}>
              {remote ? 'Na daljinu' : need.podrucjeTekst}
            </OwnTaskFact>
            <OwnTaskFact art="calendar" role="time" spoken={`Termin: ${need.vremeTekst}`}>{need.vremeTekst}</OwnTaskFact>
            {/* A draft has no places that could be taken yet, so it says only how many people it needs. */}
            <OwnTaskFact art="users" role="people"
              spoken={`Potrebno: ${osoba(need.pokrivenost.ukupno)}${draft ? '' : `, popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`}`}>
              {draft ? osoba(need.pokrivenost.ukupno) : <><T variant="copy" tone="muted">Dogovoreno </T>{`${need.pokrivenost.popunjeno}/${need.pokrivenost.ukupno}`}</>}
            </OwnTaskFact>
          </View>
          {price ? <View accessible accessibilityLabel={`Budžet: ${price.value}${price.note ? `, ${price.note}` : ''}`} style={s.price}>
            {price.isAmount || need.rezimCene === 'OFFERS' ? <View style={s.priceArt}>
              <FactArt kind={need.rezimCene === 'OFFERS' ? 'offers' : 'money'} size={32} cut="art"
                role={need.rezimCene === 'OFFERS' ? 'people' : 'confirmed'} />
            </View> : null}
            <View style={s.priceCopy}><T style={price.isAmount ? s.amount : s.priceWords}>{price.value}</T>
              {price.note ? <T variant="note" tone="muted">{price.note}</T> : null}
            </View>
          </View> : null}
        </View>
        {props.photos}
        {need.opis ? <View style={s.section}><T accessibilityRole="header" style={s.sectionTitle}>O zadatku</T>
          <DetailDescription text={need.opis} /></View> : null}
        <TaskDecisionRequirements rows={requirements} />
        {/* A stranger saw this Task on a map before its owner did: the public projection carried the
            point and the owner's own read never asked for it. Same coarse pair, same map, one section. */}
        {!remote && (props.map || route.length) ? <View style={s.section}>
          <T accessibilityRole="header" style={s.sectionTitle}>Mesto zadatka</T>
          {props.map}
          <View style={s.privacy}><FactArt kind="lock" size={18} />
            <T variant="note" tone="muted" style={s.grow}>Ovako drugi vide mesto. Tačnu adresu i privatne napomene vide samo izabrani, u Dogovoru.</T></View>
          {route.length ? <DetailRoute rows={route} country={country} /> : null}
        </View> : null}
        {props.qaAction ? <DetailSection>{props.qaAction}</DetailSection> : null}
        {/* The "Upravljanje zadatkom" section that ended the screen is gone: its actions are behind "···", a closed
            remaining search is said in the state line, and the lifecycle's outcomes are shown under the title. */}
      </ScrollView>}
    {/* Once there is nobody left to choose, the existing Agreements list becomes the next step.
        The applications row remains available for the full application history. */}
    {need && (draft || blocked || working || agreementsNext || need.brojPrijava > 0) ? <View style={s.footer}>
      <ProductFooterAction label={primaryLabel} count={applications?.count} accessibilityLabel={applications?.spoken}
        disabled={busy || !usable} arrow={!working} onPress={primaryAction} />
    </View> : null}
    {menu.sheet}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 }, grow: { flex: 1, minWidth: 0 },
  state: { padding: 20, gap: 16 },
  refreshNotice: { gap: sys.space.xs, alignItems: 'flex-start' },
  content: { paddingHorizontal: sys.space.xl, paddingTop: sys.space.sm, paddingBottom: 40, gap: sys.space.xl },
  hero: { gap: sys.space.sm, paddingBottom: sys.space.xs },
  stateCopy: { gap: 4 },
  brief: { gap: sys.space.base, paddingVertical: sys.space.base,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: sys.color.line, backgroundColor: sys.color.surface },
  logistics: { gap: sys.space.sm },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  factArt: { width: 32, alignItems: 'center', flexShrink: 0 },
  factText: { flex: 1, minWidth: 0, color: sys.color.ink },
  price: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingTop: sys.space.base,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line },
  priceArt: { width: 32, flexShrink: 0 },
  priceCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  amount: { ...sys.type.priceLarge, color: sys.color.ink },
  priceWords: { ...sys.type.copy, fontWeight: '600', color: sys.color.ink },
  section: { gap: sys.space.md },
  sectionTitle: { ...sys.type.copy, fontWeight: '600', color: sys.color.ink },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  stateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  blocked: { backgroundColor: sys.color.warnSoft, gap: 4 },
  warnTitle: { color: sys.color.warn },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  applications: { paddingHorizontal: sys.space.base, borderWidth: StyleSheet.hairlineWidth, borderColor: sys.color.cardLine,
    borderRadius: sys.radius.card, backgroundColor: sys.color.surface },
  actionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md },
  actionArt: { width: 36, flexShrink: 0, alignItems: 'center' },
  actionCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  disabled: { opacity: 0.5 },
  agreementsRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line },
  countPill: { minWidth: 26, height: 26, borderRadius: sys.radius.pill, paddingHorizontal: 8, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  countText: { color: sys.color.onOrange, letterSpacing: 0, lineHeight: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line },
});
