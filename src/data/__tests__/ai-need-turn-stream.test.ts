import { createAiTurnStreamDecoder } from '../aiNeedTurnStream';
const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const conversationId=id(1), clientRequestId=id(2), turnId=id(3), attemptId=id(4);
const event=(sequence:number, kind:string, extra:object={})=>({ conversationId, clientRequestId, turnId, attemptId, sequence, kind, ...extra });
function fixture(){ let current=true; const onText=jest.fn(); const decoder=createAiTurnStreamDecoder({conversationId,clientRequestId,current:()=>current,onText});
  return {...decoder,onText,retire:()=>{current=false;}}; }
it('renders only ordered text deltas and yields the actual final DTO, never text as receipt',()=>{
  const f=fixture(), receipt={conversationId,clientRequestId,turnId,state:'SUCCEEDED'};
  f.accept(event(1,'accepted')); f.accept(event(2,'text_delta',{text:'Zdravo, '})); expect(f.result()).toBeUndefined();
  f.accept(event(3,'text_delta',{text:'čujem te.'})); f.accept(event(4,'final',{turn:receipt}));
  expect(f.onText.mock.calls).toEqual([['Zdravo, '],['čujem te.']]); expect(f.result()).toBe(receipt);
  expect(()=>f.accept(event(5,'text_delta',{text:'late'}))).toThrow();
});
it.each([
  {sequence:4}, {conversationId:id(9)}, {clientRequestId:id(9)}, {turnId:id(9)}, {attemptId:id(9)},
  {kind:'accepted'}, {privateAddress:'PRIVATE'}, {text:'\u0000'}, {text:'x'.repeat(1501)},
])('rejects wrong ownership, attempt, order, extras and unbounded delta %#',patch=>{
  const f=fixture(); f.accept(event(1,'accepted')); expect(()=>f.accept({...event(2,'text_delta',{text:'safe'}),...patch})).toThrow(); expect(f.onText).not.toHaveBeenCalled();
});
it('does not emit any retained event after focus/account retirement',()=>{
  const f=fixture();f.accept(event(1,'accepted')); f.retire(); expect(()=>f.accept(event(2,'text_delta',{text:'late'}))).toThrow();expect(f.onText).not.toHaveBeenCalled();
});
it('fixed safe error has no receipt or reflected text and truncation is unknown',()=>{
  const f=fixture();f.accept(event(1,'accepted'));f.accept(event(2,'safe_error',{code:'AI_TURN_NOT_CONFIRMED'}));expect(f.result()).toBeUndefined();expect(f.onText).not.toHaveBeenCalled();
  const other=fixture();other.accept(event(1,'accepted'));other.accept(event(2,'text_delta',{text:'prefix'}));expect(other.result()).toBeUndefined();
});
