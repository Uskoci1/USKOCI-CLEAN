/**
 * Voice messages: the three platform seams. Everything above them (the recording-to-sending model, the playback model, the screen hooks) is plain
 * TypeScript against these interfaces and is tested with fakes; the `expo-audio` and file-system adapters implement them and are the only place a
 * native module is touched. One audio owner at a time is enforced by `audioArbiter`, never by the adapters.
 */
export type PermissionAnswer = 'granted' | 'denied' | 'blocked' | 'unavailable';
/** A finished recording: a file in the app's private cache and its real duration. The bytes stay in that file until it is uploaded or discarded. */
export type RecordedFile = Readonly<{ uri: string; durationMs: number }>;
export type InterruptReason = 'BACKGROUND' | 'AUDIO_FOCUS' | 'FAILED';

export interface VoiceRecorderPort {
  requestPermission(): Promise<PermissionAnswer>;
  /** Starts ONE mono AAC M4A recording into the private cache; resolves only when audio is really being captured. */
  start(): Promise<void>;
  /** Finalizes the file and returns it. */
  stop(): Promise<RecordedFile>;
  /** Stops and deletes whatever was recorded. Idempotent. */
  cancel(): Promise<void>;
  /** Fires when the platform takes the microphone away (background, a call, a failure). Returns the unsubscribe. */
  onInterrupted(listener: (reason: InterruptReason) => void): () => void;
  /** A 0..1 input level for a live meter, where the platform offers one. Optional: nothing depends on it. */
  onLevel?(listener: (level: number) => void): () => void;
}

export type PlayerStatus = Readonly<{ positionMs: number; durationMs: number | null; playing: boolean; ended: boolean }>;
export interface VoicePlayerPort {
  /** Prepares a local file for playback (a recording under review, or a downloaded message). Replaces whatever was loaded. */
  load(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Stops and rewinds. The file stays loaded until the next load or release. */
  stop(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  onStatus(listener: (status: PlayerStatus) => void): () => void;
  /** Frees the native player. Idempotent. */
  release(): Promise<void>;
}

export interface VoiceFilePort {
  /** The whole file, for the upload. */
  read(uri: string): Promise<ArrayBuffer>;
  /** A temporary file for a downloaded message; the name is a safe leaf, never a path. */
  writeTemp(name: string, bytes: ArrayBuffer): Promise<string>;
  remove(uri: string): Promise<void>;
  /** Removes every temporary voice file of this app (logout, account change). */
  purgeAll(): Promise<void>;
}

/** Exactly one of these owns the speaker or the microphone; claiming releases the previous owner first. */
export type AudioOwner = 'recording' | 'preview' | 'playback';
export function createAudioArbiter() {
  let owner: { kind: AudioOwner; release: () => void | Promise<void> } | null = null;
  return {
    /** Returns a release function for the claim. `release` is called when another owner claims, never when this owner releases itself. */
    async claim(kind: AudioOwner, release: () => void | Promise<void>): Promise<() => void> {
      const previous = owner; const mine = { kind, release }; owner = mine;
      if (previous) { try { await previous.release(); } catch { /* the previous owner's own cleanup failing must not block the new one */ } }
      return () => { if (owner === mine) owner = null; };
    },
    current: (): AudioOwner | null => owner?.kind ?? null,
  };
}
export type AudioArbiter = ReturnType<typeof createAudioArbiter>;
