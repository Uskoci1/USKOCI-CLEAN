import { useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { subscribeAgreementIncomingRefresh } from '../data/agreementIncomingRefresh';
import { sesijaSada, useSesija } from '../store/sesija';
import { publicInboxNotificationId } from '../ui/notifications/publicInboxCopy';

/** Foreground incoming hints complement the focused resource's existing focus /
 * foreground re-read. No permission prompt, registration, polling or read receipt.
 */
export function useAgreementIncomingRefresh({ accountId, accountRevision, agreementId, enabled, source, refresh }: {
  accountId: string; accountRevision: number; agreementId: string; enabled: boolean;
  source: object; refresh: () => Promise<void>;
}): void {
  const { sessionEpoch } = useSesija();
  const rendered = useRef({ accountId, accountRevision, agreementId, enabled, source, refresh, sessionEpoch });
  rendered.current = { accountId, accountRevision, agreementId, enabled, source, refresh, sessionEpoch };
  useFocusEffect(useCallback(() => {
    if (!enabled || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    let alive = true, foreground = AppState.currentState === 'active';
    let stopIncoming: (() => void) | undefined;
    const current = () => {
      const owner = rendered.current, session = sesijaSada();
      return alive && foreground && AppState.currentState === 'active' && owner.enabled
        && owner.accountId === accountId && owner.accountRevision === accountRevision && owner.agreementId === agreementId
        && owner.source === source && owner.refresh === refresh && owner.sessionEpoch === sessionEpoch
        && session.user?.id === accountId && session.accountRevision === accountRevision && session.sessionEpoch === sessionEpoch;
    };
    const listen = () => {
      stopIncoming?.(); stopIncoming = undefined;
      if (!current()) return;
      stopIncoming = subscribeAgreementIncomingRefresh({
        load: () => import('expo-notifications'), identifier: publicInboxNotificationId, refresh, isCurrent: current,
      });
    };
    const app = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) listen();
      else { stopIncoming?.(); stopIncoming = undefined; }
    });
    listen();
    return () => { alive = false; stopIncoming?.(); app.remove(); };
  }, [accountId, accountRevision, agreementId, enabled, source, refresh, sessionEpoch]));
}
