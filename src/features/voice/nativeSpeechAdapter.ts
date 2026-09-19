import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { FinalTranscript, NativeSpeechAdapter, NativeSpeechCapture, VoiceSession } from './holdToTalk';
import { decodeSpeechEvent, pcmBase64Bytes, SPEECH_LIMITS } from './speechProtocol';

type Subscription = { remove(): void };
export interface NativePcmModule {
  start(sessionId: string, maxDurationMs: number): void;
  stop(sessionId: string): void;
  addListener(event: 'pcm', listener: (event: { sessionId: string; sequence: number; pcmBase64: string; rms: number }) => void): Subscription;
  addListener(event: 'interrupted', listener: (event: { sessionId: string; code: string }) => void): Subscription;
}
type Connection = { url: string; accessToken: string; anonKey: string };
export type SpeechAdapterOptions = {
  getConnection: (session: VoiceSession, signal: AbortSignal) => Promise<Connection | null>;
  newOperationId: () => string;
};

export function createNativeSpeechAdapter(options: SpeechAdapterOptions): NativeSpeechAdapter {
  let native: NativePcmModule | null = null;
  try { if (Platform.OS === 'android') native = requireOptionalNativeModule<NativePcmModule>('UskociVoice'); } catch { }
  return {
    async requestPermission(signal) {
      if (!native || Platform.OS !== 'android' || signal.aborted) return 'unavailable';
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (signal.aborted) return 'denied';
      if (granted) return 'granted';
      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return !signal.aborted && status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
    },
    createCapture(input): NativeSpeechCapture {
      const module = native;
      const operationId = options.newOperationId();
      let socket: WebSocket | null = null, disposed = false, captureStopped = false, started = false, released = false;
      let expectedSequence = 0, expectedAudioSequence = 0, pcmBytes = 0;
      let subscriptions: Subscription[] = [];
      let readyResolve: () => void = () => {}, readyReject: (error: Error) => void = () => {};
      const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
      // A disposal can precede start() awaiting setup. Mark the rejection handled immediately.
      void ready.catch(() => undefined);
      let finalResolve: (result: FinalTranscript) => void = () => {};
      const final = new Promise<FinalTranscript>(resolve => { finalResolve = resolve; });
      let terminalReceived = false;
      const stopCapture = () => {
        if (captureStopped) return;
        captureStopped = true;
        try { module?.stop(operationId); } catch { }
        subscriptions.forEach(subscription => subscription.remove()); subscriptions = [];
      };
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        input.signal.removeEventListener('abort', dispose);
        stopCapture();
        readyReject(new Error('CAPTURE_CANCELLED'));
        finalResolve({ kind: 'incomplete' });
        if (socket) {
          const previous = socket; socket = null;
          previous.onopen = null; previous.onmessage = null; previous.onerror = null; previous.onclose = null;
          try { if (previous.readyState === 1 && !terminalReceived) previous.send(JSON.stringify({ kind: 'cancel' })); } catch { }
          try { previous.close(1000, 'session ended'); } catch { }
        }
      };
      const fail = (code: 'MIC_UNAVAILABLE' | 'CAPTURE_FAILED' | 'AUDIO_INTERRUPTED' = 'CAPTURE_FAILED') => {
        if (disposed) return;
        readyReject(new Error(code)); finalResolve({ kind: 'incomplete' });
        input.onEvent({ kind: 'error', code }); dispose();
      };
      input.signal.addEventListener('abort', dispose, { once: true });
      if (input.signal.aborted) dispose();

      return {
        async start() {
          if (disposed || !module || !input.canCapture()) throw new Error('MIC_UNAVAILABLE');
          const connection = await options.getConnection(input.session, input.signal);
          if (disposed || !input.canCapture()) { dispose(); return; }
          if (!connection || !connection.accessToken || !connection.anonKey) throw new Error('MIC_UNAVAILABLE');
          const url = new URL(connection.url);
          if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SPEECH_CONNECTION_INVALID');
          url.protocol = 'wss:'; url.pathname = '/functions/v1/uskoci-speech-session';
          url.searchParams.set('conversationId', input.session.conversationId);
          url.searchParams.set('operationId', operationId);
          // React Native's native WebSocket supports request headers; tokens never enter query strings.
          const NativeWebSocket = WebSocket as unknown as new (url: string, protocols: string[], options: { headers: Record<string,string> }) => WebSocket;
          socket = new NativeWebSocket(url.toString(), [], { headers: { Authorization: 'Bearer ' + connection.accessToken, apikey: connection.anonKey } });
          socket.onmessage = event => {
            if (disposed) return;
            if (typeof event.data !== 'string' || event.data.length > 30000) { fail(); return; }
            let raw: unknown;
            try { raw = JSON.parse(event.data); } catch { fail(); return; }
            const message = decodeSpeechEvent(raw, input.session.conversationId, operationId, expectedSequence);
            if (!message) { fail(); return; }
            expectedSequence++;
            if (message.kind === 'ready') { readyResolve(); return; }
            if (message.kind === 'segment') { input.onEvent({ kind: 'segment', index: message.index, final: message.final, text: message.text }); return; }
            if (message.kind === 'error') { fail(); return; }
            if (!released || terminalReceived) { fail(); return; }
            terminalReceived = true;
            finalResolve(message.text.trim() ? { kind: 'final', text: message.text } : { kind: 'incomplete' });
          };
          socket.onerror = () => fail('MIC_UNAVAILABLE');
          socket.onclose = () => { if (!terminalReceived && !disposed) fail(); };
          await ready;
          if (disposed || !input.canCapture()) { dispose(); return; }
          subscriptions.push(module.addListener('pcm', event => {
            if (event.sessionId !== operationId || disposed || captureStopped || !input.canCapture()) return;
            const bytes = pcmBase64Bytes(event.pcmBase64);
            if (bytes === null || event.sequence !== expectedAudioSequence || pcmBytes + bytes > SPEECH_LIMITS.pcmTotalBytes
              || socket?.readyState !== 1 || socket.bufferedAmount > SPEECH_LIMITS.outgoingBufferBytes) { fail(); return; }
            expectedAudioSequence++; pcmBytes += bytes;
            input.onEvent({ kind: 'level', value: event.rms });
            socket.send(JSON.stringify({ kind: 'audio', sequence: event.sequence, pcmBase64: event.pcmBase64 }));
          }));
          subscriptions.push(module.addListener('interrupted', event => {
            if (event.sessionId === operationId && !disposed) fail('AUDIO_INTERRUPTED');
          }));
          if (disposed || !input.canCapture()) { dispose(); return; }
          started = true;
          module.start(operationId, SPEECH_LIMITS.captureMs);
          if (!input.canCapture()) dispose();
        },
        stopCapture,
        finalize() {
          if (disposed || !started || released || socket?.readyState !== 1) return Promise.resolve({ kind: 'incomplete' });
          stopCapture(); released = true;
          socket.send(JSON.stringify({ kind: 'release' }));
          return final;
        },
        dispose,
      };
    },
  };
}
