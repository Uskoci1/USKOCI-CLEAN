import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiNeedV2Izvor } from '../../data';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import { Press } from '../../ui/Press';
import { sys } from '../../ui/system/tokens';
import { T } from '../../ui/Text';
import { V2Action } from '../../ui/v2/V2Action';
import { V2Icon } from '../../ui/v2/icons';

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

  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <View style={s.topBar}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" haptic="select" disabled={busy} onPress={back} style={s.back}><V2Icon name="back" /></Press>
      <View style={s.topCopy}><T variant="meta" style={s.eyebrow}>Meni treba</T><T accessibilityRole="header" variant="title" style={s.ink}>Novi zadatak</T></View>
    </View>
    <View style={s.content}>
      <T variant="body" tone="muted">Izaberi kako želiš da uneseš podatke. Oba načina završavaju u istom pregledu zadatka pre objave.</T>

      {!requester ? <View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>Novi zadatak je dostupan u režimu MENI TREBA.</T></View> : null}
      {error ? <View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{error}</T></View> : null}

      <View style={[s.card, s.recommended]}>
        <T variant="meta" style={s.eyebrow}>Preporučeno</T>
        <T variant="title" style={s.ink}>Razgovorom</T>
        <T variant="body" tone="muted">Opiši šta ti treba, a AI pomaže da se podaci slože. Objavu i dalje potvrđuješ tek posle pregleda.</T>
        <V2Action label="Nastavi razgovorom" kind="primary" disabled={!requester || busy} onPress={openAi} />
      </View>

      <View style={s.card}>
        <T variant="title" style={s.ink}>Ručno</T>
        <T variant="body" tone="muted">Unesi podatke samostalno, bez AI provajdera. Koristi se isti V2 nacrt, ista lokacija, fotografije i isti završni pregled.</T>
        <V2Action label={busy ? 'Otvaramo ručni unos…' : 'Unesi ručno'} kind="quiet" disabled={!requester || busy}
          onPress={() => { void openManual(); }} style={s.quietLeft} />
      </View>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.ground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topCopy: { flex: 1, minWidth: 0, gap: 1 }, eyebrow: { color: sys.color.green, fontWeight: '600' }, ink: { color: sys.color.ink },
  content: { flex: 1, padding: 20, paddingTop: 8, gap: 14 },
  card: { gap: 10, padding: 18, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card },
  recommended: { borderColor: sys.color.green },
  notice: { padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.warnSoft },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
