import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { User, SignOut, MapPin, CalendarBlank, Bell, Clock, Camera, Lifebuoy, Info, PencilSimple } from 'phosphor-react-native';
import { FactArt } from '../../ui/system/FactArt';
import { sesijaSada, useSesija } from '../../store/sesija';
import { authClientService } from '../../data/authClientService';
import { ownProfileClientService } from '../../data/ownProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow, SettingsAction, settingsStyles as styles } from '../../ui/settings/SettingsPresentation';
import { Press } from '../../ui/Press';
import { sys } from '../../ui/system/tokens';
import { BuildIdentity } from '../../ui/BuildIdentity';
import { AccountReputation } from '../../ui/reviews/AccountReputation';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';

type ActionScope = { accountId: string; accountRevision: number; busy: boolean };

export default function Profil() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  // One account has one identity and, beside it, how it can help (owner decision 1, 2026-09-19).
  // The hub used to be two hubs chosen by a global mode, with a switch between them. It now reads
  // both of the account's own profile rows: the one tasks are published under carries the name and
  // the photo, the other says whether tasks can be offered to this person at all.
  const load = useCallback(async () => {
    const [identity, capability] = await Promise.all([
      ownProfileClientService.read(accountId ?? '', 'narucilac'), ownProfileClientService.read(accountId ?? '', 'uskocer')]);
    return { identity: identity ?? capability, capability };
  }, [accountId]);
  const profile = useFocusedResource(load);
  const actionScope = useRef<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope | null = accountId ? { accountId, accountRevision, busy: false } : null;
    actionScope.current = scope;
    setBusy(false);
    setLogoutError(false);
    return () => { if (actionScope.current === scope) actionScope.current = null; };
  }, [accountId, accountRevision]));

  function isCurrent(scope: ActionScope) {
    return actionScope.current === scope && sesijaSada().user?.id === scope.accountId &&
      sesijaSada().accountRevision === scope.accountRevision;
  }

  function beginAction() {
    const scope = actionScope.current;
    if (!scope || scope.busy || !isCurrent(scope)) return null;
    scope.busy = true;
    setBusy(true);
    return scope;
  }

  function navigate(action: () => void) {
    if (!beginAction()) return;
    action();
  }

  async function logout() {
    const scope = beginAction();
    if (!scope) return;
    setLogoutError(false);
    try {
      await authClientService.signOutLocal({ accountId: scope.accountId, accountRevision: scope.accountRevision });
    } catch {
      if (isCurrent(scope)) setLogoutError(true);
    } finally {
      // A late response must not change a new account or focused screen.
      if (isCurrent(scope)) {
        scope.busy = false;
        setBusy(false);
      }
    }
  }

  const identity = profile.data?.identity ?? null, capability = profile.data?.capability ?? null;
  const capabilityDetail = !profile.data ? 'Veštine, alat i tim za prijavljivanje na zadatke.'
    : !capability ? 'Još nisi podesio kako možeš da uskočiš. Bez toga ne možeš da se prijaviš na zadatak.'
      : capability.stanje === 'DRAFT' ? 'Profil je nacrt — dok je nacrt, zadaci ti se ne nude.'
        : capability.stanje === 'SUSPENDED' ? 'Profil je obustavljen. Piši podršci.' : 'Ime, grad i veštine za prijavljivanje na zadatke.';
  const initials = identity?.ime?.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase();
  const photoReady = !!identity?.profileId && !profile.loading && !profile.error;
  const openPhoto = () => { const id = identity?.profileId; if (!id || profile.loading || profile.error) return;
    navigate(() => router.push({ pathname: '/profil/fotografija', params: { profileId: id } })); };
  const avatar = <View style={styles.avatar}>{initials ? <T variant="display" tone="success" style={sys.type.monogram}>{initials}</T> : <User size={34} color={sys.color.green} />}</View>;

  return <SettingsScreen title="Profil" disabled={busy}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/'))}>
    <View style={styles.identity}>
      {profile.loading ? <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" style={[styles.gap, { alignItems: 'center' }]}>
        <ActivityIndicator color={sys.color.green} /><T tone="muted">Učitavamo profil…</T>
      </View> : profile.error ? <View style={styles.gap}>
        <T>Profil trenutno nije dostupan.</T><T variant="note" tone="muted">Proveri vezu pa probaj ponovo.</T>
        <SettingsAction label="Probaj ponovo" kind="secondary" onPress={() => { void profile.refresh(); }} />
      </View> : <>
        {/* V41: one identity row — the photo, the name with the city under it, and "Uredi" on the right. The avatar
            itself opens the photo; the small camera badge says so without a second control. */}
        <View style={styles.identityRow}>
          <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
            disabled={!photoReady || busy} accessibilityState={{ disabled: !photoReady || busy }} onPress={openPhoto} haptic="select" scaleTo={0.97}>
            {identity?.profileId ? <ProfilePhoto profileId={identity.profileId} size={80} fallback={avatar} /> : avatar}
            {photoReady ? <View style={styles.avatarBadge}><Camera size={16} color={sys.color.ink} /></View> : null}
          </Press>
          <View style={styles.identityCopy}>
            <T variant="display" accessibilityRole="header" style={styles.name} numberOfLines={2}>{identity?.ime ?? 'Ime još nije uneto'}</T>
            <View style={styles.identityCity}><FactArt kind="pin" size={18} /><T variant="copy" tone="muted">{identity?.grad ?? 'Grad još nije unet'}</T></View>
          </View>
          <Press accessibilityRole="button" accessibilityLabel="Uredi ime na profilu" haptic="select" disabled={busy}
            onPress={() => navigate(() => router.push('/profil/podaci'))} style={styles.editButton}>
            <PencilSimple size={16} color={sys.color.green} /><T variant="meta" style={styles.editText}>Uredi</T>
          </Press>
        </View>
      </>}
      {accountId ? <AccountReputation accountId={accountId} /> : null}
    </View>

    <SettingsGroup title="Kako mogu da uskočim">
      {/* The hub is where you arrive, and the one fact that decides whether a task is ever offered
          to you is whether this part is set up and active. It says so here, in every state. */}
      <SettingsRow label="Veštine, alat i tim" detail={capabilityDetail}
        icon={<User size={22} color={sys.color.green} />} disabled={busy} onPress={() => navigate(() => router.navigate('/profil/radnik'))} />
      <SettingsRow label="Područje rada" detail="Gde možeš da uskočiš." icon={<MapPin size={22} color={sys.color.green} />}
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/lokacija'))} />
      <SettingsRow label="Dostupnost" detail="Nedeljni raspored i izuzeci." icon={<Clock size={22} color={sys.color.green} />}
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/dostupnost'))} />
      <SettingsRow label="Kalendar obaveza" detail="Termini potvrđenih saradnji." icon={<CalendarBlank size={22} color={sys.color.green} />}
        disabled={busy} last onPress={() => navigate(() => router.navigate('/raspored'))} />
    </SettingsGroup>
    <SettingsGroup title="Nalog">
      <SettingsRow label="Ime na profilu" detail="Ime koje prikazuješ uz svoje zadatke."
        icon={<User size={22} color={sys.color.green} />} disabled={busy} onPress={() => navigate(() => router.navigate('/profil/podaci'))} />
      <SettingsRow label="Podešavanja obaveštenja" detail="Šta ti stiže i kada — kanali i tihi sati." icon={<Bell size={22} color={sys.color.green} />}
        disabled={busy} last onPress={() => navigate(() => router.navigate('/profil/obavestenja'))} />
    </SettingsGroup>
    {/* Needed once in a long while, so these rows sit lower and without the icon disc: they must not
        weigh the same as the rows above that decide whether work is ever offered to you. */}
    <SettingsGroup title="Privatnost">
      <SettingsRow compact label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga."
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/privatnost'))} />
      <SettingsRow compact label="Blokirani korisnici" detail="Tvoja blokiranja i privatne prijave."
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/blokirani'))} />
      <SettingsRow compact label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije."
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/izvoz'))} />
      <SettingsRow compact label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka."
        disabled={busy} last onPress={() => navigate(() => router.navigate('/profil/pravna'))} />
    </SettingsGroup>
    <SettingsGroup title="USKOČI">
      <SettingsRow label="Podrška" detail="Privatni zahtevi, odgovori i ponovni pregled." icon={<Lifebuoy size={22} color={sys.color.green} />}
        disabled={busy} onPress={() => navigate(() => router.navigate('/podrska'))} />
      <SettingsRow label="O aplikaciji" detail="Kako USKOČI povezuje zadatke i ljude." icon={<Info size={22} color={sys.color.green} />}
        disabled={busy} last onPress={() => navigate(() => router.navigate('/profil/o-aplikaciji'))} />
    </SettingsGroup>
    <View style={styles.logout}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije potvrđena. Probaj ponovo.</T> : null}
      <SettingsAction label={busy ? 'Sačekaj…' : 'Odjavi se'} kind="quiet" disabled={busy}
        icon={<SignOut size={20} color={sys.color.muted} />} onPress={() => { void logout(); }} />
    </View>
    <BuildIdentity />
  </SettingsScreen>;
}
