import type { TaskRelation } from '../../data/taskRelation';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { inicijali } from '../../lib/inicijali';
import { vreme } from '../../lib/vreme';
import { osoba } from '../system/plural';
import { DetailDescription, DetailFact, DetailFacts, DetailRoute, DetailSection, routeAddsToArea, ProductFooterAction, ProductHeader, ProductPerson,
  ProductRequirements, ProductTitle, productPriceParts, useDetailMenu, useDetailScrollTitle } from '../product/ProductDetails';
import type { SheetAction } from '../system/ActionSheet';
import { PublicProfileSheet, type PublicProfileState, type SafetyEntry } from '../system/PublicProfileSheet';
import { SkeletonCard } from '../system/Skeleton';
import { FactArt } from '../system/FactArt';
import { brandAction, card, floating, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * Why a person cannot apply to a task they could otherwise apply to, in one short line, from the facts the screen
 * already has (owner step 5b, 2026-09-24). It used to be one sentence for every case, which said nothing about whether
 * waiting would help. Full places first (nothing will open them), then a deadline that has passed, then the task's own
 * gate, which may open again. Never a guess: a deadline is named only when the route says it has passed.
 */
export function applyClosedReason(need: Pick<PrilikaProjekcija, 'pokrivenost' | 'rokZaPrijaveIso'>, deadlinePassed: boolean): string {
  if (need.pokrivenost.preostalo <= 0) return 'Sva mesta su popunjena';
  const day = deadlinePassed ? vreme(need.rokZaPrijaveIso).split(' · ')[0] : '';
  if (day) return `Rok za prijave je prošao ${day}`;
  return 'Nove prijave trenutno nisu dostupne';
}

/**
 * A task somebody else posted: first decide whether its work and terms suit me. One white brief puts the
 * title and truthful price first, groups place/time/capacity, then closes with the person behind the task.
 * Description and requirements stay open below, followed by existing photos, the approximate place and questions.
 * The name comes into the bar once the large title has scrolled away; reporting the person who posted it waits
 * behind the bar's "···". The one action, chosen by what I am to this task, stays at the foot.
 * Presentation only; the route owns reads, deadline and guards.
 */
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, relation, back, retry, apply, onOwnTask, onOwnApplication, photos, qa, map,
  onRequesterProfile, requesterProfile = null, onCloseRequesterProfile, publicPhoto, safety, deadlinePassed = false, onOtherTasks }: {
  need: PrilikaProjekcija | null; loading: boolean; error: boolean; missing: boolean; stale: boolean; busy: boolean;
  canApply: boolean; canRetry: boolean; back: () => void; retry: () => void; apply: () => void;
  /** What this account is to this task, from its own tasks and applications. Never from an app mode. */
  relation: TaskRelation; onOwnTask: () => void; onOwnApplication: () => void;
  photos?: ReactNode; qa?: ReactNode;
  /** Where the job is, as an approximate pin. The map owns a focus lifetime, so the route builds it. */
  map?: ReactNode;
  /** Owner decision 3: the requester's public profile as a sheet over the existing read. */
  onRequesterProfile?: () => void; requesterProfile?: PublicProfileState; onCloseRequesterProfile?: () => void;
  /** The sheet wants a large portrait and the row a small one, so the caller is told which. */
  publicPhoto?: (profileId: string, size?: number) => ReactNode;
  /** PKG-047 (F05): report or block the person who posted this task, from their profile and from the bar's "···". */
  safety?: SafetyEntry;
  /** The route's own clock says the server deadline for applications has passed. */
  deadlinePassed?: boolean;
  /** The way on when applying is not possible here: back to the other tasks. */
  onOtherTasks?: () => void;
}) {
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  const ready = !!need && !loading && !error && !missing;
  // The stops of a route are public structure. They are shown only when they say more than the area the
  // facts already name: "Novi Sad · Novi Sad" under "Novi Sad" was the place a fourth time.
  const route = need?.detalji?.geografija && !remote && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  const price = need ? productPriceParts(need, 'Ukupan iznos predlažeš u prijavi.') : null;
  // The server's own deadline, said only when there is one and a person can still apply before it.
  const deadline = canApply && typeof need?.rokZaPrijaveIso === 'string' ? vreme(need.rokZaPrijaveIso) : null;
  const scrollTitle = useDetailScrollTitle();
  // Reporting the person behind a task is rare, so it waits behind "···". My own task has nobody to report. The row names
  // the person: on a screen whose action is "Sastavi prijavu", a bare "Prijavi" reads as "apply" (review of step 5b).
  const rare: SheetAction[] = ready && safety && relation.kind !== 'OWNER' ? [{ key: 'safety', label: 'Prijavi ili blokiraj osobu', icon: 'shield',
    destructive: true, disabled: safety.busy, hint: 'Prijava ili blokiranje osobe koja je objavila zadatak.', onPress: safety.onPress }] : [];
  const menu = useDetailMenu(rare, { disabled: busy });
  const rating = need ? (need.narucilacOcena !== null ? `Ocena ${need.narucilacOcena}` : 'Ocena nije dostupna') : '';
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader back={back} disabled={busy} title={need ? readableTitle(need.naslov) : undefined} titleVisible={scrollTitle.titleVisible}
      right={menu.button} />
    <ScrollView contentContainerStyle={s.content} onScroll={scrollTitle.onScroll} scrollEventThrottle={16}>
      {loading || error || missing ? <View style={s.state} accessibilityLiveRegion="polite">
        {loading ? <><View accessibilityLabel="Učitavamo zadatak"><SkeletonCard rows={3} /></View><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T></>
          : <View style={card}><T accessibilityRole="header" variant="title" style={s.ink}>{error ? 'Zadatak trenutno nije moguće učitati.' : 'Zadatak nije dostupan.'}</T>
            <T variant="copy" tone="muted" style={s.gapTop}>{error ? 'Proveri internet vezu i pokušaj ponovo.' : 'Možda je zatvoren ili više nije dostupan tvom nalogu. Vrati se na Zadatke.'}</T>
            {canRetry ? <V2Action label="Pokušaj ponovo" onPress={retry} disabled={busy} style={[brandAction, s.gapTop]} /> : null}</View>}
        {stale ? <T variant="note" tone="muted">Poslednji učitani podaci. Osveži zadatak pre nastavka.</T> : null}
      </View> : null}
      {need ? <>
        <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
          {need.urgency ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View> : null}
          <ProductTitle onLayout={scrollTitle.onTitleLayout}>{readableTitle(need.naslov)}</ProductTitle>
          {price ? <View accessible accessibilityLabel={`Budžet: ${price.value}${price.note ? `, ${price.note}` : ''}`} style={s.terms}>
            <View style={s.termsArt}><FactArt kind={need.rezimCene === 'OFFERS' ? 'offers' : 'money'} size={32}
              muted={!price.isAmount && need.rezimCene !== 'OFFERS'} /></View>
            <View style={s.termsCopy}>
              <T style={price.isAmount ? s.amount : s.priceWords}>{price.value}</T>
              {price.note ? <T variant="note" tone="muted">{price.note}</T> : null}
            </View>
          </View> : null}
          <View style={s.logistics}>
            <DetailFacts>
              <DetailFact art={remote ? 'remote' : 'pin'} label={remote ? 'Način rada' : 'Lokacija'} value={remote ? 'Na daljinu' : need.podrucjeTekst} />
              <DetailFact art="calendar" label="Termin" value={need.vremeTekst} />
              <DetailFact art="users" label="Potrebno" value={osoba(need.pokrivenost.ukupno)}
                note={`${need.pokrivenost.popunjeno} / ${need.pokrivenost.ukupno} popunjeno`}
                spokenNote={`popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`} />
            </DetailFacts>
          </View>
          {/* The publisher closes the brief, before the longer reading. A missing rating stays explicitly missing. */}
          <ProductPerson name={need.narucilacIme || 'Ime trenutno nije dostupno'} caption={`Traži pomoć · ${rating}`}
            initials={inicijali(need.narucilacIme)} photo={publicPhoto?.(need.narucilacProfilId, 32)} onPress={onRequesterProfile} disabled={busy} />
        </View>
        {/* What went wrong with reporting from the "···". While the person's profile is open, its sheet says it itself (as an
            alert), so this line would repeat it and announce from behind the sheet; the route clears it on focus and when
            the sheet closes. */}
        {safety?.error && !requesterProfile ? <T accessibilityLiveRegion="polite" variant="note" tone="danger">{safety.error}</T> : null}
        {need.opis ? <DetailSection title="O zadatku"><DetailDescription text={need.opis} /></DetailSection> : null}
        <ProductRequirements rows={needRequirementRows(need)} />
        {ready && !stale ? photos : null}
        {/* The place is one section: the approximate pin, what is private, and the stops of a route. It used
            to be said three times — a fact, a map and a "Mesto izvršenja" row that opened into the same words. */}
        {!remote && (map || route.length) ? <DetailSection title="Mesto zadatka">
          {map}
          <View style={s.privacy}><FactArt kind="lock" size={24} />
            <T variant="note" tone="muted" style={s.grow}>Približno područje. Tačna adresa se deli tek u Dogovoru.</T></View>
          {route.length ? <DetailRoute rows={route} /> : null}
        </DetailSection> : null}
        {ready && !stale && qa ? <DetailSection>{qa}</DetailSection> : null}
      </> : null}
    </ScrollView>
    {ready ? <View style={s.footer}>
      {/* One action, chosen by what I am to this task. It used to be chosen by the mode the app was
          in, and an open task told a person in the other mode to go and change it in Profil. */}
      {relation.kind === 'OWNER' ? <>
        <T variant="note" tone="muted" style={s.center}>Ovo je tvoj zadatak. Ovako ga vide drugi.</T>
        <ProductFooterAction label="Otvori svoj zadatak" onPress={onOwnTask} disabled={busy} /></>
        : relation.kind === 'APPLIED' ? <>
          <T variant="note" tone="muted" style={s.center}>{relation.agreementId ? 'Tvoja prijava je izabrana.' : 'Tvoja prijava na ovaj zadatak je već poslata.'}</T>
          <ProductFooterAction label={relation.agreementId ? 'Otvori Dogovor' : 'Pogledaj svoju prijavu'} onPress={onOwnApplication} disabled={busy} /></>
          : relation.kind === 'UNKNOWN' ? <>
            <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.center}>Nismo uspeli da proverimo da li je zadatak tvoj ili si se već prijavio.</T>
            <V2Action label="Proveri ponovo" onPress={retry} disabled={busy || !canRetry} /></>
            : canApply ? <>
              {deadline ? <T variant="note" tone="muted" style={s.center}>{`Prijave do ${deadline}`}</T> : null}
              <ProductFooterAction label="Sastavi prijavu" onPress={apply} disabled={busy} /></>
              // Not the brand action: nothing here can be done about it, so the screen says why and offers the way on.
              : <View style={s.closed}>
                <T variant="note" tone="muted" style={s.closedReason}>{applyClosedReason(need!, deadlinePassed)}</T>
                {onOtherTasks ? <V2Action label="Drugi zadaci" kind="quiet" disabled={busy} onPress={onOtherTasks} style={s.closedAction} /> : null}
              </View>}
    </View> : null}
    {menu.sheet}
    {onCloseRequesterProfile ? <PublicProfileSheet state={requesterProfile} onClose={onCloseRequesterProfile} onRetry={onRequesterProfile ?? onCloseRequesterProfile}
      photo={publicPhoto} safety={safety} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 }, grow: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 20, paddingTop: sys.space.sm, gap: sys.space.xl, paddingBottom: 32 },
  state: { gap: 12 },
  // The title stays a direct child of this measured scroll block, so its handoff to the bar includes the real padding.
  hero: { ...floating, padding: sys.space.base, gap: sys.space.base, backgroundColor: sys.color.surface,
    borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  termsArt: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.control,
    backgroundColor: sys.color.greenSoft },
  termsCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  amount: { ...sys.type.priceLarge, color: sys.color.money },
  priceWords: { ...sys.type.bodyStrong, color: sys.color.ink },
  // Full-width white logistics: rules group the facts without tinted tiles or nested gutters.
  logistics: { marginHorizontal: -sys.space.base, paddingHorizontal: sys.space.base, paddingVertical: sys.space.base,
    backgroundColor: sys.color.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: sys.color.line },
  badgeRow: { flexDirection: 'row' },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, padding: sys.space.md,
    borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  // The reason and the way on share a line while they fit; at a large text size the action moves under the reason.
  closed: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12 },
  closedReason: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  closedAction: { paddingHorizontal: 8 },
});
