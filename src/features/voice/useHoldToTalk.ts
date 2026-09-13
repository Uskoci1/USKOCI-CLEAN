import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../../store/sesija';
import { supabaseKlijent, supabaseKonfigurisan } from '../../data/supabaseClient';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { HoldToTalkController, type HoldToTalkOptions } from './holdToTalk';
import { createNativeSpeechAdapter } from './nativeSpeechAdapter';
import { SPEECH_LIMITS } from './speechProtocol';

export const VOICE_PROCESSING_NOTICE = 'Zvuk se prolazno šalje Google servisu radi transkripcije. USKOČI ne čuva audio snimke. Završni tekst najpre vidiš u polju za poruku i možeš ga izmeniti; u razgovor odlazi tek kada izabereš Pošalji. Google može privremeno obrađivati podatke globalno radi bezbednosti plaćenog servisa.';

export function useHoldToTalk(options: {
  conversationId: string | null;
  onTranscript: HoldToTalkOptions['onTranscript'];
  isAiSpeaking?: () => boolean;
}) {
  const { user, accountRevision } = useSesija();
  const latest = useRef(options); latest.current = options;
  const focused = useRef(false);
  const controller = useMemo(() => new HoldToTalkController({
    adapter: createNativeSpeechAdapter({ newOperationId: noviUuidZahtevId,
      async getConnection(session, signal) {
        const current = sesijaSada();
        if (signal.aborted || current.user?.id !== session.accountId || current.accountRevision !== session.accountRevision
          || latest.current.conversationId !== session.conversationId || !current.session?.access_token) return null;
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        return url && anonKey ? { url, anonKey, accessToken: current.session.access_token } : null;
      } }),
    getScope: () => {
      const current = sesijaSada(), conversationId = latest.current.conversationId;
      return focused.current && current.user?.id && conversationId
        ? { accountId: current.user.id, accountRevision: current.accountRevision, conversationId } : null;
    },
    isAiSpeaking: () => latest.current.isAiSpeaking?.() ?? false,
    onTranscript: input => latest.current.onTranscript(input),
    limits: { permissionMs: 30000, captureMs: SPEECH_LIMITS.captureMs, finalizationMs: SPEECH_LIMITS.finalizationMs },
  }), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.contextChanged(); }, [controller, user?.id, accountRevision, options.conversationId]);
  useFocusEffect(useCallback(() => {
    focused.current = true; controller.setForeground(AppState.currentState === 'active');
    return () => { focused.current = false; controller.cancel('navigation'); };
  }, [controller]));
  useEffect(() => {
    const app = AppState.addEventListener('change', next => controller.setForeground(next === 'active'));
    // Auth callbacks fence native input immediately; no need to wait for the next React render.
    const auth = supabaseKonfigurisan() ? supabaseKlijent().auth.onAuthStateChange(() => controller.contextChanged()) : null;
    return () => { app.remove(); auth?.data.subscription.unsubscribe(); controller.cancel('dispose'); };
  }, [controller]);
  return { controller, state };
}
