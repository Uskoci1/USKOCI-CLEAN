/** Bounded provider stream. Only the top-level assistantMessage becomes UI text. */
function stringAt(input: string, start: number): { value: string; end: number; complete: boolean } {
  let value = '';
  for (let i = start + 1; i < input.length; i++) {
    const char = input[i];
    if (char === '"') return { value, end: i + 1, complete: true };
    if (char.charCodeAt(0) < 32) throw new Error('AI_STREAM_INVALID');
    if (char !== '\\') { value += char; continue; }
    if (++i >= input.length) return { value, end: input.length, complete: false };
    const escape = input[i];
    if (escape === 'u') {
      if (i + 4 >= input.length) return { value, end: input.length, complete: false };
      const digits = input.slice(i + 1, i + 5);
      if (!/^[a-f0-9]{4}$/i.test(digits)) throw new Error('AI_STREAM_INVALID');
      value += String.fromCharCode(parseInt(digits, 16)); i += 4;
    } else {
      const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (!(escape in escapes)) throw new Error('AI_STREAM_INVALID');
      value += escapes[escape];
    }
  }
  return { value, end: input.length, complete: false };
}

export function assistantPrefix(input: string): string {
  let depth = 0, key: string | null = null, expectingValue = false;
  for (let i = 0; i < input.length;) {
    const char = input[i];
    if (char === '"') {
      const parsed = stringAt(input, i);
      if (depth === 1 && expectingValue && key === 'assistantMessage') {
        let result = parsed.value;
        // A split surrogate cannot become a replacement glyph in a transport event.
        if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1);
        if (result.length > 1200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new Error('AI_STREAM_INVALID');
        return result;
      }
      if (!parsed.complete) return '';
      if (depth === 1 && !expectingValue) key = parsed.value;
      i = parsed.end; continue;
    }
    if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
    else if (depth === 1 && char === ':') expectingValue = true;
    else if (depth === 1 && char === ',') { key = null; expectingValue = false; }
    if (depth < 0) throw new Error('AI_STREAM_INVALID');
    i++;
  }
  return '';
}

export async function streamGeminiTask(input: {
  url: string; key: string; body: string; signal?: AbortSignal; onText: (delta: string) => void;
}): Promise<string> {
  const controller = new AbortController(), stop = () => controller.abort();
  const timeout = setTimeout(stop, 12000);
  input.signal?.addEventListener('abort', stop, { once: true });
  if (input.signal?.aborted) stop();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(input.url, { method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'x-goog-api-key': input.key, 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: input.body });
    if (!response.ok || response.redirected || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      void response.body?.cancel().catch(() => undefined); throw new Error('AI_STREAM_UNAVAILABLE');
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '', raw = '', emitted = '', total = 0, stopped = false;
    const event = (value: string) => {
      const lines = value.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
      if (!lines.length) return;
      const data = JSON.parse(lines.join('\n'));
      if (data.error || data.promptFeedback?.blockReason) throw new Error('AI_STREAM_REJECTED');
      if (!Array.isArray(data.candidates) || data.candidates.length > 1) throw new Error('AI_STREAM_INVALID');
      const candidate = data.candidates[0];
      if (!candidate) return;
      if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new Error('AI_STREAM_INCOMPLETE');
      if (candidate.finishReason === 'STOP') stopped = true;
      for (const part of candidate.content?.parts ?? []) {
        if (part.thought === true) continue;
        if (typeof part.text !== 'string') throw new Error('AI_STREAM_INVALID');
        raw += part.text;
        if (raw.length > 131072) throw new Error('AI_STREAM_TOO_LARGE');
        const safe = assistantPrefix(raw);
        if (!safe.startsWith(emitted)) throw new Error('AI_STREAM_INVALID');
        if (safe.length > emitted.length) {
          const delta = safe.slice(emitted.length); emitted = safe;
          if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
          input.onText(delta);
        }
      }
    };
    while (true) {
      const part = await reader.read();
      if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 524288) throw new Error('AI_STREAM_TOO_LARGE');
      buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) { event(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
      if (buffer.length > 131072) throw new Error('AI_STREAM_TOO_LARGE');
    }
    buffer += decoder.decode();
    if (buffer.trim()) event(buffer);
    if (!stopped || typeof JSON.parse(raw).assistantMessage !== 'string' || JSON.parse(raw).assistantMessage !== emitted) throw new Error('AI_STREAM_INCOMPLETE');
    return raw;
  } finally {
    clearTimeout(timeout); input.signal?.removeEventListener('abort', stop); controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}
