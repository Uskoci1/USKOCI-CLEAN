import { useCallback, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useDiscoveryWorkArea } from '../../../hooks/useDiscoveryWorkArea';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../../../data/marketplaceView';
import type { TaskRelation } from '../../../data/taskRelation';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { izvorSada, useIzvor } from '../../../store/uloga';
import { StateView } from '../../system/StateView';
import { DiscoveryV1NativeProofScreen } from './DiscoveryV1NativeProofScreen';

/**
 * The proof build uses the real Zadaci route and real presentation components, but a separate fail-closed
 * owner makes it impossible for an ordinary build/deep-link to switch readers.
 */
export function DiscoveryV1NativeProofRoute() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }));

  useFocusEffect(useCallback(() => {
    let owner: object | null = null;
    const enter = () => {
      if (owner) return;
      owner = {};
      focus.current = owner;
      navigating.current = false;
      setScope(owner);
    };
    const leave = () => {
      if (!owner) return;
      if (focus.current === owner) focus.current = null;
      owner = null;
      setScope(null);
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') enter();
    const subscription = AppState.addEventListener('change', state =>
      state === 'active' ? enter() : leave());
    return () => { subscription.remove(); leave(); };
  }, []));

  const workArea = useDiscoveryWorkArea({
    accountId: user?.id ?? null,
    accountRevision,
    source,
    focus: scope,
    focusRef: focus,
    view,
    publication: false,
  });

  const current = useCallback(() => !!scope && focus.current === scope && !!user?.id
    && sesijaSada().user?.id === user.id && sesijaSada().accountRevision === accountRevision
    && izvorSada() === source && AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  [scope, user?.id, accountRevision, source]);

  const navigate = useCallback((action: () => void) => {
    if (!current() || navigating.current) return;
    workArea.retire();
    navigating.current = true;
    action();
  }, [current, workArea]);

  const open = useCallback((item: MarketplaceItem, relation: TaskRelation) => {
    navigate(() => router.navigate({
      pathname: relation.kind === 'OWNER' ? '/potrebe/[id]/pregled' : '/prilike/[id]',
      params: { id: item.id },
    }));
  }, [navigate]);

  if (!scope || !user?.id) return <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
    <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />
  </View>;

  return <DiscoveryV1NativeProofScreen key={`${user.id}:${accountRevision}`}
    source={source} scopeKey={`${user.id}:${accountRevision}`} initialView={view}
    initialWorkArea={workArea.target} onInitialWorkAreaHandled={workArea.handled}
    isCurrent={current} onPersistView={setView} onOpen={open}
    onProfile={() => navigate(() => router.navigate('/profil'))}
    onNotifications={() => navigate(() => router.navigate('/obavestenja'))}
    onNew={() => navigate(() => router.navigate('/nova'))} />;
}
