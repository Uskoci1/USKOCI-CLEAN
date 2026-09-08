import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { T } from '../../../ui/Text';
import { Press } from '../../../ui/Press';
import { Button } from '../../../ui/Button';
import { palette, space, touch } from '../../../theme/tokens';
import { useIzvor, useUloga, ulogaSada } from '../../../store/uloga';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import type { PrilikaDetaljiProjekcija } from '../../../contracts/publicTaskDetail';
import { PublicTaskMaterial } from '../../../ui/task/PublicTaskMaterial';

type ActionScope = { id: string | null; accountId: string | undefined; epoch: number; intent: ReturnType<typeof useUloga>; busy: boolean; refreshing: boolean };

export default function PrilikaDetaljiEkran() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = typeof params.id === 'string' && params.id.trim() ? params.id : null;
  const router = useRouter();
  const izvor = useIzvor();
  const intent = useUloga();
  const { user, sessionEpoch: epoch } = useSesija();
  const accountId = user?.id;
  const readRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++readRequest.current;
    const prilika = id ? await izvor.detaljiPrilike(id) : null;
    if (sesijaSada().sessionEpoch !== epoch || sesijaSada().user?.id !== accountId) throw new Error('STALE_TASK_READ');
    return { prilika, request };
  }, [id, izvor, accountId, epoch]);
  const resource = useFocusedResource(load);
  // The cache is display-only and cannot survive a task, account, session or intent change.
  const cache = useMemo(() => ({ data: null as PrilikaDetaljiProjekcija | null }), [load, intent]);
  const fresh = resource.data?.prilika?.id === id ? resource.data.prilika : null;
  const deadlineAt = fresh?.rokZaPrijaveIso === null ? null
    : typeof fresh?.rokZaPrijaveIso === 'string' ? Date.parse(fresh.rokZaPrijaveIso) : undefined;
  const [deadlineTick, setDeadlineTick] = useState(0);
  const deadlineOpen = () => deadlineAt === null || (typeof deadlineAt === 'number' && deadlineAt > Date.now());
  useFocusEffect(useCallback(() => {
    if (typeof deadlineAt !== 'number' || !Number.isFinite(deadlineAt)) return;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) return;
    // Long deadlines are rechecked before scheduling another bounded timer.
    const timer = setTimeout(() => setDeadlineTick(tick => tick + 1), Math.min(remaining, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [deadlineAt, deadlineTick]));
  useEffect(() => {
    if (!resource.loading && !resource.error) cache.data = fresh;
  }, [cache, fresh, resource.loading, resource.error]);
  const prilika = fresh ?? ((resource.loading || resource.error) ? cache.data : null);
  const scopeRef = useRef<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope = { id, accountId, epoch, intent, busy: false, refreshing: false };
    scopeRef.current = scope;
    setBusy(false);
    return () => { if (scopeRef.current === scope) scopeRef.current = null; };
  }, [id, accountId, epoch, intent]));

  function currentScope() {
    const scope = scopeRef.current;
    const session = sesijaSada();
    if (!scope || scope.id !== id || scope.accountId !== accountId || scope.epoch !== epoch || scope.intent !== intent
      || !accountId || session.user?.id !== accountId || session.sessionEpoch !== epoch || ulogaSada() !== intent) return null;
    return scope;
  }

  function navigate(action: () => void) {
    const scope = currentScope();
    if (!scope || scope.busy) return;
    scope.busy = true;
    setBusy(true);
    action();
  }

  function retry() {
    const scope = currentScope();
    if (!scope || scope.busy || scope.refreshing) return;
    scope.refreshing = true;
    void resource.refresh().finally(() => { if (scopeRef.current === scope) scope.refreshing = false; });
  }

  function compose() {
    // A saved press from before refresh/blur/id/account change cannot navigate.
    if (!fresh || resource.loading || resource.error || resource.data?.request !== readRequest.current
      || fresh.primaNovePrijave !== true || !deadlineOpen() || intent !== 'uskocer') return;
    navigate(() => router.navigate({ pathname: '/prilike/[id]/prijava', params: { id: fresh.id } }));
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ paddingHorizontal: space.base, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad na Zadatke" disabled={busy}
          accessibilityState={{ disabled: busy }}
          onPress={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/prilike'))}
          style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={24} color={palette.ink} />
        </Press>
        <T variant="title">Zadatak</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl, gap: space.base, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
          {id && resource.loading ? <>
            <ActivityIndicator color={palette.forest700} accessibilityLabel="Učitavamo zadatak" />
            <T variant="body" tone="muted">Učitavamo zadatak…</T>
          </> : resource.error ? <>
            <T variant="heading">Zadatak trenutno nije moguće učitati.</T>
            <T variant="body" tone="muted">Proverite internet vezu i pokušajte ponovo.</T>
            <Button label="Pokušajte ponovo" onPress={retry} disabled={busy} />
          </> : !fresh ? <>
            <T variant="heading">Zadatak nije dostupan.</T>
            <T variant="body" tone="muted">Možda je zatvoren ili više nije dostupan vašem nalogu. Vratite se na Zadatke.</T>
            {id && <Button label="Pokušajte ponovo" kind="secondary" onPress={retry} disabled={busy} />}
          </> : null}
          {prilika && (resource.loading || resource.error) && <T variant="meta" tone="muted">Poslednji učitani podaci. Osvežite zadatak pre nastavka.</T>}
        </View>
        {prilika && <PublicTaskMaterial task={prilika} />}
      </ScrollView>
      {fresh && !resource.loading && !resource.error && <View style={{ padding: space.base, borderTopWidth: 1, borderTopColor: palette.line100, gap: space.sm }}>
        {fresh.primaNovePrijave === true && deadlineOpen() ? intent === 'uskocer'
          ? <Button label="Sastavi prijavu" full disabled={busy} onPress={compose} />
          : <><T variant="body" tone="muted">Za slanje prijave uključite režim JA MOGU u svom profilu.</T>
            <Button label="Otvorite profil" kind="secondary" full disabled={busy} onPress={() => navigate(() => router.navigate('/profil'))} /></>
          : <T variant="body" tone="muted">Nove prijave trenutno nisu dostupne za ovaj zadatak.</T>}
      </View>}
    </SafeAreaView>
  );
}
