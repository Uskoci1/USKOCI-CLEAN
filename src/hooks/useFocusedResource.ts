import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createFocusedResource } from '../data/focusedResource';
import { sesijaSada, useSesija } from '../store/sesija';
import { ulogaSada, useUloga } from '../store/uloga';

export function useFocusedResource<T>(load: () => Promise<T>) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const intent = useUloga();
  const model = useMemo(() => createFocusedResource(load,
    () => !!accountId && sesijaSada().user?.id === accountId &&
      sesijaSada().accountRevision === accountRevision && ulogaSada() === intent),
  [load, accountId, accountRevision, intent]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot);
  useFocusEffect(useCallback(() => {
    // Preserve startup behavior when RN has not reported an initial state yet,
    // but never start a known-background read. Every pause retires its generation.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') model.start();
    const subscription = AppState.addEventListener('change', value => {
      if (value === 'active') model.start();
      else model.stop();
    });
    return () => { subscription.remove(); model.stop(); };
  }, [model]));
  return { ...state, refresh: model.refresh };
}
