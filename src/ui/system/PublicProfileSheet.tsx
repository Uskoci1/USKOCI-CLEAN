import type { ReactNode } from 'react';
import { ArrowLeft } from 'phosphor-react-native';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { JavniProfilProjekcija } from '../../contracts/projections';
import { useReducedMotion } from './motion';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys, card, cardCompact } from './tokens';
import { plural } from './plural';

export type PublicProfileState = { loading: boolean; data: JavniProfilProjekcija | null } | null;
/** PKG-047 (F05): the one entry into report/block from a profile. The screen owns the read that turns
 *  this profile into the person behind it; the sheet only offers it and shows what came back. */
export type SafetyEntry = { onPress: () => void; busy: boolean; error: string | null };
const reviewsText = (n: number) => plural(n, 'recenzija', 'recenzije', 'recenzija');

/**
 * Public profile as a sheet over the current context (owner decision 3, 2026-09-16):
 * presentation over the existing `javniProfil` read. Shows only what the read
 * exposes — a rating, a review count or a verified identity appear solely when
 * the server marks them available. The caller owns the read and its guards.
 */
export function PublicProfileSheet({ state, onClose, onRetry, photo, safety }: {
  state: PublicProfileState; onClose: () => void; onRetry: () => void; photo?: (profileId: string) => ReactNode;
  safety?: SafetyEntry;
}) {
  const reduced = useReducedMotion();
  if (!state) return null;
  const profile = state.data, trust = profile?.poverenje;
  return <Modal visible presentationStyle="pageSheet" animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
      {/* No role eyebrow over the title ("Traži pomoć" / "Nudi pomoć"): the person was chosen from a task or an offer a
          moment ago, so the sheet says who they are, not where you are (owner rule, 2026-09-23). */}
      <View style={s.topBar}>
        <Press accessibilityRole="button" accessibilityLabel="Zatvori javni profil" haptic="select" onPress={onClose} style={s.close}><ArrowLeft /></Press>
        <View style={s.topCopy}><T accessibilityRole="header" variant="title" style={s.ink}>Javni profil</T></View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {state.loading ? <View style={s.card}><ActivityIndicator accessibilityLabel="Učitavanje javnog profila" color={sys.color.green} /><T variant="meta" tone="muted" style={s.center}>Učitavamo javni profil…</T></View>
          : !profile ? <View style={s.card}>
            <T accessibilityRole="alert" variant="body" style={s.ink}>Javni profil trenutno nije dostupan.</T>
            <V2Action label="Pokušaj ponovo" onPress={onRetry} />
          </View> : <>
            <View style={s.identity}>
              {/* `photo` always returned an element, so this ?? never ran and every person without
                  a picture got an empty disc. ProfilePhoto owns the fallback now. */}
              <View style={s.avatar}>{photo ? photo(profile.profilId)
                : <T accessible={false} variant="title" style={s.initial}>{(profile.ime ?? 'U').slice(0, 1).toLocaleUpperCase('sr-Latn-RS')}</T>}</View>
              <T accessibilityRole="header" variant="display" style={[s.ink, s.center]}>{profile.ime ?? 'Ime nije dostupno'}</T>
              {profile.grad ? <T variant="meta" tone="muted">{profile.grad}</T> : null}
              {profile.naslov ? <T variant="bodyStrong" style={[s.ink, s.center]}>{profile.naslov}</T> : null}
            </View>
            {trust ? <View style={s.trust}>
              <View style={s.trustCell}>
                <T variant="meta" tone="muted">Ocena</T>
                {trust.recenzijeDostupne && trust.brojRecenzija === 0 ? <T variant="bodyStrong" style={s.ink}>Još nema ocena</T>
                  : trust.ocenaDostupna ? <T style={s.trustValue}>{trust.ocenaProsek ?? '—'}</T> : <T variant="bodyStrong" tone="muted">Nije dostupna</T>}
                {trust.recenzijeDostupne && trust.brojRecenzija ? <T variant="meta" tone="muted">{reviewsText(trust.brojRecenzija)}</T> : null}
              </View>
              <View style={s.trustCell}>
                <T variant="meta" tone="muted">Završeni Dogovori</T>
                <T style={s.trustValue}>{trust.zavrseniBroj}</T>
              </View>
              {trust.verifikacijaIdentitetaDostupna && trust.identitetVerifikovan ? <View style={[s.trustCell, s.trustWide]}>
                <T variant="bodyStrong" style={{ color: sys.color.green }}>Identitet je potvrđen.</T></View> : null}
            </View> : null}
            {profile.biografija ? <View style={s.card}><T variant="meta" tone="muted">O sebi</T><T variant="body" style={s.ink}>{profile.biografija}</T></View> : null}
            {safety ? <View style={s.card}>
              <T variant="meta" tone="muted">Bezbednost</T>
              <T variant="body" style={s.ink}>Ako te neko uznemirava ili ti nešto ne deluje ispravno, prijavi ga nama ili ga blokiraj. Prijava je privatna i ne vidi je osoba koju prijavljuješ.</T>
              {safety.error ? <T accessibilityRole="alert" variant="body" style={s.warn}>{safety.error}</T> : null}
              <V2Action kind="quiet" label={safety.busy ? 'Otvaramo…' : 'Prijavi ili blokiraj'}
                accessibilityLabel={`Prijavi ili blokiraj korisnika ${profile.ime ?? ''}`.trim()}
                disabled={safety.busy} onPress={safety.onPress} />
            </View> : null}
          </>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  topCopy: { flex: 1, minWidth: 0, gap: 1 },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' }, warn: { color: sys.color.danger },
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  card: { ...card, gap: 10 },
  identity: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatar: { width: 96, height: 96, borderRadius: sys.radius.sheet, overflow: 'hidden', backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  initial: { ...sys.type.monogram, color: sys.color.green },
  trust: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trustCell: { ...cardCompact, flexGrow: 1, flexBasis: 0, minWidth: 140, gap: 4 },
  trustWide: { flexBasis: '100%' },
  trustValue: { ...sys.type.price, color: sys.color.ink },
});
