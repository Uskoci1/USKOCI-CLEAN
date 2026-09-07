import { createAiNeedFlow } from '../aiNeedFlow';
import { conversation, deferred, fact, id, port, uncertain } from './fixtures/ai-v2';
import type { AiNeedResult, AiNeedV2Conversation } from '../../contracts/aiNeedV2';
const tick = () => Promise.resolve();
function setup() { let current = true; const api = port(), newId = jest.fn(() => 'stable-request');
 const model = createAiNeedFlow({ accountId: id(1), conversationId: id(2), port: api, newId, isCurrent: () => current });
 return { api, model, newId, changeAccount: () => { current = false; } }; }
describe('actual AI flow controller', () => {
 it('captures one immutable send synchronously on double tap and clears only after receipt', async () => {
  const { api, model } = setup(); await model.start(); model.setDraft('  generic input  ');
  const reply = deferred<AiNeedResult<{ proposed: number }>>(); api.sendMessage.mockReturnValue(reply.promise);
  const first = model.send(); const second = model.send(); model.setDraft('replacement');
  expect(api.sendMessage).toHaveBeenCalledTimes(1); expect(api.sendMessage.mock.calls[0].slice(0,2)).toEqual([id(2), 'generic input']);
  expect(model.snapshot().draft).toBe('  generic input  ');
  reply.resolve({ok: true, podatak: {proposed: 1}}); await Promise.all([first,second]);
  expect(model.snapshot().draft).toBe(''); expect(model.snapshot().pendingTurn).toBeNull();
 });
 it('retains text and blocks blind replay after transport throw; refresh never sends', async () => {
  const { api, model } = setup(); await model.start(); model.setDraft('keep this text');
  api.sendMessage.mockRejectedValue(new Error('private transport payload')); await model.send();
  expect(model.snapshot().draft).toBe('keep this text'); expect(model.snapshot().pendingTurn).not.toBeNull();
  await model.send(); await model.refresh(); expect(api.sendMessage).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(model.snapshot())).not.toContain('private transport payload');
 });
 it('known no-persist refusal retains editable input and safe code for manual retry', async () => {
  const { api, model } = setup(); await model.start(); model.setDraft('generic');
  api.sendMessage.mockResolvedValueOnce({ok:false,kod:'AI_PROVIDER_NOT_CONFIGURED',poruka:'AI nije aktiviran.',outcome:'rejected'});
  await model.send(); expect(model.snapshot()).toMatchObject({draft:'generic',pendingTurn:null,errorCode:'AI_PROVIDER_NOT_CONFIGURED'});
  model.setDraft('corrected'); await model.send(); expect(api.sendMessage).toHaveBeenCalledTimes(2);
 });
 it('observed matching new owner message permits explicit continuation, never an invented receipt', async () => {
  const { api, model } = setup(); await model.start(); model.setDraft('generic'); api.sendMessage.mockResolvedValue(uncertain);
  await model.send(); model.acknowledgeObservedTurn(); expect(model.snapshot().pendingTurn).not.toBeNull();
  api.loadConversation.mockResolvedValue(conversation([], {messages:[{id:id(20),fromAi:false,body:'generic',safety:null,proposedFactIds:[]}]}));
  await model.refresh(); expect(model.snapshot().pendingTurn?.observed).toBe(true);
  model.acknowledgeObservedTurn(); expect(model.snapshot().pendingTurn).toBeNull(); expect(api.sendMessage).toHaveBeenCalledTimes(1);
 });
 it('pre-existing identical text is not mistaken for newly observed turn', async () => {
  const { api, model } = setup(); api.loadConversation.mockResolvedValue(conversation([], {messages:[{id:id(20),fromAi:false,body:'generic',safety:null,proposedFactIds:[]}]}));
  await model.start(); model.setDraft('generic'); api.sendMessage.mockResolvedValue(uncertain);
  await model.send(); await model.refresh(); expect(model.snapshot().pendingTurn?.observed).toBe(false);
 });
 it.each(['success','reject'] as const)('ignores late old-account read %s', async outcome => {
  const { api, model, changeAccount } = setup(); const read = deferred<AiNeedV2Conversation>();
  api.loadConversation.mockReturnValue(read.promise); const work = model.start(); changeAccount();
  outcome==='success' ? read.resolve(conversation()) : read.reject(new Error('late'));
  await work; expect(model.snapshot().conversation).toBeNull();
 });
 it('stop/start cannot publish old read over fresh generation', async () => {
  const { api, model } = setup(); const read = deferred<AiNeedV2Conversation>();
  api.loadConversation.mockReturnValueOnce(read.promise); const old = model.start(); model.stop();
  api.loadConversation.mockResolvedValue(conversation([fact('need.title','current')])); await model.start();
  read.resolve(conversation([fact('need.title','old')])); await old;
  expect(model.snapshot().conversation?.facts[0].value).toBe('current');
 });
 it('serializes correction and save; fresh corrected fact snapshot is saved after review', async () => {
  const { api, model } = setup(); await model.start();
  const reply = deferred<AiNeedResult<{newFactId:string}>>(); api.correctFact.mockReturnValue(reply.promise);
  const correction = model.correct(fact(), 'updated', 'updated'); await tick(); await tick();
  await model.save(); expect(api.saveDraft).not.toHaveBeenCalled();
  api.loadConversation.mockResolvedValue(conversation([fact('need.title','updated',{id:id(11)})]));
  reply.resolve({ok:true,podatak:{newFactId:id(11)}}); await correction; await model.save();
  expect(api.saveDraft).toHaveBeenCalledTimes(1);
 });
 it('fresh BLOCK or missing/superseded fact prevents correction and save', async () => {
  const { api, model } = setup(); await model.start();
  api.loadConversation.mockResolvedValue(conversation([], {safety:'BLOCK',review:{...conversation().review,safety:'BLOCK',canSaveDraft:false}}));
  await model.confirm(fact()); await model.save();
  expect(api.confirmFact).not.toHaveBeenCalled(); expect(api.saveDraft).not.toHaveBeenCalled();
 });
 it('fresh read failure disables writes until successful explicit refresh', async () => {
  const { api, model } = setup(); await model.start(); api.loadConversation.mockRejectedValueOnce(new Error('secret'));
  await model.save(); expect(model.snapshot().fresh).toBe(false); expect(api.saveDraft).not.toHaveBeenCalled();
  await model.refresh(); expect(model.snapshot().fresh).toBe(true);
 });
 it('optional vehicle proposal is exposed and never silently dropped or auto-confirmed', async () => {
  const { api, model } = setup(); api.loadConversation.mockResolvedValue(conversation([fact('need.required_vehicles',['van'],{status:'NEEDS_CONFIRMATION'})]));
  await model.start(); expect(model.snapshot().reviewPendingCount).toBe(1); await model.save();
  expect(api.saveDraft).not.toHaveBeenCalled(); expect(api.confirmFact).not.toHaveBeenCalled();
  expect(model.snapshot().error).toContain('predloga');
 });
 it('save unknown outcome retries same immutable key and blocks mutation meanwhile', async () => {
  const { api, model, newId } = setup(); await model.start(); api.saveDraft.mockResolvedValueOnce(uncertain);
  await model.save(); expect(model.snapshot().pendingSave).toBe(true);
  await model.correct(fact(),'changed','changed'); expect(api.correctFact).not.toHaveBeenCalled();
  await model.save(); expect(api.saveDraft.mock.calls.map(call=>call[1])).toEqual(['stable-request','stable-request']);
  expect(newId).toHaveBeenCalledTimes(1); expect(model.snapshot().savedNeedId).toBe(id(3));
 });
 it('unknown save with changed facts cannot silently reuse key for different command', async () => {
  const { api, model } = setup(); await model.start(); api.saveDraft.mockResolvedValueOnce(uncertain); await model.save();
  api.loadConversation.mockResolvedValue(conversation([fact('need.title','changed',{id:id(11)})])); await model.save();
  expect(api.saveDraft).toHaveBeenCalledTimes(1); expect(model.snapshot().pendingSave).toBe(true);
 });
 it('account change while fresh review is pending never invokes save', async () => {
  const { api, model, changeAccount } = setup(); await model.start(); const read = deferred<AiNeedV2Conversation>();
  api.loadConversation.mockReturnValue(read.promise); const work = model.save(); changeAccount(); read.resolve(conversation()); await work;
  expect(api.saveDraft).not.toHaveBeenCalled();
 });
 it('reconciles bound draft on refresh after lost receipt without issuing another save', async () => {
  const { api, model } = setup(); await model.start(); api.saveDraft.mockResolvedValueOnce(uncertain); await model.save();
  api.loadConversation.mockResolvedValue(conversation([], {review:{...conversation().review,boundNeedId:id(3)}}));
  await model.save(); expect(model.snapshot().savedNeedId).toBe(id(3)); expect(api.saveDraft).toHaveBeenCalledTimes(1);
 });
});

