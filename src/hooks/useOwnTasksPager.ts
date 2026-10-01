import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { OwnTasksScope } from '../data/ownTasksPage';
import { createOwnTasksPager, type OwnTasksPageReader } from '../data/ownTasksPager';
import { sesijaSada, useSesija } from '../store/sesija';

/**
 * Moji zadaci, paged (EX-04 S1): the lifecycle of `useFocusedResource` for a set that is read a page at a time. Focus starts it, blur retires its reads,
 * the app leaving the foreground forgets it, and a different account is a different pager that starts empty. The scope and the "read the whole set"
 * flag are inputs; everything a page may or may not do is `createOwnTasksPager`'s.
 */
export function useOwnTasksPager(readPage: OwnTasksPageReader, scope: OwnTasksScope | null, complete: boolean) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const pager = useMemo(() => createOwnTasksPager({ readPage,
    isCurrent: () => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision }),
  [readPage, accountId, accountRevision]);
  const state = useSyncExternalStore(pager.subscribe, pager.snapshot, pager.snapshot);
  useEffect(() => { pager.setScope(scope); }, [pager, scope]);
  useEffect(() => { pager.ensureComplete(complete); }, [pager, complete]);
  useFocusEffect(useCallback(() => {
    // Never start a known-background read; every pause retires its epoch.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') pager.start();
    const subscription = AppState.addEventListener('change', value => {
      // Leaving the app is not leaving the screen: the recents switcher photographs what is on it, so that one forgets.
      if (value === 'active') pager.start();
      else pager.forget();
    });
    return () => { subscription.remove(); pager.stop(); };
  }, [pager]));
  return { ...state, loadMore: pager.loadMore, refresh: pager.refresh };
}
