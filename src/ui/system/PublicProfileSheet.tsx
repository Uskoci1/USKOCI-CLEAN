import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../contracts/projections';
import { inicijali } from '../../lib/inicijali';
import { ProductSheet } from '../product/ProductSheet';
import { Press } from '../Press';
import { T } from '../Text';
import { Avatar } from './Avatar';
import { FactArt } from './FactArt';
import { plural } from './plural';
import { StateView } from './StateView';
import { sys } from './tokens';

export type PublicProfileState = { loading: boolean; data: JavniProfilProjekcija | null } | null;
/** PKG-047 (F05): the one entry into report/block from a profile. The screen owns the read that turns
 *  this profile into the person behind it; the sheet only offers it and shows what came back. */
export type SafetyEntry = { onPress: () => void; busy: boolean; error: string | null };
const reviewsText = (n: number) => plural(n, 'recenzija', 'recenzije', 'recenzija');
/** The label of the safety entry, the same words as the "···" row of a task (review of step 5b). */
export const SAFETY_LABEL = 'Prijavi ili blokiraj osobu';

/**
 * A person's public profile as a sheet over the screen it was opened from (owner decision 3, 2026-09-16; moved onto the
 * one sheet engine in step 7, 2026-09-24, where it was a hand-made page modal). The person's name is the sheet's title —
 * nothing above it says "Javni profil" once the name is known (owner rule, 2026-09-23: say who they are, not where you
 * are). Presentation over the existing `javniProfil` read: a rating, a review count or a verified identity appear solely
 * when the server marks them available, and a missing one says it is missing. The caller owns the read and its guards.
 *
 * Reporting and blocking are rare, so they close the sheet's content, under a hairline: one row that names the person's
 * action ("Prijavi ili blokiraj osobu") and says the report is private. The row keeps the entry's busy and error states.
 */
export function PublicProfileSheet({ state, onClose, onRetry, photo, safety }: {
  state: PublicProfileState; onClose: () => void; onRetry: () => void;
  /**
   * The person's portrait, at the size the calling screen gives it (the task and the candidates both hand their 96 px
   * portrait with the photo's own stand-in); the 56 px Avatar with their letters when the screen hands none.
   */
  photo?: (profileId: string, size?: number) => ReactNode;
  safety?: SafetyEntry;
}) {
  if (!state) return null;
  const profile = state.loading ? null : state.data, trust = profile?.poverenje;
  const name = profile ? profile.ime?.trim() || 'Ime nije dostupno' : null;
  return <ProductSheet title={name ?? 'Javni profil'} closeLabel="Zatvori javni profil" backdropHint="Zatvara javni profil." onClose={onClose}>
    {() => state.loading ? <StateView kind="loading" title="Učitavamo javni profil…" skeleton={{ count: 1, rows: 2 }} />
      : !profile ? <StateView kind="error" title="Javni profil trenutno nije dostupan." body="Proveri vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: onRetry }} />
      : <>
        <View style={s.identity}>
          <View style={s.face}>{photo ? photo(profile.profilId) : <Avatar initials={inicijali(profile.ime)} size={56} />}</View>
          <View style={s.identityCopy}>
            {profile.naslov ? <T variant="bodyStrong" style={s.ink}>{profile.naslov}</T> : null}
            {profile.grad ? <View style={s.place}><FactArt kind="pin" size={16} /><T variant="note" tone="muted" style={s.grow}>{profile.grad}</T></View> : null}
          </View>
        </View>
        {trust ? <TrustFacts trust={trust} /> : null}
        {profile.biografija ? <View style={s.section}>
          <T variant="meta" tone="muted">O sebi</T>
          <T variant="body" style={s.ink}>{profile.biografija}</T>
        </View> : null}
        {safety ? <View style={s.safety}>
          <Press accessibilityRole="button" accessibilityLabel={`${SAFETY_LABEL}: ${name}`}
            accessibilityHint="Otvara prijavu ili blokiranje. Osoba koju prijavljuješ ne vidi prijavu."
            accessibilityState={safety.busy ? { disabled: true, busy: true } : { disabled: false }} disabled={safety.busy}
            haptic={safety.busy ? 'none' : 'medium'} scaleTo={0.99} onPress={safety.onPress} style={s.safetyRow}>
            <View style={s.safetyArt}><FactArt kind="shield" size={26} muted /></View>
            <View style={s.grow}>
              <T variant="bodyStrong" style={s.danger}>{safety.busy ? 'Otvaramo…' : SAFETY_LABEL}</T>
              <T variant="note" tone="muted">Osoba koju prijavljuješ ne vidi prijavu.</T>
            </View>
          </Press>
          {safety.error ? <T accessibilityRole="alert" variant="note" tone="danger">{safety.error}</T> : null}
        </View> : null}
      </>}
  </ProductSheet>;
}

/**
 * The rating and the finished Dogovori, side by side on one flat tint (nothing inside the sheet is a card of its own).
 * A rating is written the Serbian way ("4,8") beside the count it stands on; no reviews yet says so, an unavailable
 * rating says that, and a verified identity appears only when the server reports it.
 */
function TrustFacts({ trust }: { trust: JavniProfilPoverenje }) {
  const noReviews = trust.recenzijeDostupne && trust.brojRecenzija === 0;
  const rating = trust.ocenaDostupna && typeof trust.ocenaProsek === 'number' && Number.isFinite(trust.ocenaProsek)
    ? trust.ocenaProsek.toLocaleString('sr-Latn-RS', { maximumFractionDigits: 1 }) : null;
  const reviews = trust.recenzijeDostupne && typeof trust.brojRecenzija === 'number' && trust.brojRecenzija > 0 ? reviewsText(trust.brojRecenzija) : null;
  return <View style={s.trust}>
    <View style={s.cells}>
      <View accessible accessibilityLabel={`Ocena: ${noReviews ? 'još nema ocena' : rating ?? 'nije dostupna'}${reviews && !noReviews ? `, ${reviews}` : ''}`} style={s.cell}>
        <T variant="meta" tone="muted">Ocena</T>
        {noReviews ? <T variant="bodyStrong" style={s.ink}>Još nema ocena</T>
          : rating ? <View style={s.place}><FactArt kind="star" size={18} /><T style={s.value}>{rating}</T></View>
          : <T variant="bodyStrong" tone="muted">Nije dostupna</T>}
        {reviews && !noReviews ? <T variant="meta" tone="muted">{reviews}</T> : null}
      </View>
      <View style={s.rule} />
      <View accessible accessibilityLabel={`Završeni Dogovori: ${trust.zavrseniBroj}`} style={s.cell}>
        <T variant="meta" tone="muted">Završeni Dogovori</T>
        <T style={s.value}>{String(trust.zavrseniBroj)}</T>
      </View>
    </View>
    {trust.verifikacijaIdentitetaDostupna && trust.identitetVerifikovan ? <View style={s.verified}>
      <FactArt kind="shield" size={18} /><T variant="bodyStrong" style={s.green}>Identitet je potvrđen.</T></View> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink }, green: { color: sys.color.green }, danger: { color: sys.color.danger },
  grow: { flex: 1, minWidth: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  face: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, minWidth: 0, gap: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trust: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base, gap: sys.space.md },
  cells: { flexDirection: 'row', alignItems: 'stretch', gap: sys.space.base },
  cell: { flex: 1, minWidth: 0, gap: 2 },
  rule: { width: 1, backgroundColor: sys.color.line },
  value: { ...sys.type.priceSmall, color: sys.color.ink },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: sys.space.md, borderTopWidth: 1, borderTopColor: sys.color.line },
  section: { gap: 4 },
  safety: { gap: sys.space.sm, paddingTop: sys.space.md, borderTopWidth: 1, borderTopColor: sys.color.line },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingVertical: sys.space.xs },
  safetyArt: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.dangerSoft, alignItems: 'center', justifyContent: 'center' },
});
