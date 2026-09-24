import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, X } from 'phosphor-react-native';
import type { DataExportPreparation, DataExportStatus } from '../../contracts/dataExport';
import { vreme } from '../../lib/vreme';
import { SettingsAction, SettingsIntro, SettingsPanel, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { SkeletonList } from '../system/Skeleton';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { InlineNote, QuietLine } from './InlineNote';

export const exportPreparationCopy: Record<NonNullable<DataExportPreparation['code']>, string> = {
  POLICY_NOT_READY: 'Priprema kopije trenutno nije dostupna. Tvoj zahtev ostaje zabeležen.',
  BUSY: 'Kopija se priprema. Proveri stanje kasnije.',
  RETRY_REQUIRED: 'Priprema nije završena. Proveri stanje pa probaj ponovo.',
  NOT_AVAILABLE: 'Ova kopija trenutno nije dostupna. Proveri stanje zahteva.',
};

/** A file size as a person reads it, never in bytes (forensic analysis: no technical text): "12 KB", "1,4 MB". */
export const exportSizeLabel = (count: number) => count < 1024 ? 'manje od 1 KB' : count < 1024 * 1024 ? `${Math.round(count / 1024)} KB`
  : `${(count / (1024 * 1024)).toLocaleString('sr-Latn-RS', { maximumFractionDigits: 1 })} MB`;

/**
 * Where the person's copy is, as one of eight phases. Every request status maps to exactly one, so the steps can never
 * say "not requested" beside a request that exists, draw a cancelled request as the active step, or draw a failure as a
 * step still to come (round 5: the old step copy did all three).
 *
 * READY splits by what the server verified: a copy that can be saved now, one that was never verified (an old READY
 * receipt), and one whose availability has run out (`artifact && expires <= now`, even before the status says so).
 */
export type ExportPhase = 'NONE' | 'REQUESTED' | 'PROCESSING' | 'READY_AVAILABLE' | 'READY_UNAVAILABLE' | 'EXPIRED' | 'FAILED' | 'CANCELLED';
export function exportPhase(status: DataExportStatus | null | undefined, now: number): ExportPhase {
  const request = status?.request;
  if (!status || !request) return 'NONE';
  const artifact = status.fulfillment;
  const expires = artifact ? Date.parse(artifact.artifactExpiresAt) : NaN;
  switch (request.status) {
    case 'REQUESTED': return 'REQUESTED';
    case 'PROCESSING': return 'PROCESSING';
    case 'CANCELLED': return 'CANCELLED';
    case 'FAILED': return 'FAILED';
    case 'EXPIRED': return 'EXPIRED';
    case 'READY':
      if (artifact && expires <= now) return 'EXPIRED';
      return status.downloadAvailable === true && artifact?.artifactAvailable === true && Number.isFinite(expires) && expires > now
        ? 'READY_AVAILABLE' : 'READY_UNAVAILABLE';
    default: return 'NONE';
  }
}

type StepState = 'done' | 'current' | 'pending' | 'stopped';
type Step = { label: string; state: StepState; copy: string; meta?: string[] };
// "na redu", not "u toku": the current step is also a preparation not started yet ("Priprema još nije pokrenuta.") and a
// copy waiting to be saved, where "u toku" would state something that is not happening (round 5 review).
const spoken: Record<StepState, string> = { done: 'završeno', current: 'na redu', pending: 'sledi', stopped: 'zaustavljeno' };

/** The three steps of a phase, in the owner's words. */
export function exportSteps(phase: ExportPhase, status: DataExportStatus | null | undefined): Step[] {
  const request = status?.request, artifact = status?.fulfillment;
  const requested: Step = { label: 'Zahtev', state: 'done', copy: 'Zahtev je zabeležen na tvom nalogu.',
    meta: request ? [vreme(request.requestedAt)].filter(Boolean) : undefined };
  const waiting: Step = { label: 'Preuzimanje', state: 'pending', copy: 'Dostupno kada stvarna kopija bude spremna.' };
  const prepared: Step = { label: 'Priprema kopije', state: 'done', copy: 'Obrada je završena.' };
  switch (phase) {
    case 'REQUESTED': return [requested, { label: 'Priprema kopije', state: 'current', copy: 'Priprema još nije pokrenuta.' }, waiting];
    case 'PROCESSING': return [requested, { label: 'Priprema kopije', state: 'current', copy: 'Kopija se priprema.' }, waiting];
    case 'READY_AVAILABLE': return [requested, prepared, { label: 'Preuzimanje', state: 'current', copy: 'Kopija je dostupna. Izaberi fasciklu za čuvanje.',
      meta: artifact ? [`Dostupno do ${vreme(Date.parse(artifact.artifactExpiresAt))}.`, `Datoteka JSON · ${exportSizeLabel(artifact.byteLength)}`] : undefined }];
    // Not a step still to come: this copy cannot be saved and the footer offers a new one (round 5 review).
    case 'READY_UNAVAILABLE': return [requested, prepared, { label: 'Preuzimanje', state: 'stopped', copy: exportPreparationCopy.NOT_AVAILABLE }];
    case 'EXPIRED': return [requested, prepared, { label: 'Preuzimanje', state: 'stopped', copy: 'Dostupnost kopije je istekla.' }];
    case 'FAILED': return [requested, { label: 'Priprema kopije', state: 'stopped', copy: 'Priprema nije završena.' }, waiting];
    case 'CANCELLED': return [{ ...requested, state: 'stopped', copy: 'Zahtev je otkazan.' },
      { label: 'Priprema kopije', state: 'pending', copy: 'Priprema počinje nakon tvog zahteva.' }, waiting];
    default: return [{ label: 'Zahtev', state: 'pending', copy: 'Kopija podataka tvog naloga.' },
      { label: 'Priprema kopije', state: 'pending', copy: 'Priprema počinje nakon tvog zahteva.' }, waiting];
  }
}

/**
 * The steps of the copy as one vertical track: a 24 px marker column joined by a 2 px line, then the step's name and one
 * line of what it means now. Done is a green disc with a check, the current step a green ring with a dot, a step to come
 * a grey ring, a stopped step a grey disc with an X; the state is also spoken, never colour alone. Nothing here moves:
 * every line states a fact.
 */
export function ExportStepper({ steps }: { steps: Step[] }) {
  return <View>
    {steps.map((step, index) => {
      const last = index === steps.length - 1;
      return <View key={step.label} style={s.step} accessible
        accessibilityLabel={[`${step.label}, ${spoken[step.state]}.`, step.copy, ...(step.meta ?? [])].join(' ')}>
        <View style={s.rail}>
          <Marker state={step.state} />
          {last ? null : <View style={[s.connector, step.state === 'done' && s.connectorDone]} />}
        </View>
        <View style={[s.stepCopy, !last && s.stepGap]}>
          <T variant="bodyStrong" tone={step.state === 'pending' ? 'muted' : 'ink'}>{step.label}</T>
          <T variant="note" tone="muted">{step.copy}</T>
          {step.meta?.map(line => <T key={line} variant="note">{line}</T>)}
        </View>
      </View>;
    })}
  </View>;
}

function Marker({ state }: { state: StepState }) {
  if (state === 'done') return <View style={[s.marker, s.markerDone]}><Check size={14} weight="bold" color={sys.color.onGreen} /></View>;
  if (state === 'stopped') return <View style={[s.marker, s.markerStopped]}><X size={14} weight="bold" color={sys.color.muted} /></View>;
  if (state === 'current') return <View style={[s.marker, s.markerCurrent]}><View style={s.dot} /></View>;
  return <View style={[s.marker, s.markerPending]} />;
}

/** A notice's colour says what happened; its words are the screen's own. */
export type NoticeTone = 'success' | 'danger' | 'ink';
export function ExportNoticeLine({ text, tone }: { text: string; tone: NoticeTone }) {
  return <T variant="note" tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'ink'} accessibilityLiveRegion="polite"
    accessibilityRole={tone === 'danger' ? 'alert' : undefined}>{text}</T>;
}

/**
 * Izvoz podataka (round 5, owner step 11b): the copy's state as one card of steps, the one action for this state pinned
 * in the footer with the outcome line right above it, and the rare withdrawals in the scroll. Presentation only: the
 * route owns every read, command, fence and label of the footer action.
 */
export function ExportScreenView({ onBack, loading, failure, status, preparation, now, busy, notice, primary,
  onCancel, onRevoke, onRefresh, refreshDisabled }: {
  onBack: () => void; loading: boolean;
  /** The screen could not read, or must read before anything else: the one way forward is a refresh. */
  failure: { title: string; body: string } | null;
  status: DataExportStatus | null; preparation: DataExportPreparation | null;
  now: number; busy: boolean; notice: { text: string; tone: NoticeTone } | null; primary: ReactNode;
  onCancel: () => void; onRevoke: () => void; onRefresh: () => void; refreshDisabled: boolean;
}) {
  const request = status?.request;
  const noticeLine = notice ? <ExportNoticeLine text={notice.text} tone={notice.tone} /> : null;
  const phase = exportPhase(status, now);
  return <SettingsScreen title="Izvoz podataka" onBack={onBack} footer={primary ? <>{noticeLine}{primary}</> : null}>
    <SettingsIntro>Zatraži kopiju podataka vezanih za svoj nalog.</SettingsIntro>
    {notice && !primary ? noticeLine : null}
    {loading ? <View accessible accessibilityLabel="Učitavanje stanja izvoza"><SkeletonList count={1} rows={3} /></View>
      : failure ? <StateView kind="error" art="download" title={failure.title} body={failure.body}
        primary={{ label: 'Osveži stanje', onPress: onRefresh, disabled: refreshDisabled }} />
      : <>
        <SettingsPanel style={s.card}><ExportStepper steps={exportSteps(phase, status)} /></SettingsPanel>
        {preparation?.kind === 'NOT_READY' ? <InlineNote tone="warn" alert>{exportPreparationCopy[preparation.code ?? 'NOT_AVAILABLE']}</InlineNote> : null}
        <QuietLine art="shield">Izvoz je vezan za tvoj nalog. Čuvaj kopiju na mestu kome samo ti imaš pristup.</QuietLine>
        <View style={s.actions}>
          {request?.status === 'REQUESTED' ? <SettingsAction label="Otkaži zahtev" kind="destructive" disabled={busy} onPress={onCancel} /> : null}
          {request?.status === 'READY' && status?.fulfillment ? <SettingsAction label="Opozovi kopiju" kind="destructive" disabled={busy} onPress={onRevoke} /> : null}
          <SettingsAction label="Osveži stanje" kind="quiet" disabled={busy} onPress={onRefresh} />
        </View>
      </>}
  </SettingsScreen>;
}

const s = StyleSheet.create({
  card: { marginBottom: 0 },
  step: { flexDirection: 'row', gap: sys.space.md },
  rail: { width: 24, alignItems: 'center' },
  connector: { width: 2, flex: 1, minHeight: 16, marginVertical: 2, backgroundColor: sys.color.line, borderRadius: sys.radius.pill },
  connectorDone: { backgroundColor: sys.color.green },
  stepCopy: { flex: 1, minWidth: 0, gap: 2 },
  stepGap: { paddingBottom: sys.space.base },
  marker: { width: 24, height: 24, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  markerDone: { backgroundColor: sys.color.green },
  markerCurrent: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.green },
  markerPending: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.lineStrong },
  markerStopped: { backgroundColor: sys.color.iconWell },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  actions: { gap: sys.space.sm, marginTop: sys.space.sm },
});
