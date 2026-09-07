import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { InboxRole } from '../contracts/inbox';
import { createInboxModel } from '../data/inboxModel';
import { inboxClientService } from '../data/inboxClientService';
import { sesijaSada, useSesija } from '../store/sesija';

export function useInbox(role: InboxRole | null) {
  const {user} = useSesija();
  const accountId = user?.id;
  const model = useMemo(() => createInboxModel(inboxClientService,role,
    () => !!accountId && sesijaSada().user?.id===accountId),[accountId,role]);
  const state = useSyncExternalStore(model.subscribe,model.snapshot,model.snapshot);
  useFocusEffect(useCallback(() => {
    model.start();
    const sub = AppState.addEventListener('change', value => {
      if (value==='active') void model.refresh();
    });
    return () => {sub.remove(); model.stop();};
  },[model]));
  return {state,model};
}
