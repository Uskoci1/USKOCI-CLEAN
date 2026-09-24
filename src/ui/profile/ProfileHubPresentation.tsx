import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SignOut, Camera } from 'phosphor-react-native';
import { FactArt } from '../system/FactArt';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow, SettingsAction, settingsStyles as styles } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { sys } from '../system/tokens';
import { useTextScale } from '../system/textScale';
import { BuildIdentity } from '../BuildIdentity';
import { Avatar } from '../system/Avatar';

/** A person's own header uses the Avatar's largest size, for the photo and for what stands in for it alike. */
export const PROFILE_AVATAR = 56;
/** The camera mark sits on the photo's edge at a size that leaves the face visible. */
const BADGE = { width: 24, height: 24, right: -2, bottom: -2 } as const;
/** More letters than this and the name takes the full width under the photo. */
const LONG_NAME = 24;

/** Every place the hub opens. The route turns a choice into navigation behind its own single-flight guard. */
export type ProfileHubPath = '/profil/radnik' | '/profil/lokacija' | '/profil/dostupnost' | '/raspored' | '/profil/podaci'
  | '/profil/obavestenja' | '/profil/privatnost' | '/profil/blokirani' | '/profil/izvoz' | '/profil/pravna' | '/podrska' | '/profil/o-aplikaciji';

/** Who the person is, as the route read it: still reading, not readable, or read. */
export type ProfileHubIdentity =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; place: string | null;
      /** The photo or what stands in for it, 56 px. */ photo: ReactNode;
      /** The photo screen can be opened (a profile exists and the read settled). */ photoReady: boolean; openPhoto: () => void;
      /** The rating line under the name, or nothing. */ reputation: ReactNode };

/**
 * The profile hub (2026-09-24): the person first — photo, name, place and rating in one identity row — and then short
 * grouped rows to everything they set up. A row says a state, never where it goes. The name is edited in its own row
 * ("Ime na profilu"): one control per job. On a narrow phone, with large text or with a long name the identity stacks
 * (photo on top), so a 28 px name never breaks into three lines beside the photo. Logout is a quiet action; there is no
 * primary action here.
 * Presentation only: the route owns the reads, the single-flight guard and logout.
 */
export function ProfileHub({ identity, capabilityDetail, workArea, busy, open, onBack, onLogout, logoutError, stacked: forced }: {
  identity: ProfileHubIdentity; capabilityDetail?: string; workArea?: string; busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void; logoutError: boolean;
  /** A fixed layout for the design gallery; otherwise it follows the width and the rounded text scale. */ stacked?: boolean;
}) {
  const { width } = useWindowDimensions(), textScale = useTextScale();
  // A long name stacks too: beside the photo a 28 px name of more than about 24 letters needs three lines at 390 dp, and a
  // person's own name is never cut with an ellipsis (review of step 9, 2026-09-24).
  const longName = identity.state === 'ready' && (identity.name?.length ?? 0) > LONG_NAME;
  const stacked = forced ?? (width < 360 || textScale >= 1.3 || longName);
  const nameLines = stacked ? 3 : 2;
  const row = [s.identity, stacked && s.stacked];
  const copy = [s.copy, stacked && s.copyStacked];
  return <SettingsScreen title="Profil" disabled={busy} onBack={onBack}>
    <View style={styles.identity}>
      {identity.state === 'loading' ? <View testID="profile-identity" accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" style={row}>
        {/* The shape of what is coming, standing still: the photo's disc, and one quiet line where the name will be. */}
        <View style={s.skeletonDisc} />
        <T tone="muted">Učitavamo profil…</T>
      </View> : identity.state === 'error' ? <View testID="profile-identity" style={row}>
        <Avatar initials={null} size={PROFILE_AVATAR} />
        <View style={copy}>
          <T variant="bodyStrong">Profil trenutno nije dostupan.</T>
          <T variant="note" tone="muted">Proveri vezu pa probaj ponovo.</T>
          <View style={s.retry}><SettingsAction label="Pokušaj ponovo" kind="secondary" onPress={identity.retry} /></View>
        </View>
      </View> : <View testID="profile-identity" style={row}>
        {/* The photo itself opens the photo screen; the small camera badge says so without a second control. */}
        <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
          disabled={!identity.photoReady || busy} accessibilityState={{ disabled: !identity.photoReady || busy }} onPress={identity.openPhoto}
          haptic="select" scaleTo={0.97}>
          {identity.photo}
          {identity.photoReady ? <View style={[styles.avatarBadge, BADGE]}><Camera size={14} color={sys.color.ink} /></View> : null}
        </Press>
        <View style={copy}>
          {identity.name ? <T variant="display" accessibilityRole="header" style={styles.name} numberOfLines={nameLines}>{identity.name}</T>
            : <T variant="display" tone="muted" accessibilityRole="header" style={styles.name} numberOfLines={nameLines}>Ime još nije uneto</T>}
          {identity.place ? <View style={styles.identityCity}><FactArt kind="pin" size={18} />
            <T variant="copy" tone="muted" style={s.shrink}>{identity.place}</T></View> : null}
          {identity.reputation}
        </View>
      </View>}
    </View>

    <SettingsGroup title="Kako mogu da uskočim">
      {/* The one fact that decides whether a task is ever offered to you is whether this part is set up and active. */}
      <SettingsRow label="Veštine, alat i tim" detail={capabilityDetail} icon={<FactArt kind="users" size={26} />} disabled={busy}
        onPress={() => open('/profil/radnik')} />
      <SettingsRow label="Područje rada" detail={workArea} icon={<FactArt kind="pin" size={26} />} disabled={busy}
        onPress={() => open('/profil/lokacija')} />
      <SettingsRow label="Dostupnost" icon={<FactArt kind="clock" size={26} />} disabled={busy} onPress={() => open('/profil/dostupnost')} />
      <SettingsRow label="Kalendar obaveza" icon={<FactArt kind="calendar" size={26} />} disabled={busy} last onPress={() => open('/raspored')} />
    </SettingsGroup>
    <SettingsGroup title="Nalog">
      <SettingsRow label="Ime na profilu" icon={<FactArt kind="person" size={26} />} disabled={busy} onPress={() => open('/profil/podaci')} />
      <SettingsRow label="Podešavanja obaveštenja" icon={<FactArt kind="bell" size={26} />} disabled={busy} last
        onPress={() => open('/profil/obavestenja')} />
    </SettingsGroup>
    {/* Needed once in a long while, so these rows sit lower and without the icon disc. Their words are privacy wording and
        stay as they are; "Privatnost i podaci" is the one visible way to closing the account. */}
    <SettingsGroup title="Privatnost">
      <SettingsRow compact label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga."
        disabled={busy} onPress={() => open('/profil/privatnost')} />
      <SettingsRow compact label="Blokirani korisnici" detail="Tvoja blokiranja i privatne prijave."
        disabled={busy} onPress={() => open('/profil/blokirani')} />
      <SettingsRow compact label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije."
        disabled={busy} onPress={() => open('/profil/izvoz')} />
      <SettingsRow compact label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka."
        disabled={busy} last onPress={() => open('/profil/pravna')} />
    </SettingsGroup>
    <SettingsGroup title="USKOČI">
      {/* The detail stays: it names the right to a new review. */}
      <SettingsRow label="Podrška" detail="Privatni zahtevi, odgovori i ponovni pregled." icon={<FactArt kind="support" size={26} />}
        disabled={busy} onPress={() => open('/podrska')} />
      <SettingsRow label="O aplikaciji" icon={<FactArt kind="info" size={26} />} disabled={busy} last onPress={() => open('/profil/o-aplikaciji')} />
    </SettingsGroup>
    <View style={styles.logout}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije potvrđena. Probaj ponovo.</T> : null}
      <SettingsAction label={busy ? 'Sačekaj…' : 'Odjavi se'} kind="quiet" disabled={busy}
        icon={<SignOut size={20} color={sys.color.muted} />} onPress={onLogout} />
    </View>
    <BuildIdentity />
  </SettingsScreen>;
}

const s = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  copyStacked: { flex: 0, alignSelf: 'stretch' },
  shrink: { flexShrink: 1 },
  retry: { alignSelf: 'flex-start', marginTop: 4 },
  skeletonDisc: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton },
});
