import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SignOut, Camera } from 'phosphor-react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow, SettingsAction, settingsStyles as styles } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { floating, sys } from '../system/tokens';
import { useTextScale } from '../system/textScale';
import { BuildIdentity } from '../BuildIdentity';
import { Avatar } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { V2Action } from '../v2/V2Action';

/** The identity passport reserves the same size for a real photo, initials and unavailable identity. */
export const PROFILE_AVATAR = 72;
/** The camera mark sits on the photo's edge at a size that leaves the face visible. */
const BADGE = { width: 24, height: 24, right: -2, bottom: -2 } as const;

/** Every place the hub opens. The route turns a choice into navigation behind its own single-flight guard. */
export type ProfileHubPath = '/profil/radnik' | '/profil/lokacija' | '/profil/dostupnost' | '/raspored' | '/profil/podaci'
  | '/profil/obavestenja' | '/profil/privatnost' | '/profil/blokirani' | '/profil/izvoz' | '/profil/pravna' | '/podrska' | '/profil/o-aplikaciji';

/** Who the person is, as the route read it: still reading, not readable, or read. */
export type ProfileHubIdentity =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; place: string | null;
      /** The photo or what stands in for it, using PROFILE_AVATAR. */ photo: ReactNode;
      /** The photo screen can be opened (a profile exists and the read settled). */ photoReady: boolean; openPhoto: () => void;
      /** The rating line under the name, or nothing. */ reputation: ReactNode };

/**
 * Identity leads in one raised passport; its edit action is subordinate. Reputation keeps full width because it can
 * include actual review comments, loading and recovery. Independent work facts follow before setup and utilities.
 * The route still owns reads, navigation admission and logout. This view never substitutes unavailable facts.
 */
export function ProfileHub({ identity, capabilityDetail, workArea, workSummary, busy, open, onBack, onLogout, logoutError, stacked: forced }: {
  identity: ProfileHubIdentity; capabilityDetail?: string; workArea?: string; workSummary?: ReactNode; busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void; logoutError: boolean;
  /** Compact passport insets for the design gallery or narrow/large-text layouts. Identity always stacks. */ stacked?: boolean;
}) {
  const { width } = useWindowDimensions(), textScale = useTextScale();
  const compact = forced ?? (width < 360 || textScale >= 1.3);
  const row = s.identity;
  const copy = s.copy;
  return <SettingsScreen title="Profil" disabled={busy} onBack={onBack}>
    <View style={[s.identitySection, compact && s.identityCompact]}>
      {/* Separate hosts keep loading semantics out of the ready/error identity after a native transition. */}
      {identity.state === 'loading' ? <View key="loading" testID="profile-identity" accessible
        accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" accessibilityState={{ busy: true }} style={row}>
        {/* The shape of what is coming, standing still: the photo's disc, and one quiet line where the name will be. */}
        <View style={s.skeletonDisc} />
        <T tone="muted">Učitavamo profil…</T>
      </View> : identity.state === 'error' ? <View key="error" testID="profile-identity" accessible={false}
        accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={row}>
        <Avatar initials={null} size={PROFILE_AVATAR} />
        <View style={copy}>
          <T variant="bodyStrong">Profil trenutno nije dostupan.</T>
          <T variant="note" tone="muted">Proveri vezu pa probaj ponovo.</T>
          <View style={s.retry}><SettingsAction label="Pokušaj ponovo" kind="secondary" onPress={identity.retry} /></View>
        </View>
      </View> : <View key="ready" testID="profile-identity" accessible={false}
        accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={row}>
        {/* The photo itself opens the photo screen; the small camera badge says so without a second control. */}
        <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
          disabled={!identity.photoReady || busy} accessibilityState={{ disabled: !identity.photoReady || busy }} onPress={identity.openPhoto}
          haptic="select" scaleTo={0.97}>
          {identity.photo}
          {identity.photoReady ? <View style={[styles.avatarBadge, BADGE]}><Camera size={14} color={sys.color.ink} /></View> : null}
        </Press>
        <View style={copy}>
          {identity.name ? <T variant="title" accessibilityRole="header" style={s.name}>{identity.name}</T>
            : <T variant="title" tone="muted" accessibilityRole="header" style={s.name}>Ime još nije uneto</T>}
          {identity.place ? <View style={[styles.identityCity, s.city]}><FactArt kind="pin" size={18} />
            <T variant="copy" tone="muted" style={s.shrink}>{identity.place}</T></View> : null}
        </View>
        {identity.reputation ? <View style={s.reputation}>{identity.reputation}</View> : null}
      </View>}
      <View style={s.editName}>
        <V2Action label="Ime na profilu" kind="quiet" tone="neutral" compact disabled={busy} onPress={() => open('/profil/podaci')} />
      </View>
    </View>

    {workSummary}

    <SettingsGroup title="Kako mogu da uskočim">
      {/* The one fact that decides whether a task is ever offered to you is whether this part is set up and active. */}
      <SettingsRow label="Veštine, alat i tim" detail={capabilityDetail} icon={<FactArt kind="users" size={26} />} disabled={busy}
        onPress={() => open('/profil/radnik')} />
      <SettingsRow label="Područje rada" detail={workArea} icon={<FactArt kind="pin" size={26} />} disabled={busy}
        onPress={() => open('/profil/lokacija')} />
      <SettingsRow label="Dostupnost" detail="Kada mogu da radim" icon={<FactArt kind="clock" size={26} />} disabled={busy}
        onPress={() => open('/profil/dostupnost')} />
      <SettingsRow label="Kalendar obaveza" detail="Dogovoreni termini" icon={<FactArt kind="calendar" size={26} />} disabled={busy} last
        onPress={() => open('/raspored')} />
    </SettingsGroup>
    <SettingsGroup title="Nalog i pomoć">
      <ProfileUtilityRow label="Podešavanja obaveštenja" art="bell" disabled={busy}
        onPress={() => open('/profil/obavestenja')} />
      {/* The detail names the right to a new review, not just a generic contact link. */}
      <ProfileUtilityRow label="Podrška" detail="Privatni zahtevi, odgovori i ponovni pregled." art="support"
        disabled={busy} onPress={() => open('/podrska')} />
      <ProfileUtilityRow label="O aplikaciji" art="info" disabled={busy} last onPress={() => open('/profil/o-aplikaciji')} />
    </SettingsGroup>
    {/* Needed once in a long while, so these rows sit lower and without the icon disc. Their words are privacy wording and
        stay as they are; "Privatnost i podaci" is the one visible way to closing the account. */}
    <SettingsGroup title="Privatnost">
      <ProfileUtilityRow label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga."
        disabled={busy} onPress={() => open('/profil/privatnost')} />
      <ProfileUtilityRow label="Blokirani korisnici" detail="Tvoja blokiranja i privatne prijave."
        disabled={busy} onPress={() => open('/profil/blokirani')} />
      <ProfileUtilityRow label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije."
        disabled={busy} onPress={() => open('/profil/izvoz')} />
      <ProfileUtilityRow label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka."
        disabled={busy} last onPress={() => open('/profil/pravna')} />
    </SettingsGroup>
    <View style={styles.logout}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije potvrđena. Probaj ponovo.</T> : null}
      <SettingsAction label={busy ? 'Sačekaj…' : 'Odjavi se'} kind="quiet" disabled={busy}
        icon={<SignOut size={20} color={sys.color.muted} />} onPress={onLogout} />
    </View>
    <BuildIdentity />
  </SettingsScreen>;
}

/** Quieter account utilities preserve the same labels, hints, disabled treatment and completion-time handlers. */
function ProfileUtilityRow({ label, detail, art, disabled, last = false, onPress }: {
  label: string; detail?: string; art?: FactArtKind; disabled: boolean; last?: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    style={[s.utility, last && s.utilityLast]}>
    {art ? <View style={s.utilityArt}><FactArt kind={art} size={24} cut="art" muted={disabled} /></View> : null}
    <View style={s.utilityCopy}>
      <T variant="body" tone={disabled ? 'muted' : 'ink'}>{label}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    <Glyph name="caret-right" size={20} tone="muted" />
  </Press>;
}

const s = StyleSheet.create({
  identitySection: { ...floating, backgroundColor: sys.color.surface, borderRadius: sys.radius.card,
    paddingHorizontal: sys.space.lg, paddingTop: sys.space.lg, paddingBottom: sys.space.base, gap: sys.space.md },
  identityCompact: { paddingHorizontal: sys.space.base },
  identity: { flexDirection: 'column', alignItems: 'center', gap: sys.space.md },
  copy: { alignSelf: 'stretch', minWidth: 0, alignItems: 'center', gap: sys.space.xs },
  city: { justifyContent: 'center', maxWidth: '100%' },
  // Do not center or constrain the supplied node's children: it can contain full review comments and retry actions.
  reputation: { alignSelf: 'stretch', minWidth: 0 },
  editName: { alignSelf: 'center', maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  retry: { alignSelf: 'center', marginTop: sys.space.xs },
  name: { ...sys.type.pageTitle, textAlign: 'center', alignSelf: 'stretch', letterSpacing: -0.5 },
  skeletonDisc: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton },
  utility: { minHeight: 56, paddingVertical: sys.space.md, flexDirection: 'row', gap: sys.space.md,
    alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  utilityLast: { borderBottomWidth: 0 },
  utilityArt: { width: 32, alignItems: 'center' },
  utilityCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});
