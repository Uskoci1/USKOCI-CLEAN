import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, ArrowsLeftRight, User, CaretRight, SignOut } from 'phosphor-react-native';
import { sesijaSada, useSesija } from '../../store/sesija';
import { authClientService } from '../../data/authClientService';
import { ownProfileClientService } from '../../data/ownProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Button, Card } from '../../ui/Button';
import { palette, space, radius, elevation, touch } from '../../theme/tokens';
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView contentContainerStyle={{ padding: space.base, paddingBottom: space.xxl, gap: space.base }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Press accessibilityRole="button" accessibilityLabel="Nazad" disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={() => navigate(() => router.canGoBack() ? router.back() : router.replace(narucilac ? '/potrebe' : '/moje-prijave'))}
            style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={24} color={palette.ink} />
          </Press>
          <T variant="title" style={{ flex: 1 }}>{narucilac ? 'Profil' : 'Radni profil'}</T>
        </View>

        <Card style={elevation.card}>
          <View style={{ padding: space.base, gap: space.md }}>
            <T variant="label" tone="muted">{currentIntent}</T>
            {profile.loading ? (
              <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" style={{ flexDirection: 'row', gap: space.md }}>
                <ActivityIndicator color={palette.ink} />
                <T variant="body" tone="muted">Učitavamo profil…</T>
              </View>
            ) : profile.error ? (
              <View style={{ gap: space.sm }}>
                <T variant="body">Profil trenutno nije dostupan.</T>
                <T variant="meta" tone="muted">Proverite vezu i pokušajte ponovo.</T>
                <Button label="Pokušajte ponovo" kind="secondary" onPress={() => { void profile.refresh(); }} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: palette.forest800,
                  alignItems: 'center', justifyContent: 'center' }}>
                  {initials ? <T variant="heading" tone="onDark">{initials}</T> : <User size={28} color={palette.onDark} />}
                </View>
                <View style={{ flex: 1, gap: space.xs }}>
                  <T variant="heading">{profile.data?.ime ?? 'Ime još nije uneto'}</T>
                  <T variant="meta" tone="muted">{profile.data?.grad ?? 'Grad još nije unet'}</T>
                </View>
              </View>
            )}
          </View>
        </Card>

        {!narucilac && <Card>
          <Press accessibilityRole="button" accessibilityLabel="Uredite Radni profil" disabled={busy}
            accessibilityState={{ disabled: busy }} haptic="select"
            onPress={() => navigate(() => router.navigate('/profil/radnik'))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.base, minHeight: touch.min }}>
            <User size={22} color={palette.teal500} />
            <View style={{ flex: 1, gap: space.xs }}>
              <T variant="bodyStrong">Uredite Radni profil</T>
              <T variant="meta" tone="muted">Ime, grad i veštine za prijavljivanje na Zadatke.</T>
            </View>
            <CaretRight size={18} color={palette.inkMuted} />
          </Press>
        </Card>}

        <Press accessibilityRole="button" accessibilityLabel={`Pređite na ${nextIntent}`} disabled={busy}
          accessibilityState={{ disabled: busy }} haptic="medium" scaleTo={0.985}
          onPress={() => navigate(() => {
            postaviUlogu(narucilac ? 'uskocer' : 'narucilac');
            router.replace(narucilac ? '/prilike' : '/potrebe');
          })}>
          <Card style={{ borderColor: palette.orange }}>
            <View style={{ padding: space.base, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: palette.orangeSoft,
                alignItems: 'center', justifyContent: 'center' }}>
                <ArrowsLeftRight size={20} color={palette.orangeInk} weight="bold" />
              </View>
              <View style={{ flex: 1, gap: space.xs }}>
                <T variant="bodyStrong">Pređite na {nextIntent}</T>
                <T variant="meta" tone="muted">Isti nalog možete koristiti na oba načina.</T>
              </View>
              <CaretRight size={18} color={palette.orangeInk} />
            </View>
          </Card>
        </Press>

        <View style={{ gap: space.sm, paddingTop: space.sm }}>
          {logoutError && <T variant="body" tone="danger" accessibilityRole="alert">Odjava nije potvrđena. Pokušajte ponovo.</T>}
          <Button label={busy ? 'Sačekajte…' : 'Odjavite se'} kind="quiet" disabled={busy}
            icon={<SignOut size={20} color={palette.inkMuted} />} onPress={() => { void logout(); }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
