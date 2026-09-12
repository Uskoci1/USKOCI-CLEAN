// @ts-nocheck
// Native authenticated bounded audio proxy. Provider key never leaves this Edge boundary.
import { reserveAiTestBudget } from '../_shared/aiTestBudget.ts';
import { bridgeSpeech } from './proxy.ts';

const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const deny = (status: number, code: string) => new Response(JSON.stringify({ code }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function readBounded(url: string, headers: Record<string,string>, signal: AbortSignal, maxBytes: number) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, 5000);
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  try {
    const response = await fetch(url, { headers, signal: controller.signal, redirect: 'error' });
    if (!response.ok || !response.body) { void response.body?.cancel(); throw new Error('SPEECH_NOT_READY'); }
    const reader = response.body.getReader();
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > maxBytes) throw new Error('SPEECH_NOT_READY');
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode(); return JSON.parse(text);
    } finally { void reader.cancel().catch(() => undefined); }
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' || req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return deny(405, 'SPEECH_WEBSOCKET_REQUIRED');
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return deny(401, 'AUTH_REQUIRED');
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId')?.toLowerCase();
  const operationId = url.searchParams.get('operationId')?.toLowerCase();
  if ([...url.searchParams.keys()].length !== 2 || !uuid(conversationId) || !uuid(operationId)) return deny(400, 'SPEECH_REQUEST_INVALID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const providerKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  // Named operator acknowledgement of the approved paid service; no free-tier/personal-data assumption.
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !providerKey || Deno.env.get('USKOCI_GEMINI_PAID_TEST_ENABLED') !== 'true') {
    return deny(503, 'SPEECH_NOT_READY');
  }
  try {
    const headers = { apikey: anonKey, Authorization: authorization };
    const account = await readBounded(supabaseUrl + '/auth/v1/user', headers, req.signal, 65536);
    if (!uuid(account?.id)) return deny(401, 'AUTH_REQUIRED');
    const conversations = await readBounded(supabaseUrl + '/rest/v1/ai_conversations?id=eq.' + conversationId
      + '&select=id,account_id,status,purpose&limit=1', headers, req.signal, 4096);
    const conversation = Array.isArray(conversations) && conversations.length === 1 ? conversations[0] : null;
    if (!conversation || conversation.id !== conversationId || conversation.account_id !== account.id
      || conversation.status !== 'OPEN' || !['NEED_INTAKE','PROFILE'].includes(conversation.purpose)) return deny(404, 'CONVERSATION_NOT_FOUND');
    const budget = await reserveAiTestBudget({ supabaseUrl, serviceRoleKey, accountId: account.id, operationId, kind: 'STT', signal: req.signal });
    if (!budget.admitted || budget.replay) return deny(409, budget.code);
    if (req.signal.aborted) return deny(409, 'SPEECH_CANCELLED');
    const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: 30 });
    // Browser/native peer sends only our allowlisted audio protocol; it never controls this URL or setup.
    const upstream = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(providerKey));
    bridgeSpeech(socket, upstream, conversationId, operationId);
    return response;
  } catch { return deny(503, 'SPEECH_UNAVAILABLE'); }
});
