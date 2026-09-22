import type { TaskRelation } from '../../data/taskRelation';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaperPlaneTilt } from 'phosphor-react-native';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needPriceText, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { osoba } from '../system/plural';
import { DetailPairs, DisclosureGroup, DisclosureRow, NextStrip, SectionTitle } from '../system/Detail';
import { ProductFact, ProductFacts, ProductHeader, ProductPerson, ProductRequirements, ProductTitle } from '../product/ProductDetails';
import { PublicProfileSheet, type PublicProfileState } from '../system/PublicProfileSheet';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * Public Task: status, green title, full-width facts and visible requirements,
 * description, photos, approximate map, Q&A and the publisher's public profile. One
 * brand action, "Sastavi prijavu", only while the server accepts applications.
 * Presentation only; the route owns reads, deadline and guards.
 */
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, relation, back, retry, apply, onOwnTask, onOwnApplication, photos, qa, map,
  onRequesterProfile, requesterProfile = null, onCloseRequesterProfile, publicPhoto }: {
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
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = need ? needGeographyRows(need) : [];
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  const ready = !!need && !loading && !error && !missing;
  // The detail has the room, so a per-person price also says what the whole task comes to.
  const price = need ? needPriceText(need, { withTotal: true }) : '';
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader title="Zadatak" back={back} backLabel="Nazad na Zadatke" disabled={busy} />
    <ScrollView contentContainerStyle={s.content}>
      {loading || error || missing ? <View style={s.state} accessibilityLiveRegion="polite">
        {loading ? <><View accessibilityLabel="Učitavamo zadatak"><SkeletonCard rows={3} /></View><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T></>
          : <View style={card}><T accessibilityRole="header" variant="title" style={s.ink}>{error ? 'Zadatak trenutno nije moguće učitati.' : 'Zadatak nije dostupan.'}</T>
            <T variant="copy" tone="muted" style={s.gapTop}>{error ? 'Proveri internet vezu i pokušaj ponovo.' : 'Možda je zatvoren ili više nije dostupan tvom nalogu. Vrati se na Zadatke.'}</T>
            {canRetry ? <V2Action label="Pokušaj ponovo" onPress={retry} disabled={busy} style={[brandAction, s.gapTop]} /> : null}</View>}
        {stale ? <T variant="note" tone="muted">Poslednji učitani podaci. Osveži zadatak pre nastavka.</T> : null}
      </View> : null}
      {need ? <>
        <NextStrip icon={PaperPlaneTilt} title={need.statusTekst} detail={canApply ? 'Prijave su otvorene. Ponudu sastavljaš ispod.' : undefined} tone={canApply ? 'green' : 'muted'} />
        <View style={s.hero}>
          {need.urgency ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View> : null}
          <ProductTitle>{readableTitle(need.naslov)}</ProductTitle>
        </View>
        <ProductFacts>
          <ProductFact art={remote ? 'remote' : 'pin'} label="Mesto" value={remote ? 'Na daljinu' : need.podrucjeTekst} />
          <ProductFact art="calendar" label="Termin" value={need.vremeTekst} />
          <ProductFact art="users" label="Potrebno" value={osoba(need.pokrivenost.ukupno)} note={`Popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`} />
          <ProductFact art={need.rezimCene === 'OFFERS' ? 'offers' : 'money'} label="Budžet" value={price} prominent />
        </ProductFacts>
        <ProductRequirements rows={needRequirementRows(need)} />
        {need.opis ? <View style={s.section}><SectionTitle>Šta treba uraditi</SectionTitle><T variant="body" style={s.description}>{need.opis}</T></View> : null}
        {ready && !stale ? photos : null}
        {/* The place was four words of text — "Centar, Beograd" — on the screen where a person
            decides whether the job is near enough to take. The point is approximate by design and
            the exact address is only ever shared inside a Dogovor. */}
        {!remote && map ? <View style={s.section}><SectionTitle>Gde je</SectionTitle>{map}
          <T variant="note" tone="muted">Približno područje. Tačna adresa se deli tek u Dogovoru.</T></View> : null}
        <DisclosureGroup>
          <DisclosureRow first label="Mesto izvršenja" detail={remote ? 'Bez fizičke lokacije' : 'Približno područje'} expanded={expanded} onPress={() => setExpanded(value => !value)}>
            {rows.length ? <DetailPairs rows={rows} /> : <T variant="note" tone="muted">Nema dodatnih podataka o mestu.</T>}
            {!remote ? <T variant="note" tone="muted">Precizni podaci o pristupu dele se u Dogovoru uz dozvolu.</T> : null}
          </DisclosureRow>
        </DisclosureGroup>
        {ready && !stale ? qa : null}
        <View style={s.section}>
          <SectionTitle>Ko objavljuje</SectionTitle>
          {/* The person who posted the task was a letter in a circle, while the people who answer
              it are shown by their photograph two screens away. The whole block is the press that
              opens their public profile, instead of a green line of text beneath it. */}
          <ProductPerson name={need.narucilacIme || 'Ime trenutno nije dostupno'}
            initial={(need.narucilacIme || '?').slice(0, 1).toLocaleUpperCase('sr-Latn-RS')}
            caption={need.narucilacOcena !== null ? `Ocena ${need.narucilacOcena}` : undefined}
            photo={publicPhoto?.(need.narucilacProfilId, 72)} onPress={onRequesterProfile} disabled={busy} />
        </View>
      </> : null}
    </ScrollView>
    {ready ? <View style={s.footer}>
      {/* One action, chosen by what I am to this task. It used to be chosen by the mode the app was
          in, and an open task told a person in the other mode to go and change it in Profil. */}
      {relation.kind === 'OWNER' ? <>
        <T variant="note" tone="muted" style={s.center}>Ovo je tvoj zadatak. Ovako ga vide drugi.</T>
        <V2Action label="Otvori svoj zadatak" onPress={onOwnTask} disabled={busy} style={brandAction} /></>
        : relation.kind === 'APPLIED' ? <>
          <T variant="note" tone="muted" style={s.center}>{relation.agreementId ? 'Tvoja prijava je izabrana.' : 'Već si se prijavio na ovaj zadatak.'}</T>
          <V2Action label={relation.agreementId ? 'Otvori Dogovor' : 'Pogledaj svoju prijavu'} onPress={onOwnApplication} disabled={busy} style={brandAction} /></>
          : relation.kind === 'UNKNOWN' ? <>
            <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.center}>Nismo uspeli da proverimo da li je zadatak tvoj ili si se već prijavio.</T>
            <V2Action label="Proveri ponovo" onPress={retry} disabled={busy || !canRetry} /></>
            : canApply ? <V2Action label="Sastavi prijavu" onPress={apply} disabled={busy} style={brandAction} />
              : <T variant="note" tone="muted" style={s.center}>Nove prijave trenutno nisu dostupne za ovaj zadatak.</T>}
    </View> : null}
    {onCloseRequesterProfile ? <PublicProfileSheet state={requesterProfile} onClose={onCloseRequesterProfile} onRetry={onRequesterProfile ?? onCloseRequesterProfile}
      photo={publicPhoto} roleLabel="Objavio zadatak" /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 },
  content: { padding: 20, paddingTop: 16, gap: 20, paddingBottom: 32 },
  state: { gap: 12 },
  hero: { gap: 8, marginTop: 4 },
  badgeRow: { flexDirection: 'row' },
  section: { gap: 8 },
  description: { color: sys.color.ink, lineHeight: 26 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
