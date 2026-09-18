import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { JavniProfilProjekcija } from '../../contracts/projections';
import { useReducedMotion } from './motion';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Icon } from '../v2/icons';
import { V2Action } from '../v2/V2Action';
import { sys } from './tokens';

export type PublicProfileState = { loading: boolean; data: JavniProfilProjekcija | null } | null;
const reviewsText = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'recenzija' : n % 10 === 1 ? 'recenzija' : n % 10 >= 2 && n % 10 <= 4 ? 'recenzije' : 'recenzija'}`;

/**
 * Public profile as a sheet over the current context (owner decision 3, 2026-09-16):
 * presentation over the existing `javniProfil` read. Shows only what the read
 * exposes — a rating, a review count or a verified identity appear solely when
 * the server marks them available. The caller owns the read and its guards.
 */
export function PublicProfileSheet({ state, onClose, onRetry, photo, roleLabel }: {
  state: PublicProfileState; onClose: () => void; onRetry: () => void; photo?: (profileId: string) => ReactNode; roleLabel?: string;
}) {
  const reduced = useReducedMotion();
  if (!state) return null;
  const profile = state.data, trust = profile?.poverenje;
  return <Modal visible presentationStyle="pageSheet" animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
      <View style={s.topBar}>
        <Press accessibilityRole="button" accessibilityLabel="Zatvori javni profil" haptic="select" onPress={onClose} style={s.close}><V2Icon name="back" /></Press>
        <View style={s.topCopy}>{roleLabel ? <T variant="meta" style={s.eyebrow}>{roleLabel}</T> : null}<T accessibilityRole="header" variant="title" style={s.ink}>Javni profil</T></View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {state.loading ? <View style={s.card}><ActivityIndicator accessibilityLabel="Učitavanje javnog profila" color={sys.color.green} /><T variant="meta" tone="muted" style={s.center}>Učitavamo javni profil…</T></View>
          : !profile ? <View style={s.card}>
            <T accessibilityRole="alert" variant="body" style={s.ink}>Javni profil trenutno nije dostupan.</T>
            <V2Action label="Pokušajte ponovo" onPress={onRetry} />
          </View> : <>
            <View style={s.identity}>
              <View style={s.avatar}>{photo?.(profile.profilId) ?? <T variant="title" style={s.initial}>{(profile.ime ?? 'U').slice(0, 1).toLocaleUpperCase('sr-Latn-RS')}</T>}</View>
              <T accessibilityRole="header" variant="display" style={[s.ink, s.center]}>{profile.ime ?? 'Uskočer'}</T>
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
          </>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  topCopy: { flex: 1, minWidth: 0, gap: 1 }, eyebrow: { color: sys.color.green, fontWeight: '600' },
  ink: { color: sys.color.ink }, center: { textAlign: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18, gap: 10 },
  identity: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatar: { width: 96, height: 96, borderRadius: sys.radius.sheet, overflow: 'hidden', backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  initial: { color: sys.color.green, fontSize: 36, lineHeight: 42 },
  trust: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trustCell: { flexGrow: 1, flexBasis: 0, minWidth: 140, backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 16, gap: 4 },
  trustWide: { flexBasis: '100%' },
  trustValue: { ...sys.type.price, color: sys.color.ink },
});
