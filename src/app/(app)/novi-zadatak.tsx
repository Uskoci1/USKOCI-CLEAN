import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiNeedV2Izvor } from '../../data';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';
import { v2 } from '../../ui/v2/tokens';

/** One product entry, two input methods, one existing NEED_FACT_V2 domain.
 * AI remains the primary V5 experience. Manual only opens the same owned V2
 * conversation and never dispatches a provider turn. */
export default function NoviZadatak() {
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  const accountId = user?.id;
  const [openRequestId] = useState(noviUuidZahtevId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focus = useRef<object | null>(null);
  const navigating = useRef(false);

  useFocusEffect(useCallback(() => {
    const scope = {};
    focus.current = scope;
    navigating.current = false;
    setBusy(false);
    setError(null);
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision, intent]));

  const current = (scope: object | null) => scope !== null && focus.current === scope && !!accountId
    && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision
    && ulogaSada() === intent;
  const navigate = (action: () => void) => {
    const scope = focus.current;
    if (!current(scope) || navigating.current) return;
    navigating.current = true;
    action();
  };

  const openAi = () => {
    if (busy || intent !== 'narucilac') return;
    navigate(() => router.replace('/nova'));
  };

  const openManual = async () => {
    const scope = focus.current;
    if (!current(scope) || busy || navigating.current || intent !== 'narucilac') return;
    setBusy(true);
    setError(null);
    const result = await aiNeedV2Izvor.openConversation(openRequestId);
    if (!current(scope)) return;
    setBusy(false);
    if (!result.ok) {
      setError(result.poruka);
      return;
    }
    if (navigating.current) return;
    navigating.current = true;
    router.replace({ pathname: '/rucni-zadatak', params: { conversationId: result.podatak.conversationId } });
  };

  const back = () => navigate(() => router.canGoBack() ? router.back() : router.replace('/potrebe'));
  const requester = intent === 'narucilac';

  return <SafeAreaView style={s.canvas}>
    <View style={s.content}>
      <View style={s.copy}>
        <T accessibilityRole="header" style={s.title}>Novi zadatak</T>
        <T style={s.body}>Izaberi kako želiš da uneseš podatke. Oba načina završavaju u istom pregledu zadatka pre objave.</T>
      </View>

      {!requester ? <T accessibilityRole="alert" style={s.error}>Novi zadatak je dostupan u režimu MENI TREBA.</T> : null}
      {error ? <T accessibilityRole="alert" style={s.error}>{error}</T> : null}

      <View style={s.card}>
        <T style={s.cardTitle}>Razgovorom</T>
        <T style={s.body}>Preporučeno. Opiši šta ti treba, a AI pomaže da se podaci slože. Objavu i dalje potvrđuješ tek posle pregleda.</T>
        <V2Action label="Nastavi razgovorom" kind="primary" disabled={!requester || busy} onPress={openAi} />
      </View>

      <View style={s.card}>
        <T style={s.cardTitle}>Ručno</T>
        <T style={s.body}>Unesi podatke samostalno, bez AI provajdera. Koristi se isti V2 nacrt, ista lokacija, fotografije i isti završni pregled.</T>
        <V2Action label={busy ? 'Otvaramo ručni unos…' : 'Unesi ručno'} kind="quiet" disabled={!requester || busy}
          onPress={() => { void openManual(); }} />
      </View>

      <V2Action label="Nazad" kind="quiet" disabled={busy} onPress={back} />
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: v2.color.canvas },
  content: { flex: 1, justifyContent: 'center', padding: v2.space.xl, gap: v2.space.lg },
  copy: { gap: v2.space.sm },
  title: { ...v2.text.hero, color: v2.color.ink },
  cardTitle: { ...v2.text.title, color: v2.color.ink },
  body: { ...v2.text.body, color: v2.color.muted },
  error: { ...v2.text.label, color: '#A4362B' },
  card: { gap: v2.space.md, padding: v2.space.lg, backgroundColor: v2.color.surface,
    borderWidth: 1, borderColor: v2.color.line, borderRadius: v2.radius.card },
});
