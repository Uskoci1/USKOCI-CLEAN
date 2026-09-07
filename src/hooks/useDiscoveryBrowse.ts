import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createDiscoveryBrowse } from '../data/discoveryBrowse';
import { sesijaSada, useSesija } from '../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../store/uloga';

export function useDiscoveryBrowse() {
  const source = useIzvor(), intent = useUloga();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const model = useMemo(() => createDiscoveryBrowse(query => source.otvorenePrilikeStrana(query),
    () => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent),
  [source, accountId, accountRevision, intent]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot);
  useFocusEffect(useCallback(() => {
    model.start();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void model.refresh(); });
    return () => { subscription.remove(); model.stop(); };
  }, [model]));
  return { ...state, refresh: model.refresh, loadMore: model.loadMore, scope: `${accountId ?? 'guest'}:${accountRevision}:${intent}` };
}
