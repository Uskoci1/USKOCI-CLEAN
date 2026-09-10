import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowsLeftRight, User, SignOut, MapPin, CalendarBlank, Bell, DownloadSimple, ShieldCheck, Clock } from 'phosphor-react-native';
import { sesijaSada, useSesija } from '../../store/sesija';
import { authClientService } from '../../data/authClientService';
import { ownProfileClientService } from '../../data/ownProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow, SettingsAction, settingsStyles as styles } from '../../ui/settings/SettingsPresentation';
import { v2 } from '../../ui/v2/tokens';
import { BuildIdentity } from '../../ui/BuildIdentity';
import { useUloga, postaviUlogu, ulogaSada } from '../../store/uloga';

type ActionScope = { accountId: string; accountRevision: number; intent: ReturnType<typeof useUloga>; busy: boolean };

export default function Profil() {
  const uloga = useUloga();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const narucilac = uloga === 'narucilac';
  const load = useCallback(() => ownProfileClientService.read(accountId ?? '', uloga), [accountId, uloga]);
  const profile = useFocusedResource(load);
  const actionScope = useRef<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope | null = accountId ? { accountId, accountRevision, intent: uloga, busy: false } : null;
    actionScope.current = scope;
    setBusy(false);
    setLogoutError(false);
    return () => { if (actionScope.current === scope) actionScope.current = null; };
  }, [accountId, accountRevision, uloga]));

  function isCurrent(scope: ActionScope) {
    return actionScope.current === scope && sesijaSada().user?.id === scope.accountId &&
      sesijaSada().accountRevision === scope.accountRevision && ulogaSada() === scope.intent;
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
      // A late response must not change a new account, intent or focused screen.
      if (isCurrent(scope)) {
        scope.busy = false;
        setBusy(false);
      }
    }
  }

  const initials = profile.data?.ime?.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase();
  const currentIntent = narucilac ? 'MENI TREBA' : 'JA MOGU';
  const nextIntent = narucilac ? 'JA MOGU' : 'MENI TREBA';

  return <SettingsScreen title={narucilac ? 'Profil' : 'Radni profil'} disabled={busy}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace(narucilac ? '/potrebe' : '/moje-prijave'))}>
    <View style={styles.identity}>
      {profile.loading ? <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" style={styles.gap}>
        <ActivityIndicator color={v2.color.teal} /><T tone="muted">Učitavamo profil…</T>
      </View> : profile.error ? <View style={styles.gap}>
        <T>Profil trenutno nije dostupan.</T><T variant="meta" tone="muted">Proverite vezu i pokušajte ponovo.</T>
        <SettingsAction label="Pokušajte ponovo" kind="secondary" onPress={() => { void profile.refresh(); }} />
      </View> : <>
        <View style={styles.avatar}>{initials ? <T variant="heading">{initials}</T> : <User size={28} color={v2.color.teal} />}</View>
        <T variant="display" accessibilityRole="header" style={{ textAlign: 'center', fontSize: 25, lineHeight: 30 }}>{profile.data?.ime ?? 'Ime još nije uneto'}</T>
        <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>{profile.data?.grad ?? 'Grad još nije unet'}</T>
      </>}
      <View style={styles.intent}><T variant="meta">{currentIntent}</T></View>
      <SettingsAction label={`Pređite na ${nextIntent}`} kind="quiet" disabled={busy}
        icon={<ArrowsLeftRight size={20} color={v2.color.teal} />}
        onPress={() => navigate(() => {
          postaviUlogu(narucilac ? 'uskocer' : 'narucilac');
          router.replace(narucilac ? '/prilike' : '/potrebe');
        })} />
      <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>Isti nalog možete koristiti na oba načina.</T>
    </View>

    <SettingsGroup title={narucilac ? 'Tvoji Dogovori' : 'Rad i dostupnost'}>
      {!narucilac ? <>
        <SettingsRow label="Uredite Radni profil" detail="Ime, grad i veštine za prijavljivanje na Zadatke."
          icon={<User size={22} color={v2.color.teal} />} disabled={busy} onPress={() => navigate(() => router.navigate('/profil/radnik'))} />
        <SettingsRow label="Područje rada" detail="Gde možete da uskočite." icon={<MapPin size={22} color={v2.color.teal} />}
          disabled={busy} onPress={() => navigate(() => router.navigate('/profil/lokacija'))} />
        <SettingsRow label="Dostupnost" detail="Nedeljni raspored i izuzeci." icon={<Clock size={22} color={v2.color.teal} />}
          disabled={busy} onPress={() => navigate(() => router.navigate('/profil/dostupnost'))} />
      </> : null}
      <SettingsRow label="Kalendar Dogovora" detail="Termini potvrđenih saradnji." icon={<CalendarBlank size={22} color={v2.color.teal} />}
        disabled={busy} last onPress={() => navigate(() => router.navigate('/raspored'))} />
    </SettingsGroup>
    <SettingsGroup title="Nalog i podaci">
      <SettingsRow label="Obaveštenja" detail="Promene i poruke u saradnji." icon={<Bell size={22} color={v2.color.teal} />}
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/obavestenja'))} />
      <SettingsRow label="Privatnost i podaci" detail="Šta je javno i kako se podaci čuvaju." icon={<ShieldCheck size={22} color={v2.color.teal} />}
        disabled={busy} onPress={() => navigate(() => router.navigate('/profil/privatnost'))} />
      <SettingsRow label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije." icon={<DownloadSimple size={22} color={v2.color.teal} />}
        disabled={busy} last onPress={() => navigate(() => router.navigate('/profil/izvoz'))} />
    </SettingsGroup>
    <View style={styles.logout}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije potvrđena. Pokušajte ponovo.</T> : null}
      <SettingsAction label={busy ? 'Sačekajte…' : 'Odjavite se'} kind="quiet" disabled={busy}
        icon={<SignOut size={20} color={v2.color.muted} />} onPress={() => { void logout(); }} />
    </View>
    <BuildIdentity />
  </SettingsScreen>;
}
