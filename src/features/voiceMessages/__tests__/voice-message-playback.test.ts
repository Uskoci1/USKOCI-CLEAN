// Voice messages B2-a (2026-10-01): playback of one received or sent voice message at a time - authorized bytes, one temporary file, full cleanup.
import { createAudioArbiter } from '../ports';
import { createVoiceMessagePlayback } from '../voiceMessagePlayback';
import { createFakeFiles, createFakePlayer } from '../testing/fakes';

const accountId = '11111111-1111-4111-8111-111111111111', agreementId = '22222222-2222-4222-8222-222222222222';
const assetId = '33333333-3333-4333-8333-333333333333', otherAsset = '44444444-4444-4444-8444-444444444444', messageId = '55555555-5555-4555-8555-555555555555';
const target = { agreementId, assetId, messageId, durationMs: 4200 };
const other = { agreementId, assetId: otherAsset, messageId: '66666666-6666-4666-8666-666666666666', durationMs: 9000 };
const bytes = new ArrayBuffer(512);

function setup() {
  const player = createFakePlayer(), files = createFakeFiles(), arbiter = createAudioArbiter();
  const live = { current: true };
  const service = { playback: jest.fn(async (input: { assetId: string }) => ({ ok: true as const, podatak: { assetId: input.assetId, bytes, contentType: 'audio/mp4' as const } })) };
  const playback = createVoiceMessagePlayback({ accountId, accountRevision: 4, isCurrent: () => live.current, service, player: player.port, files: files.port, arbiter });
  return { playback, player, files, arbiter, live, service };
}

it('fetches the authorized bytes once, plays them from one temporary file and follows the player', async () => {
  const s = setup(); const seen: string[] = []; s.playback.subscribe(() => seen.push(s.playback.getSnapshot().status));
  await s.playback.toggle(target);
  expect(s.service.playback).toHaveBeenCalledWith({ agreementId, assetId, messageId }, { accountId, accountRevision: 4 }, expect.any(AbortSignal));
  expect(s.files.log.written).toHaveLength(1); expect(s.files.log.written[0]).toMatch(new RegExp(`voice-${assetId}-\\d+-\\d+\\.m4a#\\d+$`));
  expect(s.player.state.calls).toEqual(['stop', 'release', expect.stringContaining('load:file:///tmp/voice-' + assetId), 'play']);
  expect(s.playback.getSnapshot()).toMatchObject({ assetId, status: 'playing', durationMs: 4200, error: null }); expect(s.arbiter.current()).toBe('playback'); expect(seen).toContain('loading');
  s.player.progress(1800); expect(s.playback.getSnapshot()).toMatchObject({ status: 'playing', positionMs: 1800 });
  await s.playback.toggle(target); expect(s.playback.getSnapshot().status).toBe('paused');
  await s.playback.toggle(target); expect(s.playback.getSnapshot().status).toBe('playing'); expect(s.service.playback).toHaveBeenCalledTimes(1);
});
it('an own unsent recording is played without a message id', async () => {
  const s = setup(); await s.playback.toggle({ agreementId, assetId, durationMs: 4200 });
  expect(s.service.playback.mock.calls[0][0]).toEqual({ agreementId, assetId });
});
it('the end of the message returns to silence and removes the temporary file and the native player', async () => {
  const s = setup(); await s.playback.toggle(target); const file = s.files.log.written[0], releasedBefore = s.player.state.released;
  s.player.finish(); await new Promise(resolve => setImmediate(resolve));
  expect(s.playback.getSnapshot()).toMatchObject({ assetId: null, status: 'idle', positionMs: 0 }); expect(s.files.log.removed).toContain(file); expect(s.files.files.size).toBe(0);
  expect(s.player.state.released).toBeGreaterThan(releasedBefore); expect(s.arbiter.current()).toBeNull(); expect(s.player.listenerCount()).toBe(0);
});
it('starting another message removes the previous temporary file first and only one message ever owns the speaker', async () => {
  const s = setup(); await s.playback.toggle(target); const first = s.files.log.written[0];
  await s.playback.toggle(other);
  expect(s.files.log.removed).toContain(first); expect(s.files.files.size).toBe(1); expect(s.playback.getSnapshot()).toMatchObject({ assetId: otherAsset, status: 'playing', durationMs: 9000 });
  expect(s.service.playback).toHaveBeenCalledTimes(2);
});
it('an explicit stop and a dispose release everything and forget the message', async () => {
  const s = setup(); await s.playback.toggle(target); await s.playback.stop();
  expect(s.playback.getSnapshot()).toMatchObject({ assetId: null, status: 'idle' }); expect(s.files.files.size).toBe(0);
  await s.playback.toggle(target); await s.playback.dispose();
  expect(s.playback.getSnapshot().status).toBe('idle'); expect(s.files.files.size).toBe(0); expect(s.arbiter.current()).toBeNull();
});
it.each([
  ['a message the server no longer has', () => ({ ok: false as const, kod: 'MEDIA_NOT_FOUND', poruka: 'x' }), 'PLAYBACK_UNAVAILABLE'],
  ['a refusal without a specific reason', () => ({ ok: false as const, kod: 'MEDIA_UNAVAILABLE', poruka: 'x' }), 'PLAYBACK_UNAVAILABLE'],
  ['a read whose outcome was never confirmed', () => ({ ok: false as const, kod: 'AGREEMENT_VOICE_UNCONFIRMED', poruka: 'x' }), 'PLAYBACK_FAILED'],
])('%s is a plain error, leaves no file and allows a fresh try', async (_name, answer, code) => {
  const s = setup(); s.service.playback.mockResolvedValueOnce(answer() as never);
  await s.playback.toggle(target);
  expect(s.playback.getSnapshot()).toMatchObject({ assetId, status: 'error', error: { code } }); expect(s.files.files.size).toBe(0); expect(s.arbiter.current()).toBeNull();
  await s.playback.toggle(target); expect(s.playback.getSnapshot().status).toBe('playing'); expect(s.service.playback).toHaveBeenCalledTimes(2);
});
it('a file that cannot be written or a player that cannot load or play fails the same plain way and cleans up', async () => {
  const write = setup(); write.files.state.writeError = true; await write.playback.toggle(target);
  expect(write.playback.getSnapshot()).toMatchObject({ status: 'error', error: { code: 'PLAYBACK_FAILED' } });
  const load = setup(); load.player.state.loadError = true; await load.playback.toggle(target);
  expect(load.playback.getSnapshot().status).toBe('error'); expect(load.files.files.size).toBe(0);
  const play = setup(); play.player.state.playError = true; await play.playback.toggle(target);
  expect(play.playback.getSnapshot().status).toBe('error'); expect(play.files.files.size).toBe(0); expect(play.arbiter.current()).toBeNull();
});
it('a late answer after the account changed or another message was chosen never plays and leaves no file', async () => {
  const s = setup(); let release!: () => void;
  s.service.playback.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ ok: true as const, podatak: { assetId, bytes, contentType: 'audio/mp4' as const } }); }));
  const first = s.playback.toggle(target); await new Promise(resolve => setImmediate(resolve));
  s.live.current = false; release(); await first;
  expect(s.player.state.calls).not.toContain('play'); expect(s.files.files.size).toBe(0);
  const b = setup(); let free!: () => void;
  b.service.playback.mockImplementationOnce(() => new Promise(resolve => { free = () => resolve({ ok: true as const, podatak: { assetId, bytes, contentType: 'audio/mp4' as const } }); }));
  const slow = b.playback.toggle(target); await new Promise(resolve => setImmediate(resolve));
  await b.playback.toggle(other); free(); await slow;
  expect(b.playback.getSnapshot()).toMatchObject({ assetId: otherAsset, status: 'playing' }); expect(b.files.files.size).toBe(1);
});
it('the speaker is taken over by a recording: playback stops and its file is removed', async () => {
  const s = setup(); await s.playback.toggle(target);
  await s.arbiter.claim('recording', () => undefined);
  expect(s.playback.getSnapshot().status).toBe('idle'); expect(s.files.files.size).toBe(0);
});
