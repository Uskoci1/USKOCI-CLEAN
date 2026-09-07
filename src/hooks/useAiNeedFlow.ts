import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { aiNeedV2Izvor } from '../data';
import { createAiNeedFlow } from '../data/aiNeedFlow';
import { noviZahtevId } from '../lib/idempotencija';
import { sesijaSada, useSesija } from '../store/sesija';
import { ulogaSada, useUloga } from '../store/uloga';

export function useAiNeedFlow(conversationId?: string) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id ?? '';
  const intent = useUloga();
  const model = useMemo(() => createAiNeedFlow({ accountId, conversationId, port: aiNeedV2Izvor,
    newId: () => noviZahtevId('ai-draft'),
    isCurrent: () => !!accountId && sesijaSada().user?.id === accountId &&
      sesijaSada().accountRevision === accountRevision && ulogaSada() === intent,
  }), [accountId, accountRevision, conversationId, intent]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot);
  useFocusEffect(useCallback(() => {
    void model.start();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void model.refresh(); });
    return () => { subscription.remove(); model.stop(); };
  }, [model]));
  return { model, state };
}
