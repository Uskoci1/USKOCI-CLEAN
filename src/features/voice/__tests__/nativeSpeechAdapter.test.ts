import type { SpeechEvent, VoiceSession } from '../holdToTalk';
import { SPEECH_PROTOCOL } from '../speechProtocol';

const mockListeners = new Map<string, (event: any) => void>();
const mockNative = { start: jest.fn(), stop: jest.fn(), addListener: jest.fn((name, callback) => {
  mockListeners.set(name, callback); return { remove: () => mockListeners.delete(name) };
}) };
const mockPermission = { check: jest.fn(async () => true), request: jest.fn(async () => 'granted'),
  PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' }, RESULTS: { GRANTED: 'granted' } };
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, PermissionsAndroid: mockPermission }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
import { createNativeSpeechAdapter } from '../nativeSpeechAdapter';

const session: VoiceSession = { accountId: 'a', accountRevision: 3, conversationId: 'owned', generation: 5,
  gestureId: 'press', mode: 'hold', startedAt: 100 };
const flush = async () => { for (let n = 0; n < 5; n++) await Promise.resolve(); };
class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 1; bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null; onclose: (() => void) | null = null;
  messages: any[] = [];
  constructor(public url: string, public protocols: string[], public options: { headers: Record<string,string> }) { FakeSocket.instances.push(this); }
  send(text: string) { this.messages.push(JSON.parse(text)); }
  close = jest.fn(() => { this.readyState = 3; });
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
}
const event = (sequence: number, body: object) => ({ protocol: SPEECH_PROTOCOL, conversationId: 'owned', operationId: 'op-1', sequence, ...body });
function fixture() {
  const controller = new AbortController(); let held = true;
  const events: SpeechEvent[] = [];
  const adapter = createNativeSpeechAdapter({ newOperationId: () => 'op-1',
    getConnection: async () => ({ url: 'https://owned.supabase.co', accessToken: 'SYNTHETIC_JWT', anonKey: 'PUBLIC_KEY' }) });
  const capture = adapter.createCapture({ session, signal: controller.signal, canCapture: () => held,
    onEvent: value => events.push(value) });
  const start = async () => {
    const running = capture.start(); await flush(); const socket = FakeSocket.instances[0];
    socket.emit(event(0, { kind: 'ready' })); await running; return socket;
  };
  return { adapter, capture, controller, events, start, release: () => { held = false; } };
}

describe('actual native PCM / first-party speech adapter with synthetic I/O', () => {
  const originalWebSocket = globalThis.WebSocket;
  beforeEach(() => { jest.clearAllMocks(); mockListeners.clear(); FakeSocket.instances = [];
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket; });
  afterAll(() => { globalThis.WebSocket = originalWebSocket; });

  it('does not record until the owned server is ready and keeps Auth out of URLs', async () => {
    const h = fixture(); const running = h.capture.start(); await flush();
    expect(mockNative.start).not.toHaveBeenCalled(); const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('wss://owned.supabase.co/functions/v1/uskoci-speech-session?conversationId=owned&operationId=op-1');
    expect(ws.options.headers.Authorization).toBe('Bearer SYNTHETIC_JWT'); expect(ws.url).not.toContain('SYNTHETIC_JWT');
    ws.emit(event(0, { kind: 'ready' })); await running;
    expect(mockNative.start).toHaveBeenCalledWith('op-1', 120000); h.capture.dispose();
  });

  it('forwards native PCM only while held and finalizes once after stopping microphone', async () => {
    const h = fixture(); const ws = await h.start();
    mockListeners.get('pcm')?.({ sessionId: 'op-1', sequence: 0, pcmBase64: 'AAA=', rms: 0.25 });
    expect(ws.messages).toEqual([{ kind: 'audio', sequence: 0, pcmBase64: 'AAA=' }]);
    expect(h.events).toContainEqual({ kind: 'level', value: 0.25 });
    ws.emit(event(1, { kind: 'segment', index: 0, final: false, text: 'Dve' }));
    expect(h.events.at(-1)).toEqual({ kind: 'segment', index: 0, final: false, text: 'Dve' });
    h.release(); h.capture.stopCapture(); const final = h.capture.finalize();
    expect(mockNative.stop).toHaveBeenCalledTimes(1); expect(mockListeners.size).toBe(0);
    expect(ws.messages.at(-1)).toEqual({ kind: 'release' });
    ws.emit(event(2, { kind: 'final', text: 'Dve osobe' }));
    expect(await final).toEqual({ kind: 'final', text: 'Dve osobe' });
    expect(await h.capture.finalize()).toEqual({ kind: 'incomplete' });
    h.capture.dispose(); expect(mockNative.stop).toHaveBeenCalledTimes(1);
  });

  it('closes an opening socket after release and never starts late recording', async () => {
    const h = fixture(); const running = h.capture.start(); await flush(); const ws = FakeSocket.instances[0];
    h.release(); h.controller.abort(); await expect(running).rejects.toThrow('CAPTURE_CANCELLED');
    ws.emit(event(0, { kind: 'ready' })); expect(mockNative.start).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it('accepts no old-turn, duplicate/out-of-order or raw provider messages', async () => {
    const h = fixture(); const ws = await h.start();
    ws.emit({ ...event(1, { kind: 'segment', index: 0, final: true, text: 'old data' }), operationId: 'old' });
    expect(h.events).toEqual([{ kind: 'error', code: 'CAPTURE_FAILED' }]); expect(ws.close).toHaveBeenCalledTimes(1);
    expect(mockNative.stop).toHaveBeenCalledTimes(1);
  });

  it('does not record when permission is denied after an aborted request', async () => {
    const h = fixture(); h.controller.abort(); expect(await h.adapter.requestPermission(h.controller.signal)).toBe('unavailable');
    expect(mockPermission.check).not.toHaveBeenCalled(); expect(mockNative.start).not.toHaveBeenCalled();
  });

  it('fences stale PCM and stops on native audio interruption', async () => {
    const h = fixture(); const ws = await h.start();
    mockListeners.get('pcm')?.({ sessionId: 'old', sequence: 0, pcmBase64: 'AAA=', rms: 1 });
    expect(ws.messages).toHaveLength(0);
    mockListeners.get('interrupted')?.({ sessionId: 'op-1', code: 'AUDIO_INTERRUPTED' });
    expect(h.events.at(-1)).toEqual({ kind: 'error', code: 'AUDIO_INTERRUPTED' });
    expect(mockNative.stop).toHaveBeenCalledTimes(1); expect(ws.close).toHaveBeenCalledTimes(1);
  });
});
