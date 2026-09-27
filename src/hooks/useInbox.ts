import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { InboxRole } from '../contracts/inbox';
import { createInboxModel } from '../data/inboxModel';
import { inboxClientService } from '../data/inboxClientService';
import { activityMessageTargetService } from '../data/activityMessageTargetService';
import { sesijaSada, useSesija } from '../store/sesija';

export function useInbox(role: InboxRole | null) {
  const {user, accountRevision} = useSesija();
  const accountId = user?.id;
  const model = useMemo(() => createInboxModel(inboxClientService,role,
    () => !!accountId && sesijaSada().user?.id===accountId && sesijaSada().accountRevision===accountRevision,
    async (eventId,signal) => {
      if (!accountId) throw new Error('AUTH_REQUIRED');
      const result = await activityMessageTargetService.resolve(eventId,{signal},{accountId,accountRevision});
      if (!result.ok) throw new Error(result.kod);
      const target = result.podatak;
      return target.kind === 'UNAVAILABLE' ? {kind:'UNAVAILABLE'} : {
        kind:'AGREEMENT_MESSAGE',id:target.agreementId,messageId:target.messageId,eventId:target.eventId,role:target.role,
      };
    }),[accountId,accountRevision,role]);
  const state = useSyncExternalStore(model.subscribe,model.snapshot,model.snapshot);
  useFocusEffect(useCallback(() => {
    if (!AppState.currentState || AppState.currentState==='active') model.start();
    const sub = AppState.addEventListener('change', value => {
      if (value==='active') model.start(); else model.stop();
    });
    return () => {sub.remove(); model.stop();};
  },[model]));
  return {state,model};
}
