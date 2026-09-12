import { uuid, record, sameId } from './serverReceipt';

export type AiTurnStreamOptions = { onText: (delta: string) => void; signal?: AbortSignal };

/** Ordered, bounded stream events are ephemeral. Only the terminal DTO may be
 * decoded by the existing owned-turn receipt decoder. */
export function createAiTurnStreamDecoder(input: {
  conversationId: string; clientRequestId: string; current: () => boolean; onText: (delta: string) => void;
}) {
  let sequence = 0, attempt: string | null = null, turn: string | null = null;
  let text = '', terminal = false, receipt: unknown = undefined;
  const accept = (raw: unknown) => {
    const e = record(raw);
    if (!input.current() || terminal || !e || !sameId(e.conversationId, input.conversationId)
      || !sameId(e.clientRequestId, input.clientRequestId) || !uuid(e.turnId) || !uuid(e.attemptId)
      || e.sequence !== sequence + 1) throw new Error('AI_STREAM_INVALID');
    const fields = ['conversationId', 'clientRequestId', 'turnId', 'attemptId', 'sequence', 'kind'];
    const extras = e.kind === 'accepted' ? [] : e.kind === 'text_delta' ? ['text'] : e.kind === 'final' ? ['turn'] : e.kind === 'safe_error' ? ['code'] : null;
    if (!extras || Object.keys(e).length !== fields.length + extras.length
      || [...fields, ...extras].some(key => !Object.hasOwn(e, key))) throw new Error('AI_STREAM_INVALID');
    if (!sequence) {
      if (e.kind !== 'accepted') throw new Error('AI_STREAM_INVALID');
      attempt = e.attemptId; turn = e.turnId;
    } else if (e.kind === 'accepted' || !attempt || !turn || !sameId(e.attemptId, attempt) || !sameId(e.turnId, turn)) throw new Error('AI_STREAM_INVALID');
    sequence++;
    if (e.kind === 'text_delta') {
      if (typeof e.text !== 'string' || !e.text || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(e.text)
        || text.length + e.text.length > 1500) throw new Error('AI_STREAM_INVALID');
      text += e.text; input.onText(e.text);
    } else if (e.kind === 'final') {
      const result = record(e.turn);
      if (!result || !turn || result.state !== 'SUCCEEDED' || !sameId(result.turnId, turn)) throw new Error('AI_STREAM_INVALID');
      receipt = e.turn; terminal = true;
    } else if (e.kind === 'safe_error') {
      // Never reflect provider, SQL, Auth or arbitrary event text in the UI.
      terminal = true;
      if (e.code !== 'AI_TURN_NOT_CONFIRMED') throw new Error('AI_STREAM_INVALID');
    }
  };
  return { accept, result: () => terminal ? receipt : undefined };
}

export async function requestAiTurnStream(input: AiTurnStreamOptions & {
  url: string; anonKey: string; accessToken: string; conversationId: string; clientRequestId: string;
  text: string; current: () => boolean; deadline: number;
  endpoint?: 'uskoci-ai-interview' | 'uskoci-worker-interview';
}): Promise<{ data: unknown; error: { message: string } | null }> {
  const abort = new AbortController(), stop = () => abort.abort();
  const timer = setTimeout(stop, Math.max(0, input.deadline - Date.now()));
  input.signal?.addEventListener('abort', stop, { once: true });
  const current = () => !abort.signal.aborted && !input.signal?.aborted && Date.now() < input.deadline && input.current();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (!current()) throw new Error('AI_STREAM_STOPPED');
    const { fetch } = await import('expo/fetch');
    if (!current()) throw new Error('AI_STREAM_STOPPED');
    const response = await fetch(input.url + '/functions/v1/' + (input.endpoint ?? 'uskoci-ai-interview'), {
      method: 'POST', signal: abort.signal, redirect: 'error',
      headers: { Authorization: 'Bearer ' + input.accessToken, apikey: input.anonKey, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ conversationId: input.conversationId, text: input.text, clientRequestId: input.clientRequestId }),
    });
    if (!current() || response.redirected || !response.body) throw new Error('AI_STREAM_STOPPED');
    if (!response.ok && response.status !== 409) {
      void response.body.cancel().catch(() => undefined);
      return { data: null, error: { message: response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'AI_ACCESS_DENIED'
        : response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_SERVICE_UNAVAILABLE' } };
    }
    const contentType = response.headers.get('content-type') ?? '';
    const streaming = contentType.includes('text/event-stream');
    if (!streaming && !contentType.includes('application/json')) throw new Error('AI_STREAM_INVALID');
    const declared = response.headers.get('content-length'), maximum = streaming ? 262144 : 8192;
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new Error('AI_STREAM_INVALID');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const events = createAiTurnStreamDecoder({ ...input, current });
    let buffer = '', total = 0;
    const event = (body: string) => {
      const lines = body.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
      if (lines.length) events.accept(JSON.parse(lines.join('\n')));
    };
    while (true) {
      const part = await reader.read();
      if (!current()) throw new Error('AI_STREAM_STOPPED');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximum) throw new Error('AI_STREAM_INVALID');
      buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
      if (streaming) {
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) { event(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
        if (buffer.length > 16384) throw new Error('AI_STREAM_INVALID');
      }
    }
    buffer += decoder.decode();
    if (declared !== null && Number(declared) !== total) throw new Error('AI_STREAM_INVALID');
    if (!current()) throw new Error('AI_STREAM_STOPPED');
    if (!streaming) return { data: JSON.parse(buffer), error: null }; // Existing claim replay/terminal envelope.
    if (buffer.trim()) event(buffer);
    return { data: events.result(), error: null };
  } catch {
    return { data: undefined, error: { message: 'AI_TURN_SEND_UNCONFIRMED' } };
  } finally {
    clearTimeout(timer); input.signal?.removeEventListener('abort', stop); abort.abort();
    void reader?.cancel().catch(() => undefined);
  }
}
