/** Provider-neutral native speech lifecycle. No audio storage or publication writer. */
export type VoiceScope = Readonly<{
  accountId: string;
  accountRevision: number;
  conversationId: string;
}>;

export type VoiceSession = Readonly<VoiceScope & {
  generation: number;
  gestureId: string;
  startedAt: number;
  mode: 'hold' | 'accessible';
}>;

export type VoiceErrorCode =
  | 'VOICE_NOT_CONFIGURED' | 'MIC_PERMISSION_DENIED' | 'MIC_PERMISSION_TIMEOUT'
  | 'MIC_UNAVAILABLE' | 'CAPTURE_FAILED' | 'CAPTURE_TIMEOUT' | 'AUDIO_INTERRUPTED'
  | 'FINALIZATION_FAILED' | 'FINALIZATION_TIMEOUT' | 'FINAL_TRANSCRIPT_MISSING'
  | 'TRANSCRIPT_INVALID' | 'TRANSCRIPT_TOO_LONG' | 'AI_SPEAKING'
  | 'SUBMISSION_FAILED' | 'SUBMISSION_UNKNOWN';

export const VOICE_ERROR_COPY: Readonly<Record<VoiceErrorCode, string>> = {
  VOICE_NOT_CONFIGURED: 'Govorni unos još nije povezan. Možete da nastavite kucanjem.',
  MIC_PERMISSION_DENIED: 'Mikrofon nije dozvoljen. Dozvolu možete promeniti u podešavanjima telefona ili nastaviti kucanjem.',
  MIC_PERMISSION_TIMEOUT: 'Zahtev za mikrofon je istekao. Pokrenite novi unos kada budete spremni.',
  MIC_UNAVAILABLE: 'Mikrofon trenutno nije dostupan. Nastavite kucanjem.',
  CAPTURE_FAILED: 'Govorni unos je prekinut. Sačuvani tekst možete da izmenite.',
  CAPTURE_TIMEOUT: 'Govorni unos je zaustavljen zbog ograničenja trajanja. Sačuvani tekst možete da dopunite.',
  AUDIO_INTERRUPTED: 'Zvuk je prekinut. Proverite sačuvani tekst ili pokrenite novi unos.',
  FINALIZATION_FAILED: 'Završni transkript nije potvrđen. Proverite i izmenite sačuvani tekst.',
  FINALIZATION_TIMEOUT: 'Završavanje govora je trajalo predugo. Proverite sačuvani tekst.',
  FINAL_TRANSCRIPT_MISSING: 'Nije stigao završni transkript. Sačuvani deo možete da izmenite i pošaljete kucanjem.',
  TRANSCRIPT_INVALID: 'Govorni unos nije mogao bezbedno da se pročita. Proverite sačuvani tekst.',
  TRANSCRIPT_TOO_LONG: 'Govorni unos prelazi 4.000 znakova. Sačuvan je prethodni deo; skratite ili podelite poruku.',
  AI_SPEAKING: 'Sačekajte da se čitanje odgovora završi pre govornog unosa.',
  SUBMISSION_FAILED: 'Poruka nije prihvaćena. Tekst je sačuvan za izmenu.',
  SUBMISSION_UNKNOWN: 'Proveravam da li je poruka primljena. Nemojte je ponovo slati dok ishod nije poznat.',
};

export type SpeechEvent =
  | { kind: 'segment'; index: number; final: boolean; text: string }
  | { kind: 'level'; value: number | null }
  | { kind: 'error'; code: 'MIC_UNAVAILABLE' | 'CAPTURE_FAILED' | 'AUDIO_INTERRUPTED' };

export type FinalTranscript = { kind: 'final'; text: string } | { kind: 'incomplete' };

export interface NativeSpeechCapture {
  /** The adapter checks canCapture before/after each async acquisition and closes late resources. */
  start(): Promise<void>;
  /** Immediately fences native audio callbacks and stops capture, without ending the STT read. */
  stopCapture(): void;
  /** Called once, after stopCapture. Only a provider-confirmed whole utterance is `final`. */
  finalize(): Promise<FinalTranscript>;
  /** Idempotent; closes microphone, recognizer/socket and all native listeners, including pending acquisitions. */
  dispose(): void;
}

export interface NativeSpeechAdapter {
  requestPermission(signal: AbortSignal): Promise<'granted' | 'denied' | 'unavailable'>;
  /** Creates an inert, cancellable handle. No microphone or provider I/O until start(). */
  createCapture(input: {
    session: VoiceSession;
    signal: AbortSignal;
    canCapture: () => boolean;
    onEvent: (event: SpeechEvent) => void;
  }): NativeSpeechCapture;
}

export type VoiceSubmission = Readonly<{
  session: VoiceSession;
  clientRequestId: string;
  text: string;
}>;

export type VoiceSubmitResult = { kind: 'accepted' } | { kind: 'rejected' } | { kind: 'unknown' };
export type VoiceCancelReason = 'gesture' | 'navigation' | 'background' | 'account' | 'interruption' | 'dispose';
export type VoicePhase = 'IDLE' | 'PERMISSION_PENDING' | 'STARTING' | 'LISTENING' | 'FINALIZING' | 'SUBMITTING' | 'UNKNOWN_OUTCOME';
export type VoiceSnapshot = Readonly<{
  phase: VoicePhase;
  session: VoiceSession | null;
  finalText: string;
  interimText: string;
  audioLevel: number | null;
  fallbackText: string;
  error: VoiceErrorCode | null;
  submission: VoiceSubmission | null;
}>;

export type HoldToTalkOptions = {
  adapter: NativeSpeechAdapter | null;
  getScope: () => VoiceScope | null;
  isAiSpeaking?: () => boolean;
  newRequestId: () => string;
  /** Must call the existing owned AI writer with this exact key and check isCurrent before dispatch. */
  submit: (input: VoiceSubmission & { signal: AbortSignal; isCurrent: () => boolean }) => Promise<VoiceSubmitResult>;
  /** Technical safety deadlines are supplied by the approved integration, never copied from HTML demo timing. */
  limits: { permissionMs: number; captureMs: number; finalizationMs: number; submissionMs: number };
};

type ActiveSession = {
  identity: VoiceSession;
  abort: AbortController;
  capture: NativeSpeechCapture | null;
  held: boolean;
  segments: Map<number, { final: boolean; text: string }>;
  submitted: boolean;
  deadline?: ReturnType<typeof setTimeout>;
};

const blank = (): VoiceSnapshot => ({ phase: 'IDLE', session: null, finalText: '', interimText: '',
  audioLevel: null, fallbackText: '', error: null, submission: null });
const sameScope = (a: VoiceScope | null, b: VoiceScope | null) => !!a && !!b
  && a.accountId === b.accountId && a.accountRevision === b.accountRevision && a.conversationId === b.conversationId;
const safeText = (text: unknown): text is string => typeof text === 'string'
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
const MAX_TEXT = 4000; // Existing owned AI turn input bound.

export class HoldToTalkController {
  private snapshot: VoiceSnapshot = blank();
  private listeners = new Set<() => void>();
  private active: ActiveSession | null = null;
  private generation = 0;
  private foreground = true;
  private disposed = false;

  constructor(private readonly options: HoldToTalkOptions) {
    if (!Object.values(options.limits).every(value => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('VOICE_DEADLINES_REQUIRED');
    }
  }

  getSnapshot = (): VoiceSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<VoiceSnapshot>) {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    this.listeners.forEach(listener => listener());
  }

  private current(session: ActiveSession) {
    return !this.disposed && this.foreground && this.active === session && !session.abort.signal.aborted
      && sameScope(this.options.getScope(), session.identity);
  }

  private clearDeadline(session: ActiveSession) {
    if (session.deadline !== undefined) clearTimeout(session.deadline);
    session.deadline = undefined;
  }

  private deadline(session: ActiveSession, ms: number, code: VoiceErrorCode) {
    this.clearDeadline(session);
    session.deadline = setTimeout(() => {
      if (!this.current(session)) { this.contextChanged(); return; }
      if (session.submitted) this.unknown(session);
      else this.fail(session, code);
    }, ms);
  }

  private closeCapture(session: ActiveSession) {
    const capture = session.capture;
    session.capture = null;
    if (!capture) return;
    try { capture.stopCapture(); } catch { /* dispose remains required even if stop fails */ }
    try { capture.dispose(); } catch { /* adapters cannot reflect platform errors to the user */ }
  }

  private terminate(session: ActiveSession) {
    this.clearDeadline(session);
    session.held = false;
    session.abort.abort();
    this.closeCapture(session);
    if (this.active === session) this.active = null;
  }

  private transcript(session: ActiveSession) {
    return [...session.segments].sort(([a], [b]) => a - b).map(([, value]) => value.text).join(' ').trim();
  }

  private fail(session: ActiveSession, error: VoiceErrorCode) {
    if (!this.current(session)) { this.contextChanged(); return; }
    const fallbackText = this.transcript(session);
    this.terminate(session);
    this.update({ ...blank(), session: session.identity, fallbackText, error });
  }

  /** Returns false for another active gesture or an unresolved submission. */
  begin(gestureId: string, mode: VoiceSession['mode'] = 'hold'): boolean {
    this.contextChanged();
    if (this.disposed || !this.foreground || this.active || this.snapshot.phase === 'UNKNOWN_OUTCOME' || !gestureId) return false;
    const scope = this.options.getScope();
    if (!scope) return false;
    if (!this.options.adapter) { this.update({ error: 'VOICE_NOT_CONFIGURED' }); return false; }
    if (this.options.isAiSpeaking?.()) { this.update({ error: 'AI_SPEAKING' }); return false; }
    const session: ActiveSession = {
      identity: Object.freeze({ ...scope, generation: ++this.generation, gestureId, mode, startedAt: Date.now() }),
      abort: new AbortController(), capture: null, held: true, segments: new Map(), submitted: false,
    };
    this.active = session;
    this.update({ ...blank(), session: session.identity, phase: 'PERMISSION_PENDING' });
    this.deadline(session, this.options.limits.permissionMs, 'MIC_PERMISSION_TIMEOUT');
    void this.start(session);
    return true;
  }

  private async start(session: ActiveSession) {
    const adapter = this.options.adapter!;
    try {
      const permission = await adapter.requestPermission(session.abort.signal);
      if (!this.current(session) || !session.held) { this.contextChanged(); return; }
      if (permission !== 'granted') {
        this.fail(session, permission === 'denied' ? 'MIC_PERMISSION_DENIED' : 'MIC_UNAVAILABLE'); return;
      }
      if (this.options.isAiSpeaking?.()) { this.fail(session, 'AI_SPEAKING'); return; }
      this.update({ phase: 'STARTING' });
      const capture = adapter.createCapture({ session: session.identity, signal: session.abort.signal,
        canCapture: () => this.current(session) && session.held && !this.options.isAiSpeaking?.(),
        onEvent: event => this.receive(session, event) });
      // Register before async start so release/background can close pending native acquisitions.
      session.capture = capture;
      if (!this.current(session) || !session.held) { this.closeCapture(session); return; }
      await capture.start();
      if (!this.current(session) || !session.held) { this.closeCapture(session); this.contextChanged(); return; }
      this.update({ phase: 'LISTENING' });
      this.deadline(session, this.options.limits.captureMs, 'CAPTURE_TIMEOUT');
    } catch {
      if (this.current(session)) this.fail(session, 'CAPTURE_FAILED');
      else { this.closeCapture(session); this.contextChanged(); }
    }
  }

  private receive(session: ActiveSession, event: SpeechEvent) {
    if (!this.current(session)) { this.contextChanged(); return; }
    if (session.submitted || !['STARTING', 'LISTENING', 'FINALIZING'].includes(this.snapshot.phase)) return;
    if (event.kind === 'error') { this.fail(session, event.code); return; }
    if (event.kind === 'level') {
      if (session.held) this.update({ audioLevel: typeof event.value === 'number' && Number.isFinite(event.value)
        && event.value >= 0 && event.value <= 1 ? event.value : null });
      return;
    }
    if (!Number.isSafeInteger(event.index) || event.index < 0 || event.index > MAX_TEXT
      || !safeText(event.text) || typeof event.final !== 'boolean') { this.fail(session, 'TRANSCRIPT_INVALID'); return; }
    const previous = session.segments.get(event.index);
    // Duplicate finals and late hypotheses never replace already-final words.
    if (previous?.final) return;
    const text = event.text.trim();
    const candidate = new Map(session.segments);
    candidate.set(event.index, { text, final: event.final });
    if ([...candidate.values()].map(part => part.text).join(' ').trim().length > MAX_TEXT) {
      this.fail(session, 'TRANSCRIPT_TOO_LONG'); return;
    }
    session.segments.set(event.index, { text, final: event.final });
    const segments = [...session.segments].sort(([a], [b]) => a - b).map(([, value]) => value);
    this.update({ finalText: segments.filter(part => part.final).map(part => part.text).join(' ').trim(),
      interimText: segments.filter(part => !part.final).map(part => part.text).join(' ').trim() });
  }

  release(gestureId: string): void {
    const session = this.active;
    if (!session || session.identity.gestureId !== gestureId || !session.held) return;
    if (!this.current(session)) { this.contextChanged(); return; }
    session.held = false;
    if (this.snapshot.phase !== 'LISTENING' || !session.capture) { this.cancel('gesture'); return; }
    this.update({ phase: 'FINALIZING', audioLevel: null });
    this.deadline(session, this.options.limits.finalizationMs, 'FINALIZATION_TIMEOUT');
    try { session.capture.stopCapture(); }
    catch { this.fail(session, 'FINALIZATION_FAILED'); return; }
    void this.finish(session);
  }

  private async finish(session: ActiveSession) {
    let result: FinalTranscript;
    try { result = await session.capture!.finalize(); }
    catch { if (this.current(session)) this.fail(session, 'FINALIZATION_FAILED'); else this.contextChanged(); return; }
    if (!this.current(session) || session.submitted) { this.contextChanged(); return; }
    if (result.kind !== 'final' || !result.text?.trim()) { this.fail(session, 'FINAL_TRANSCRIPT_MISSING'); return; }
    if (!safeText(result.text)) { this.fail(session, 'TRANSCRIPT_INVALID'); return; }
    if (result.text.length > MAX_TEXT) { this.fail(session, 'TRANSCRIPT_TOO_LONG'); return; }
    let clientRequestId: string;
    try { clientRequestId = this.options.newRequestId(); }
    catch { this.fail(session, 'SUBMISSION_FAILED'); return; }
    const submission = Object.freeze({ session: session.identity, clientRequestId, text: result.text.trim() });
    session.submitted = true;
    this.closeCapture(session);
    this.update({ phase: 'SUBMITTING', finalText: submission.text, interimText: '', submission });
    this.deadline(session, this.options.limits.submissionMs, 'SUBMISSION_UNKNOWN');
    try {
      if (!this.current(session)) { this.contextChanged(); return; }
      const sent = await this.options.submit({ ...submission, signal: session.abort.signal, isCurrent: () => this.current(session) });
      if (!this.current(session)) { this.contextChanged(); return; }
      if (sent.kind === 'unknown') { this.unknown(session); return; }
      this.terminate(session);
      this.update({ ...blank(), submission, fallbackText: sent.kind === 'rejected' ? submission.text : '',
        error: sent.kind === 'rejected' ? 'SUBMISSION_FAILED' : null });
    } catch { if (this.current(session)) this.unknown(session); else this.contextChanged(); }
  }

  private unknown(session: ActiveSession) {
    this.terminate(session);
    this.update({ phase: 'UNKNOWN_OUTCOME', audioLevel: null, error: 'SUBMISSION_UNKNOWN' });
  }

  /** No retry here: the owned AI receipt reader resolves the existing exact request. */
  resolveSubmission(clientRequestId: string, result: Exclude<VoiceSubmitResult, { kind: 'unknown' }>): boolean {
    this.contextChanged();
    const submission = this.snapshot.submission;
    if (this.snapshot.phase !== 'UNKNOWN_OUTCOME' || !submission || submission.clientRequestId !== clientRequestId) return false;
    this.update({ ...blank(), submission, fallbackText: result.kind === 'rejected' ? submission.text : '',
      error: result.kind === 'rejected' ? 'SUBMISSION_FAILED' : null });
    return true;
  }

  cancel(reason: VoiceCancelReason): void {
    const session = this.active;
    if (!session && this.snapshot.phase === 'UNKNOWN_OUTCOME' && reason !== 'account' && reason !== 'dispose') return;
    if (session?.submitted && sameScope(this.options.getScope(), session.identity) && reason !== 'account' && reason !== 'dispose') {
      this.unknown(session); return; // A dispatched write cannot be described as unsent.
    }
    if (session) this.terminate(session);
    // No private transient text carries across account, navigation or explicit cancellation.
    this.update(blank());
  }

  /** Call synchronously on Auth/context changes, including A→B→A incarnations. */
  contextChanged(): void {
    const identity = this.active?.identity ?? this.snapshot.session ?? this.snapshot.submission?.session;
    if (identity && !sameScope(this.options.getScope(), identity)) this.cancel('account');
  }

  setForeground(foreground: boolean): void {
    this.foreground = foreground;
    if (!foreground) this.cancel('background');
  }

  interrupt(): void {
    const session = this.active;
    if (session && !session.submitted) this.fail(session, 'AUDIO_INTERRUPTED');
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel('dispose');
    this.disposed = true;
    this.listeners.clear();
  }
}
