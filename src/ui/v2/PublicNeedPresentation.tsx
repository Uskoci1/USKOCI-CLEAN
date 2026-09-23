import type { TaskRelation } from '../../data/taskRelation';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { vreme } from '../../lib/vreme';
import { osoba } from '../system/plural';
import { DetailDescription, DetailFact, DetailFacts, DetailRoute, DetailSection, routeAddsToArea, ProductFooterAction, ProductHeader, ProductPerson,
  ProductRequirements, ProductTitle, productPriceParts } from '../product/ProductDetails';
import { PublicProfileSheet, type PublicProfileState, type SafetyEntry } from '../system/PublicProfileSheet';
import { SkeletonCard } from '../system/Skeleton';
import { FactArt } from '../system/FactArt';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * A task somebody else posted, recomposed from zero (owner, 2026-09-23: the HTML prototypes document
 * what a task says, not how the screen is laid out). A person decides here whether to take the job, so
 * the screen answers in the order they ask: what it is (the name), then where, when, how many and how
 * much as one list of four facts, then the words, what it needs, the place on a small map, the
 * questions and the person who posted it. No boxes: sections are a hairline and air. The one action,
 * chosen by what I am to this task, stays at the foot. Presentation only; the route owns reads,
 * deadline and guards.
 */
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, relation, back, retry, apply, onOwnTask, onOwnApplication, photos, qa, map,
  onRequesterProfile, requesterProfile = null, onCloseRequesterProfile, publicPhoto, safety }: {
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
  /** PKG-047 (F05): report or block the person who posted this task, from their own profile. */
  safety?: SafetyEntry;
}) {
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  const ready = !!need && !loading && !error && !missing;
  // The stops of a route are public structure. They are shown only when they say more than the area the
  // facts already name: "Novi Sad · Novi Sad" under "Novi Sad" was the place a fourth time.
  const route = need?.detalji?.geografija && !remote && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  const price = need ? productPriceParts(need, 'Ukupan iznos predlažeš u prijavi.') : null;
  // The server's own deadline, said only when there is one and a person can still apply before it.
  const deadline = canApply && typeof need?.rokZaPrijaveIso === 'string' ? vreme(need.rokZaPrijaveIso) : null;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader back={back} disabled={busy} />
    <ScrollView contentContainerStyle={s.content}>
      {loading || error || missing ? <View style={s.state} accessibilityLiveRegion="polite">
        {loading ? <><View accessibilityLabel="Učitavamo zadatak"><SkeletonCard rows={3} /></View><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T></>
          : <View style={card}><T accessibilityRole="header" variant="title" style={s.ink}>{error ? 'Zadatak trenutno nije moguće učitati.' : 'Zadatak nije dostupan.'}</T>
            <T variant="copy" tone="muted" style={s.gapTop}>{error ? 'Proveri internet vezu i pokušaj ponovo.' : 'Možda je zatvoren ili više nije dostupan tvom nalogu. Vrati se na Zadatke.'}</T>
            {canRetry ? <V2Action label="Pokušaj ponovo" onPress={retry} disabled={busy} style={[brandAction, s.gapTop]} /> : null}</View>}
        {stale ? <T variant="note" tone="muted">Poslednji učitani podaci. Osveži zadatak pre nastavka.</T> : null}
      </View> : null}
      {need ? <>
        <View style={s.hero}>
          {need.urgency ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View> : null}
          <ProductTitle>{readableTitle(need.naslov)}</ProductTitle>
        </View>
        <DetailFacts>
          <DetailFact art={remote ? 'remote' : 'pin'} label={remote ? 'Način rada' : 'Lokacija'} value={remote ? 'Na daljinu' : need.podrucjeTekst} />
          <DetailFact art="calendar" label="Termin" value={need.vremeTekst} />
          <DetailFact art="users" label="Potrebno" value={osoba(need.pokrivenost.ukupno)}
            note={`${need.pokrivenost.popunjeno} / ${need.pokrivenost.ukupno} popunjeno`}
            spokenNote={`popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`} />
          {price ? <DetailFact art="money" label="Budžet" value={price.value} note={price.note} money={price.isAmount} /> : null}
        </DetailFacts>
        {need.opis ? <DetailSection><DetailDescription text={need.opis} /></DetailSection> : null}
        <ProductRequirements rows={needRequirementRows(need)} />
        {ready && !stale ? photos : null}
        {/* The place is one section: the approximate pin, what is private, and the stops of a route. It used
            to be said three times — a fact, a map and a "Mesto izvršenja" row that opened into the same words. */}
        {!remote && (map || route.length) ? <DetailSection title="Mesto zadatka">
          {map}
          <View style={s.privacy}><FactArt kind="lock" size={18} />
            <T variant="note" tone="muted" style={s.grow}>Približno područje. Tačna adresa se deli tek u Dogovoru.</T></View>
          {route.length ? <DetailRoute rows={route} /> : null}
        </DetailSection> : null}
        {ready && !stale && qa ? <DetailSection>{qa}</DetailSection> : null}
        <ProductPerson name={need.narucilacIme || 'Ime trenutno nije dostupno'} overline="Traži pomoć"
          initial={(need.narucilacIme || '?').slice(0, 1).toLocaleUpperCase('sr-Latn-RS')}
          // A missing rating is said to be missing, as it is for a candidate; a blank line would hide the fact.
          caption={need.narucilacOcena !== null ? `Ocena ${need.narucilacOcena}` : 'Ocena nije dostupna'}
          photo={publicPhoto?.(need.narucilacProfilId, 48)} onPress={onRequesterProfile} disabled={busy} />
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
              : <T variant="note" tone="muted" style={s.center}>Nove prijave trenutno nisu dostupne za ovaj zadatak.</T>}
    </View> : null}
    {onCloseRequesterProfile ? <PublicProfileSheet state={requesterProfile} onClose={onCloseRequesterProfile} onRetry={onRequesterProfile ?? onCloseRequesterProfile}
      photo={publicPhoto} roleLabel="Traži pomoć" safety={safety} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 }, grow: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 24, paddingBottom: 32 },
  state: { gap: 12 },
  hero: { gap: 10 },
  badgeRow: { flexDirection: 'row' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
