import type { AiNeedContext, AiNeedResult, AiNeedV2Conversation, AiNeedV2Fact, AiNeedV2Port } from '../contracts/aiNeedV2';

type PendingTurn = Readonly<{ body: string; beforeIds: readonly string[]; observed: boolean }>;
export type AiNeedFlowState = Readonly<{
  conversationId: string | null; conversation: AiNeedV2Conversation | null;
  busy: 'open' | 'read' | 'send' | 'confirm' | 'correct' | 'save' | null;
  fresh: boolean; error: string | null; errorCode: string | null; draft: string;
  pendingTurn: PendingTurn | null; pendingSave: boolean; savedNeedId: string | null;
  reviewPendingCount: number;
}>;
type Options = { accountId: string; conversationId?: string; port: AiNeedV2Port; isCurrent(): boolean; newId(): string };
const fingerprint = (conversation: AiNeedV2Conversation) => JSON.stringify(conversation.facts
  .filter(fact => fact.status === 'CONFIRMED').map(fact => [fact.id, fact.key, fact.value]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

/** Focus-owned command orchestration. Server review/RPCs retain domain authority. */
export function createAiNeedFlow(input: Options) {
  const options = { ...input };
  let active = false, generation = 0, openAttempted = false;
  let lock: symbol | null = null;
  let pendingSave: { key: string; fingerprint: string } | null = null;
  let state: AiNeedFlowState = { conversationId: options.conversationId ?? null, conversation: null,
    busy: null, fresh: false, error: null, errorCode: null, draft: '', pendingTurn: null, pendingSave: false, savedNeedId: null, reviewPendingCount: 0 };
  const listeners = new Set<() => void>();
  const current = () => active && options.isCurrent();
  const publish = (patch: Partial<AiNeedFlowState>) => {
    if (!current()) return;
    state = Object.freeze({ ...state, ...patch }); listeners.forEach(listener => listener());
  };
  const context = (): AiNeedContext => {
    const captured = generation;
    return Object.freeze({ accountId: options.accountId, isCurrent: () => current() && generation === captured });
  };
  async function run<T>(busy: AiNeedFlowState['busy'], action: (owner: AiNeedContext) => Promise<T>): Promise<T | undefined> {
    if (!current() || lock) return;
    const token = Symbol(); lock = token;
    const owner = context(); publish({ busy, error: null, errorCode: null });
    try { return await action(owner); }
    catch { if (owner.isCurrent()) publish({ fresh: false, error: 'Radnja nije potvrđena. Proverite vezu i osvežite nacrt.' }); }
    finally { if (lock === token) { lock = null; if (owner.isCurrent()) publish({ busy: null }); } }
  }
  async function read(owner: AiNeedContext) {
    const id = state.conversationId;
    if (!id || !owner.isCurrent()) return null;
    publish({ fresh: false });
    const conversation = await options.port.loadConversation(id, owner);
    if (!owner.isCurrent()) return null;
    if (!conversation) { publish({ conversation: null, error: 'Nacrt nije dostupan ovom nalogu.' }); return null; }
    let pendingTurn = state.pendingTurn;
    if (pendingTurn) pendingTurn = Object.freeze({ ...pendingTurn, observed: conversation.messages.some(message =>
      !message.fromAi && message.body.trim() === pendingTurn!.body && !pendingTurn!.beforeIds.includes(message.id)) });
    // This only reports what the owner can now see. Matching text is not a
    // fabricated receipt for a non-idempotent Edge request.
    publish({ conversation, fresh: true, pendingTurn, error: null,
      reviewPendingCount: conversation.facts.filter(fact => fact.status !== 'CONFIRMED').length,
      savedNeedId: conversation.review.boundNeedId ?? state.savedNeedId });
    return conversation;
  }
  async function open(owner: AiNeedContext) {
    openAttempted = true;
    const result = await options.port.openConversation(owner);
    if (!owner.isCurrent()) return;
    if (!result.ok) { publish({ error: result.poruka }); return; }
    publish({ conversationId: result.podatak.conversationId });
    await read(owner);
  }
  async function reviewedMutation(kind: 'confirm' | 'correct', factId: string,
    apply: (owner: AiNeedContext) => Promise<AiNeedResult<unknown>>) {
    if (pendingSave || state.pendingTurn) return;
    return run(kind, async owner => {
      const reviewed = await read(owner);
      if (!reviewed || !owner.isCurrent()) return;
      if (reviewed.review.boundNeedId || reviewed.safety === 'BLOCK' || !reviewed.facts.some(fact => fact.id === factId)) {
        publish({ error: 'Nacrt se promenio. Proverite trenutne podatke pre izmene.' }); return;
      }
      const result = await apply(owner);
      if (!owner.isCurrent()) return;
      // Reload after both a receipt and an uncertain result. No correction or
      // confirmation is replayed automatically against a superseded fact.
      await read(owner);
      if (owner.isCurrent() && !result.ok) publish({ error: result.poruka });
      return result.ok;
    });
  }
  const model = {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isCurrent: current,
    start() {
      active = true; generation++;
      if (state.conversationId) return model.refresh();
      if (!openAttempted) return run('open', open);
      publish({ error: 'Otvaranje razgovora nije potvrđeno. Pokušajte ponovo.' });
      return Promise.resolve();
    },
    stop() {
      active = false; generation++; lock = null;
      state = Object.freeze({ ...state, busy: null, fresh: false });
    },
    refresh() { return run(state.conversationId ? 'read' : 'open', async owner => {
      if (state.conversationId) await read(owner); else await open(owner);
    }); },
    setDraft(draft: string) { if (current() && !lock && !state.pendingTurn) publish({ draft }); },
    acknowledgeObservedTurn() {
      if (current() && !lock && state.fresh && state.pendingTurn?.observed) publish({ pendingTurn: null, draft: '', error: null });
    },
    send() {
      const body = state.draft.trim();
      if (!body || !state.fresh || !state.conversationId || !state.conversation || state.pendingTurn || pendingSave ||
        state.conversation.safety === 'BLOCK' || state.conversation.review.boundNeedId) return Promise.resolve();
      return run('send', async owner => {
        const id = state.conversationId!;
        const pending = Object.freeze({ body, beforeIds: Object.freeze(state.conversation!.messages.map(message => message.id)), observed: false });
        publish({ pendingTurn: pending });
        let result: AiNeedResult<{ proposed: number }>;
        try { result = await options.port.sendMessage(id, body, owner); }
        catch { result = { ok: false, kod: 'AI_OUTCOME_UNKNOWN', poruka: 'Slanje nije potvrđeno. Osvežite razgovor; poruka se ne šalje ponovo automatski.', outcome: 'unknown' }; }
        if (!owner.isCurrent()) return;
        if (result.ok) publish({ pendingTurn: null, draft: '' });
        else if (result.outcome === 'rejected') publish({ pendingTurn: null, error: result.poruka, errorCode: result.kod });
        else publish({ error: result.poruka, errorCode: result.kod });
        if (result.ok) await read(owner);
      });
    },
    confirm(fact: AiNeedV2Fact) {
      const id = fact.id;
      return reviewedMutation('confirm', id, owner => options.port.confirmFact(id, owner));
    },
    correct(fact: AiNeedV2Fact, value: unknown, display: string) {
      const id = fact.id, captured = JSON.parse(JSON.stringify(value)), text = display;
      return reviewedMutation('correct', id, owner => options.port.correctFact(id, captured, text, owner));
    },
    save() {
      if (state.pendingTurn) return Promise.resolve();
      return run('save', async owner => {
        const reviewed = await read(owner);
        if (!reviewed || !owner.isCurrent()) return;
        if (reviewed.review.boundNeedId) return;
        if (!reviewed.review.canSaveDraft || reviewed.safety === 'BLOCK') { publish({ error: 'Proverite i potvrdite obavezne podatke pre čuvanja.' }); return; }
        // Human review completeness: optional proposed capabilities must not
        // silently disappear from the server's confirmed-facts materialization.
        if (reviewed.facts.some(fact => fact.status !== 'CONFIRMED')) {
          publish({ error: 'Još ima predloga koje niste pregledali. Potvrdite ili ispravite svaki pre čuvanja.' }); return;
        }
        const hash = fingerprint(reviewed);
        if (pendingSave && pendingSave.fingerprint !== hash) { publish({ error: 'Podaci su se promenili dok ishod čuvanja nije poznat. Osvežite sačuvani nacrt.' }); return; }
        if (!pendingSave) pendingSave = Object.freeze({ key: options.newId(), fingerprint: hash });
        publish({ pendingSave: true });
        const result = await options.port.saveDraft(reviewed.conversationId, pendingSave.key, owner);
        if (!owner.isCurrent()) return;
        if (result.ok) {
          pendingSave = null; publish({ pendingSave: false, savedNeedId: result.podatak.needId });
        } else {
          if (result.outcome === 'rejected') { pendingSave = null; publish({ pendingSave: false }); }
          publish({ error: result.poruka, fresh: false });
        }
      });
    },
  };
  return model;
}
