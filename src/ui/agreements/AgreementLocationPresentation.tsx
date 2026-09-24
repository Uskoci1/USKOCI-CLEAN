import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowClockwise } from 'phosphor-react-native';
import { vreme } from '../../lib/vreme';
import { ResolvedPinMap } from '../location/ResolvedPinMap';
import { T } from '../Text';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { SuccessMark } from '../system/SuccessMark';
import { brandAction, inset, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import type { LocationState } from './AgreementLocationController';

function Fact({ art, title, body }: { art: FactArtKind; title: string; body?: string }) {
  return <View style={s.fact} accessible accessibilityLabel={body ? `${title}. ${body}` : title}>
    <FactArt kind={art} size={24} />
    <View style={s.factCopy}><T variant="bodyStrong">{title}</T>{body ? <T variant="meta" tone="muted">{body}</T> : null}</View>
  </View>;
}

export type AgreementLocationPresentationProps = {
  state: LocationState; accountId: string; agreementId: string;
  onBack: () => void; onRefresh: () => void; onShare: () => void; onRequest: () => void; onStopCapture: () => void;
  onCancelUnknown: () => void; onAcknowledge: () => void;
};

/**
 * Sharing one current point in a Dogovor (round 6): what is shared, with whom and what stays on screen, said before the
 * one action; the last point drawn still, with when it was taken and sent, and never as a live position. Presentation
 * only: the screen owns the controller, its capture, journal and fences.
 */
export function AgreementLocationPresentation({ state, accountId, agreementId, onBack, onRefresh, onShare, onRequest, onStopCapture,
  onCancelUnknown, onAcknowledge }: AgreementLocationPresentationProps) {
  const context = state.context, point = context?.point, ready = state.phase === 'READY';
  const worker = context?.role === 'WORKER';
  const closed = ready && !!context && !context.canShare && !context.canRequest;
  const permission = !!state.message && state.message.includes('podešavanjima telefona');
  let body;
  if (state.phase === 'LOADING') body = <StateView kind="loading" title="Proveravamo Dogovor…" skeleton={{ count: 1, rows: 3 }} />;
  else if (state.phase === 'ERROR') body = <StateView kind="error" art="pin" title="Lokacija nije učitana" body={state.message ?? undefined}
    primary={{ label: 'Pokušaj ponovo', onPress: onRefresh }} />;
  else body = <>
    {/* The consent sentence leads: one point, shared by choice, never tracking. */}
    <T variant="copy">Jedna tačka, podeljena dobrovoljno u ovom Dogovoru. Prikaz se ne pomera i ne prati putovanje.</T>
    {context && !closed ? <View style={s.facts}>
      <Fact art="pin" title="Jedna tačka, ne praćenje" body={worker ? 'Telefon uzima lokaciju samo kada pritisneš dugme.'
        : 'Druga strana sama bira da li će podeliti tačku.'} />
      <Fact art="users" title="Vide je samo učesnici ovog Dogovora" />
      <Fact art="clock" title="Prikazuje se samo poslednja podeljena tačka" />
    </View> : null}
    {permission ? <PermissionRecovery message={state.message!} />
      : state.message && state.phase !== 'UNKNOWN' && state.phase !== 'CONFIRMED'
        ? <T variant="copy" accessibilityLiveRegion="polite">{state.message}</T> : null}
    {ready && context?.requestedAt ? <View style={s.requested}><View style={s.dot} />
      <T variant="copy" style={s.requestedText}>Lokacija je zatražena: {vreme(context.requestedAt)}. Deljenje je opciono.</T></View> : null}
    {point && (ready || state.phase === 'CAPTURING' || state.phase === 'SENDING') ? <View style={s.section}>
      <T variant="heading" accessibilityRole="header">Poslednja podeljena tačka</T>
      <ResolvedPinMap position={{ latitude: point.latitude, longitude: point.longitude }} onChoose={() => {}} disabled
        scopeKey={`${accountId}:${agreementId}:${point.sharedAt}`} />
      <T variant="note">Zabeležena: {vreme(point.capturedAt)}</T>
      <T variant="note">Poslata: {vreme(point.sharedAt)}</T>
      <T variant="note" tone="muted">Preciznost oko {Math.ceil(point.accuracyMeters)} m.</T>
      <T variant="copy" style={s.warn}>Ovo je ranije zabeležena tačka. Ne potvrđuje sadašnji položaj.</T>
    </View> : null}
    {state.phase === 'CAPTURING' ? <View style={s.working} accessibilityLiveRegion="polite">
      <View style={s.workingLine}><ActivityIndicator color={sys.color.green} /><T variant="copy" style={s.flex}>Uzimam jednu novu lokaciju telefona…</T></View>
      <V2Action label="Prekini deljenje" kind="quiet" onPress={onStopCapture} />
    </View> : null}
    {state.phase === 'SENDING' ? <View style={s.workingLine} accessibilityLiveRegion="polite">
      <ActivityIndicator color={sys.color.green} /><T variant="copy" style={s.flex}>Čekamo potvrdu…</T></View> : null}
    {ready && context?.canShare ? <View style={s.section}>
      <T variant="copy" tone="muted">Dugme uzima novu lokaciju uz dozvolu telefona i šalje je drugoj strani ovog Dogovora. Možeš nastaviti Dogovor i bez deljenja.</T>
      <V2Action label="Podeli jednu trenutnu lokaciju" style={brandAction} onPress={onShare} />
    </View> : null}
    {ready && context?.canRequest ? <V2Action label="Zatraži trenutnu lokaciju" style={brandAction} onPress={onRequest} /> : null}
    {closed ? <StateView kind="empty" art="lock" title="Deljenje nije dostupno"
      body="Deljenje je dostupno samo učesnicima aktivnog fizičkog Dogovora kada važe dozvole za kontakt." /> : null}
    {state.phase === 'UNKNOWN' ? <View style={s.section}>
      <View style={s.notice} accessibilityLiveRegion="polite"><T variant="bodyStrong">Ishod zahteva još nije potvrđen</T>
        {state.message ? <T variant="copy">{state.message}</T> : null}
        <T variant="copy" tone="muted">Ako je zahtev već prihvaćen, prikazaće se ta potvrda. Prekid čekanja ne povlači već podeljenu tačku.</T></View>
      <V2Action label="Proveri prvobitni zahtev" style={brandAction} onPress={onRefresh} />
      <V2Action label="Zaustavi zahtev ako još nije poslat" kind="quiet" onPress={onCancelUnknown} />
    </View> : null}
    {state.phase === 'CONFIRMED' ? <View style={s.done}>
      <SuccessMark fresh />
      <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">{state.message ?? ''}</T>
      <V2Action label="Prikaži stanje lokacije" style={brandAction} onPress={onAcknowledge} />
    </View> : null}
  </>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" title="Trenutna lokacija" onBack={onBack}
      right={ready ? <ChromeIconButton label="Osveži prikaz" icon={ArrowClockwise} onPress={onRefresh} /> : undefined} />
    <ScrollView contentContainerStyle={s.content}>{body}</ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm, paddingBottom: sys.space.xxl, gap: sys.space.lg },
  section: { gap: sys.space.md },
  facts: { gap: sys.space.md },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  factCopy: { flex: 1, gap: 2 },
  // A request waiting for the worker is the screen's one orange: a dot, not a fill.
  requested: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange, marginTop: 7 },
  requestedText: { flex: 1 },
  warn: { color: sys.color.warn },
  working: { gap: sys.space.sm },
  workingLine: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  flex: { flex: 1 },
  notice: { ...inset, gap: sys.space.sm, backgroundColor: sys.color.warnSoft },
  done: { gap: sys.space.base, alignItems: 'flex-start', paddingTop: sys.space.base },
});
