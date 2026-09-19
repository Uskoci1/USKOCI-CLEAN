import type { TaskRelation } from '../../data/taskRelation';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, MapPin, PaperPlaneTilt, Users, Wallet } from 'phosphor-react-native';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needPeopleText, needRequirementRows } from '../../data/needDetailPresentation';
import { DetailPairs, DetailTopBar, DisclosureGroup, DisclosureRow, Fact, FactGrid, NextStrip, SectionTitle } from '../system/Detail';
import { PublicProfileSheet, type PublicProfileState } from '../system/PublicProfileSheet';
import { SkeletonCard } from '../system/Skeleton';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * Public Task detail (the worker's view), V5 "Jedna objava": status and what it
 * means, the title, four facts in a grid, the description, photos, Q&A, place and
 * conditions behind two rows, the requester with their public profile, and one
 * brand action, "Sastavi prijavu", only while the server accepts applications.
 * Presentation only; the route owns reads, deadline and guards.
 */
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, relation, back, retry, apply, onOwnTask, onOwnApplication, photos, qa,
  onRequesterProfile, requesterProfile = null, onCloseRequesterProfile, publicPhoto }: {
  need: PrilikaProjekcija | null; loading: boolean; error: boolean; missing: boolean; stale: boolean; busy: boolean;
  canApply: boolean; canRetry: boolean; back: () => void; retry: () => void; apply: () => void;
  /** What this account is to this task, from its own tasks and applications. Never from an app mode. */
  relation: TaskRelation; onOwnTask: () => void; onOwnApplication: () => void;
  photos?: ReactNode; qa?: ReactNode;
  /** Owner decision 3: the requester's public profile as a sheet over the existing read. */
  onRequesterProfile?: () => void; requesterProfile?: PublicProfileState; onCloseRequesterProfile?: () => void; publicPhoto?: (profileId: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState<'location' | 'requirements' | null>(null);
  const rows = expanded === 'location' && need ? needGeographyRows(need) : expanded === 'requirements' && need ? needRequirementRows(need) : [];
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  const ready = !!need && !loading && !error && !missing;
  const price = need ? need.rezimCene === 'OFFERS' ? 'Tražim ponude' : need.ponudjenaCena?.prikaz ?? 'Cena nije navedena' : '';
  return <SafeAreaView edges={['top']} style={s.screen}>
    <DetailTopBar title="Zadatak" onBack={back} backLabel="Nazad na Zadatke" disabled={busy} />
    <ScrollView contentContainerStyle={s.content}>
      {loading || error || missing ? <View style={s.state} accessibilityLiveRegion="polite">
        {loading ? <><View accessibilityLabel="Učitavamo zadatak"><SkeletonCard rows={3} /></View><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T></>
          : <View style={card}><T variant="title" style={s.ink}>{error ? 'Zadatak trenutno nije moguće učitati.' : 'Zadatak nije dostupan.'}</T>
            <T variant="copy" tone="muted" style={s.gapTop}>{error ? 'Proveri internet vezu i pokušaj ponovo.' : 'Možda je zatvoren ili više nije dostupan tvom nalogu. Vrati se na Zadatke.'}</T>
            {canRetry ? <V2Action label="Pokušaj ponovo" onPress={retry} disabled={busy} style={[brandAction, s.gapTop]} /> : null}</View>}
        {stale ? <T variant="note" tone="muted">Poslednji učitani podaci. Osveži zadatak pre nastavka.</T> : null}
      </View> : null}
      {need ? <>
        <NextStrip icon={PaperPlaneTilt} title={need.statusTekst} detail={canApply ? 'Prijave su otvorene. Ponudu sastavljaš ispod.' : undefined} tone={canApply ? 'green' : 'muted'} />
        <View style={s.hero}>
          {need.urgency ? <View style={s.badgeRow}><NeedUrgencyBadge urgency={need.urgency} /></View> : null}
          <T accessibilityRole="header" style={s.heroTitle}>{need.naslov}</T>
        </View>
        <FactGrid>
          <Fact icon={MapPin} label="Mesto" value={remote ? 'Na daljinu' : need.podrucjeTekst} />
          <Fact icon={Clock} label="Termin" value={need.vremeTekst} />
          <Fact icon={Wallet} label="Budžet" value={price} money={need.rezimCene !== 'OFFERS' && !!need.ponudjenaCena} />
          <Fact icon={Users} label="Potrebno" value={needPeopleText(need.pokrivenost.ukupno)} note={`Popunjeno ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno} mesta`} />
        </FactGrid>
        {need.opis ? <View style={s.section}><SectionTitle>Šta treba uraditi</SectionTitle><T variant="body" style={s.description}>{need.opis}</T></View> : null}
        {ready && !stale ? photos : null}
        {ready && !stale ? qa : null}
        <DisclosureGroup>
          <DisclosureRow first label="Mesto izvršenja" detail={remote ? 'Bez fizičke lokacije' : 'Približno područje'} expanded={expanded === 'location'} onPress={() => setExpanded(value => value === 'location' ? null : 'location')}>
            {rows.length ? <DetailPairs rows={rows} /> : <T variant="note" tone="muted">Nema dodatnih podataka o mestu.</T>}
            {!remote ? <T variant="note" tone="muted">Precizni podaci o pristupu dele se u Dogovoru uz dozvolu.</T> : null}
          </DisclosureRow>
          <DisclosureRow label="Uslovi Zadatka" detail={needRequirementRows(need).length ? 'Pogledaj navedene uslove' : 'Bez dodatnih navedenih uslova'} expanded={expanded === 'requirements'} onPress={() => setExpanded(value => value === 'requirements' ? null : 'requirements')}>
            {rows.length ? <DetailPairs rows={rows} /> : <T variant="note" tone="muted">Nema dodatnih navedenih uslova.</T>}
          </DisclosureRow>
        </DisclosureGroup>
        <View style={s.section}>
          <SectionTitle>Naručilac</SectionTitle>
          <View style={[card, s.requesterCard]}>
            <View style={s.requester}>
              <View style={s.avatar}><T variant="heading" style={s.initial}>{(need.narucilacIme || 'N').slice(0, 1).toLocaleUpperCase('sr-Latn-RS')}</T></View>
              <View style={s.rowCopy}><T variant="bodyStrong" style={s.ink}>{need.narucilacIme || 'Ime trenutno nije dostupno'}</T>
                {need.narucilacOcena !== null ? <T variant="note" tone="muted">{`Ocena ${need.narucilacOcena}`}</T> : null}</View>
            </View>
            {onRequesterProfile ? <V2Action label="Javni profil naručioca" kind="quiet" disabled={busy} onPress={onRequesterProfile} style={s.quietLeft} /> : null}
          </View>
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
      photo={publicPhoto} roleLabel="Naručilac" /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, gapTop: { marginTop: 10 },
  content: { padding: 20, paddingTop: 6, gap: 16, paddingBottom: 32 },
  state: { gap: 12 },
  hero: { gap: 8, marginTop: 4 },
  badgeRow: { flexDirection: 'row' },
  heroTitle: { ...sys.type.hero, color: sys.color.ink },
  section: { gap: 8 },
  description: { color: sys.color.ink, lineHeight: 26 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  requesterCard: { gap: 10 },
  requester: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: sys.radius.chip, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initial: { color: sys.color.green },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
