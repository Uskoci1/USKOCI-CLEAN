/** Bounded provider response. Only the top-level assistantMessage becomes UI text. */
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

const schemaTypes: Record<string, string> = {
  OBJECT: 'object', ARRAY: 'array', STRING: 'string', NUMBER: 'number', INTEGER: 'integer', BOOLEAN: 'boolean', NULL: 'null',
};

function jsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonSchema);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = key === 'type' && typeof item === 'string' && schemaTypes[item]
      ? schemaTypes[item]
      : jsonSchema(item);
  }
  return result;
}

function gemini38Body(raw: string): string {
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('AI_STREAM_INVALID');
  const generation = payload.generationConfig;
  if (!generation || typeof generation !== 'object' || Array.isArray(generation)) throw new Error('AI_STREAM_INVALID');
  const mime = generation.responseMimeType;
  const schema = generation.responseSchema;
  delete generation.temperature;
  delete generation.topP;
  delete generation.topK;
  delete generation.responseMimeType;
  delete generation.responseSchema;
  generation.thinkingConfig = { thinkingLevel: 'low' };
  if (mime !== undefined || schema !== undefined) {
    if (mime !== 'application/json' || !schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('AI_STREAM_INVALID');
    generation.responseFormat = { text: { mimeType: mime, schema: jsonSchema(schema) } };
  }
  return JSON.stringify(payload);
}

/**
 * Stabilization path for Gemini 3.8: use one bounded generateContent request,
 * then expose the validated assistantMessage to the existing client SSE shell as
 * a single delta. This avoids a second provider call after an uncertain stream
 * outcome and keeps the durable turn/receipt semantics unchanged.
 */
export async function streamGeminiTask(input: {
  url: string; key: string; body: string; signal?: AbortSignal; onText: (delta: string) => void;
}): Promise<string> {
  const controller = new AbortController(), stop = () => controller.abort();
  const timeout = setTimeout(stop, 12000);
  input.signal?.addEventListener('abort', stop, { once: true });
  if (input.signal?.aborted) stop();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const providerBody = gemini38Body(input.body);
    const providerUrl = input.url.replace(/:streamGenerateContent\?alt=sse$/, ':generateContent');
    if (providerUrl === input.url) throw new Error('AI_STREAM_INVALID');
    const response = await fetch(providerUrl, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'x-goog-api-key': input.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: providerBody,
    });
    if (!response.ok) {
      console.error('GEMINI_GENERATE_HTTP_FAILED', response.status);
      void response.body?.cancel().catch(() => undefined);
      throw new Error('AI_STREAM_UNAVAILABLE');
    }
    if (response.redirected || !response.body || !response.headers.get('content-type')?.includes('application/json')) {
      console.error('GEMINI_GENERATE_PROTOCOL_FAILED');
      void response.body?.cancel().catch(() => undefined);
      throw new Error('AI_STREAM_UNAVAILABLE');
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '', total = 0;
    while (true) {
      const part = await reader.read();
      if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 524288) throw new Error('AI_STREAM_TOO_LARGE');
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    const envelope = JSON.parse(text);
    if (envelope?.error || envelope?.promptFeedback?.blockReason) throw new Error('AI_STREAM_REJECTED');
    if (!Array.isArray(envelope?.candidates) || envelope.candidates.length !== 1) throw new Error('AI_STREAM_INVALID');
    const candidate = envelope.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new Error('AI_STREAM_INCOMPLETE');
    let raw = '';
    for (const part of candidate.content?.parts ?? []) {
      if (part.thought === true) continue;
      if (typeof part.text !== 'string') throw new Error('AI_STREAM_INVALID');
      raw += part.text;
      if (raw.length > 131072) throw new Error('AI_STREAM_TOO_LARGE');
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed?.assistantMessage !== 'string' || !parsed.assistantMessage) throw new Error('AI_STREAM_INCOMPLETE');
    const assistant = assistantPrefix(raw);
    if (!assistant || assistant !== parsed.assistantMessage) throw new Error('AI_STREAM_INCOMPLETE');
    if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
    input.onText(assistant);
    return raw;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', stop);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}
