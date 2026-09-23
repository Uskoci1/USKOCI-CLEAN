import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { safetyClientService } from '../../data/safetyClientService';
import type { SafetyEntry } from '../system/PublicProfileSheet';

/**
 * PKG-047 (F05). A profile is one of the faces a person can show; report and block follow the person.
 * A screen that knows only a profile therefore asks the server for the safety target first, and says
 * plainly when there is none instead of opening a screen that cannot act. The context it carries is the
 * Zadatak or Dogovor the two people actually met in, which the report itself validates again.
 */
export function useSafetyEntry(profileId: string | null | undefined,
  context?: { needId?: string | null; agreementId?: string | null }): SafetyEntry | undefined {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const needId = context?.needId ?? null, agreementId = context?.agreementId ?? null;
  const onPress = useCallback(() => {
    if (!profileId || pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const settle = () => { pending.current = false; setBusy(false); };
    void safetyClientService.readTarget(profileId).then(result => {
      settle();
      if (!result.ok) { setError(result.poruka); return; }
      const target = result.podatak.available ? result.podatak.target : null;
      if (!target) { setError('Korisnik trenutno nije dostupan.'); return; }
      router.navigate({ pathname: '/bezbednost', params: { targetAccountId: target.targetAccountId,
        ...(needId ? { needId } : {}), ...(agreementId ? { agreementId } : {}) } });
    }, () => { settle(); setError('Nismo uspeli da otvorimo bezbednost. Pokušaj ponovo.'); });
  }, [profileId, needId, agreementId]);
  return profileId ? { onPress, busy, error } : undefined;
}
