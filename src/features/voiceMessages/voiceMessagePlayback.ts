import type { Ishod } from '../../data/ports';
import type { AgreementVoicePlayback } from '../../data/agreementVoiceClientService';
import type { ReceiptAccount } from '../../data/serverReceipt';
import type { AudioArbiter, VoiceFilePort, VoicePlayerPort } from './ports';
import { VOICE_ERROR_COPY, type VoiceErrorCode } from './voiceCopy';

/**
 * Playback of ONE voice message at a time, for the whole conversation screen. The bytes are fetched through the authenticated read (the server
 * authorizes the exact message twice), written to ONE temporary file and played from it; the file is removed when playback stops, ends, is replaced, the
 * screen loses focus or the account changes. Nothing is cached across those moments and no URL ever exists.
 */
export type VoicePlaybackTarget = Readonly<{ agreementId: string; assetId: string; messageId?: string; durationMs: number }>;
export type VoicePlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type VoicePlaybackSnapshot = Readonly<{
  /** The message that owns the speaker now (loading, playing, paused or failed), else null. */
  assetId: string | null;
  status: VoicePlaybackStatus;
  positionMs: number;
  durationMs: number;
  error: Readonly<{ code: VoiceErrorCode; message: string }> | null;
}>;
export type VoicePlaybackOptions = Readonly<{
  accountId: string; accountRevision: number;
  isCurrent(): boolean;
  service: Readonly<{ playback(input: Readonly<{ agreementId: string; assetId: string; messageId?: string }>, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoicePlayback>> }>;
  player: VoicePlayerPort; files: VoiceFilePort; arbiter: AudioArbiter;
}>;

const IDLE: VoicePlaybackSnapshot = Object.freeze({ assetId: null, status: 'idle', positionMs: 0, durationMs: 0, error: null });

export function createVoiceMessagePlayback(options: VoicePlaybackOptions) {
  const scope: ReceiptAccount = { accountId: options.accountId, accountRevision: options.accountRevision };
  const listeners = new Set<() => void>();
  let snapshot: VoicePlaybackSnapshot = IDLE;
  let generation = 0, current: { target: VoicePlaybackTarget; token: object } | null = null;
  let tempUri: string | null = null, unsubscribe: (() => void) | null = null, releaseClaim: (() => void) | null = null, abort: AbortController | null = null;
  const publish = (next: VoicePlaybackSnapshot) => { snapshot = Object.freeze(next); for (const listener of [...listeners]) { try { listener(); } catch { /* a screen's failure never stops playback */ } } };
  const alive = (token: object, g: number) => current?.token === token && g === generation && options.isCurrent();
  const failure = (target: VoicePlaybackTarget, code: VoiceErrorCode): VoicePlaybackSnapshot =>
    ({ assetId: target.assetId, status: 'error', positionMs: 0, durationMs: target.durationMs, error: { code, message: VOICE_ERROR_COPY[code] } });

  /** Stops whatever plays, frees the native player, removes the temporary file and forgets the target. Idempotent. */
  async function teardown() {
    const file = tempUri; tempUri = null;
    abort?.abort(); abort = null;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    releaseClaim?.(); releaseClaim = null;
    current = null;
    try { await options.player.stop(); } catch { /* released below */ }
    try { await options.player.release(); } catch { /* the next load replaces it */ }
    if (file) { try { await options.files.remove(file); } catch { /* the logout purge removes leftovers */ } }
  }
  async function stop() { generation += 1; await teardown(); publish(IDLE); }

  async function toggle(target: VoicePlaybackTarget): Promise<void> {
    if (!options.isCurrent()) return;
    const same = current?.target.assetId === target.assetId && (current.target.messageId ?? null) === (target.messageId ?? null);
    if (same && snapshot.status === 'playing') { try { await options.player.pause(); } catch { /* status follows */ } return; }
    if (same && snapshot.status === 'paused') { try { await options.player.play(); } catch { await stop(); publish(failure(target, 'PLAYBACK_FAILED')); } return; }
    if (same && snapshot.status === 'loading') return;
    // A different message, or a retry after a failure: the previous one is torn down first, then this one takes the speaker.
    generation += 1; const g = generation, token = {};
    await teardown();
    current = { target, token };
    publish({ assetId: target.assetId, status: 'loading', positionMs: 0, durationMs: target.durationMs, error: null });
    try {
      releaseClaim = await options.arbiter.claim('playback', () => stop());
      if (!alive(token, g)) { releaseClaim?.(); releaseClaim = null; return; }
      abort = new AbortController();
      const result = await options.service.playback({ agreementId: target.agreementId, assetId: target.assetId, ...(target.messageId ? { messageId: target.messageId } : {}) }, scope, abort.signal);
      abort = null;
      if (!alive(token, g)) return;
      if (!result.ok) { publish(failure(target, result.kod === 'MEDIA_NOT_FOUND' || result.kod === 'MEDIA_UNAVAILABLE' ? 'PLAYBACK_UNAVAILABLE' : 'PLAYBACK_FAILED')); await teardown(); return; }
      const uri = await options.files.writeTemp(`voice-${target.assetId}.m4a`, result.podatak.bytes);
      if (!alive(token, g)) { try { await options.files.remove(uri); } catch { /* purged later */ } return; }
      tempUri = uri;
      await options.player.load(uri);
      if (!alive(token, g)) return;
      unsubscribe = options.player.onStatus(status => {
        if (!alive(token, g)) return;
        if (status.ended) { void (async () => { if (!alive(token, g)) return; await stop(); })(); return; }
        publish({ assetId: target.assetId, status: status.playing ? 'playing' : 'paused', positionMs: Math.max(0, Math.round(status.positionMs)),
          // The stored length is the one the message row already shows; the player's own figure only fills in when that is unknown.
          durationMs: target.durationMs > 0 ? target.durationMs : Math.max(0, Math.round(status.durationMs ?? 0)), error: null });
      });
      await options.player.play();
      if (alive(token, g) && snapshot.status === 'loading') publish({ ...snapshot, status: 'playing' });
    } catch {
      if (alive(token, g)) { publish(failure(target, 'PLAYBACK_FAILED')); await teardown(); }
    }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    toggle, stop,
    /** The screen lost focus, the account changed or the conversation closed: everything is released. */
    async dispose() { listeners.clear(); await stop(); },
  };
}
export type VoiceMessagePlayback = ReturnType<typeof createVoiceMessagePlayback>;
