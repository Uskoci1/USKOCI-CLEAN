import { createAiTurnStreamDecoder } from '../aiNeedTurnStream';

const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const conversationId = id(1), clientRequestId = id(2), turnId = id(3), attemptId = id(4);
const event = (sequence: number, kind: string, extra: object = {}) => ({
  conversationId, clientRequestId, turnId, attemptId, sequence, kind, ...extra,
});

function decoder() {
  const onText = jest.fn();
  return { ...createAiTurnStreamDecoder({ conversationId, clientRequestId, current: () => true, onText }), onText };
}

describe('PKG-002 AI terminal identity', () => {
  it('rejects the original malformed Worker case: outer accepted attempt A but terminal DTO attempt B', () => {
    const stream = decoder();
    stream.accept(event(1, 'accepted'));
    expect(() => stream.accept(event(2, 'final', { turn: {
      conversationId, clientRequestId, turnId, attemptId: id(9), state: 'SUCCEEDED', retryAllowed: false, authoritative: true,
    } }))).toThrow('AI_STREAM_INVALID');
    expect(stream.result()).toBeUndefined();
  });

  it.each([
    { conversationId: id(9) },
    { clientRequestId: id(9) },
    { turnId: id(9) },
  ])('rejects terminal DTO identity that differs from the accepted stream %#', patch => {
    const stream = decoder();
    stream.accept(event(1, 'accepted'));
    expect(() => stream.accept(event(2, 'final', { turn: {
      conversationId, clientRequestId, turnId, state: 'SUCCEEDED', retryAllowed: false, receipt: null, ...patch,
    } }))).toThrow('AI_STREAM_INVALID');
  });

  it('keeps the legitimate Worker terminal DTO valid when its attempt matches', () => {
    const stream = decoder();
    const turn = { conversationId, clientRequestId, turnId, attemptId, state: 'SUCCEEDED', retryAllowed: false, authoritative: true };
    stream.accept(event(1, 'accepted'));
    stream.accept(event(2, 'final', { turn }));
    expect(stream.result()).toBe(turn);
  });

  it('keeps the legitimate Requester terminal DTO valid even though that contract has no attemptId field', () => {
    const stream = decoder();
    const turn = { conversationId, clientRequestId, state: 'SUCCEEDED', turnId, retryAllowed: false, receipt: null };
    stream.accept(event(1, 'accepted'));
    stream.accept(event(2, 'final', { turn }));
    expect(stream.result()).toBe(turn);
  });
});
