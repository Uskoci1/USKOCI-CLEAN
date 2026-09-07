import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAgreementOutbox } from '../data/agreementOutbox';
import { agreementMessageClientService } from '../data/agreementMessageClientService';
import { noviZahtevId } from '../lib/idempotencija';
import { sesijaSada, useSesija } from '../store/sesija';
import { ulogaSada, useUloga } from '../store/uloga';

export function useAgreementOutbox(accountId: string, agreementId: string, canSendNew: boolean) {
  const intent = useUloga();
  const accountRevision = useSesija().accountRevision;
  const writable = useRef(canSendNew);
  writable.current = canSendNew;
  const model = useMemo(() => createAgreementOutbox({
    accountId, agreementId, storage: AsyncStorage, messagePort: agreementMessageClientService,
    newId: () => noviZahtevId('poruka'),
    isCurrent: () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent,
    canSendNew: () => writable.current,
  }), [accountId, agreementId, intent, accountRevision]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useFocusEffect(useCallback(() => {
    void model.start();
    return () => model.stop();
  }, [model]));
  return { model, state };
}
