import { captureAgreementMessage, createAgreementMessageService } from '../agreementMessageClientService';
import type { AgreementMessageCommand } from '../../contracts/agreementMessages';

jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn(() => { throw new Error('Unexpected active RPC'); }) }));
const accountId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const command = (): AgreementMessageCommand => ({ accountId, agreementId, clientMessageId:'poruka_same_intent_123', body:'  Stižem uskoro.  ' });

it('bounds a stalled text send as an unknown outcome and keeps the same intent for recovery', async () => {
  jest.useFakeTimers();
  let release!: (value: { data: string; error: null }) => void;
  const rpc = jest.fn().mockImplementationOnce(() => new Promise(done => { release = done; }))
    .mockResolvedValue({ data: messageId, error: null });
  const service = createAgreementMessageService(rpc), intent = captureAgreementMessage(command());
  let outcome: unknown = null;
  const pending = service.send(intent).then(value => { outcome = value; }, error => { outcome = error; });
  try {
    await jest.advanceTimersByTimeAsync(15000);
    expect(outcome).toMatchObject({ code: 'UNAVAILABLE', message: 'UNAVAILABLE' });
    await expect(service.send(intent)).resolves.toEqual({ messageId });
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0]);
    release({ data: messageId, error: null }); await pending;
    expect(outcome).toMatchObject({ code: 'UNAVAILABLE' });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    release({ data: messageId, error: null }); await pending; jest.useRealTimers();
  }
});

it('captures an immutable trimmed intent without dispatch or caller ownership', () => {
  const input = { ...command() }; const captured = captureAgreementMessage(input);
  input.body = 'Changed'; input.accountId = messageId;
  expect(captured).toEqual({ ...command(), body:'Stižem uskoro.' });
  expect(Object.isFrozen(captured)).toBe(true);
});

it('uses the initiating actor and stable ID through retry after an unknown transport outcome', async () => {
  const rpc = jest.fn().mockRejectedValueOnce(new Error('socket includes sensitive details'))
    .mockResolvedValueOnce({data:messageId,error:null});
  const service = createAgreementMessageService(rpc); const intent = captureAgreementMessage(command());
  await expect(service.send(intent)).rejects.toMatchObject({code:'UNAVAILABLE',message:'UNAVAILABLE'});
  await expect(service.send(intent)).resolves.toEqual({messageId});
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[0]).toEqual(['rpc_send_agreement_message_v2', {
    p_expected_user_id:accountId,p_agreement_id:agreementId,p_client_message_id:intent.clientMessageId,p_body:'Stižem uskoro.',
  }]);
});

it('snapshots caller fields synchronously before awaiting a shared client', async () => {
  let resolve!: (value: {data:string;error:null}) => void;
  const rpc = jest.fn(() => new Promise<{data:string;error:null}>(done => { resolve=done; }));
  const input = {...command()}; const result=createAgreementMessageService(rpc).send(input);
  input.body='changed'; input.accountId=messageId; input.clientMessageId='different_key';
  expect(rpc.mock.calls[0]).toEqual(['rpc_send_agreement_message_v2', {
    p_expected_user_id:accountId,p_agreement_id:agreementId,p_client_message_id:'poruka_same_intent_123',p_body:'Stižem uskoro.',
  }]);
  resolve({data:messageId,error:null}); await expect(result).resolves.toEqual({messageId});
});

it.each([
  [{code:'28000'},'AUTH_CONTEXT_CHANGED'], [{code:'40001'},'CONFLICT'],
  [{code:'42501'},'NOT_AVAILABLE'], [{code:'P0002'},'NOT_AVAILABLE'],
  [{code:'P0001',message:'CHAT_NOT_AVAILABLE'},'READ_ONLY'],
  [{code:'P0001',message:'MESSAGE_REQUIRED'},'INVALID_MESSAGE'],
  [{code:'22001'},'INVALID_MESSAGE'], [{code:'22023'},'INVALID_MESSAGE'],
  [{code:'57014',message:'internal database detail'},'UNAVAILABLE'],
])('maps current server refusal safely %#', async (error, code) => {
  const rpc=jest.fn().mockResolvedValue({data:null,error});
  await expect(createAgreementMessageService(rpc).send(command())).rejects.toMatchObject({code,message:code});
  expect(rpc).toHaveBeenCalledTimes(1);
});

it.each([null, {}, '', 'not-a-message-id', 42, `${messageId}\n`])('rejects malformed acknowledgments %#', async data => {
  await expect(createAgreementMessageService(jest.fn().mockResolvedValue({data,error:null})).send(command()))
    .rejects.toMatchObject({code:'INVALID_RESPONSE'});
});

it.each([
  {accountId:''}, {agreementId:''}, {clientMessageId:'short'}, {clientMessageId:'a'.repeat(201)},
  {body:' \n '}, {body:'x'.repeat(2001)}, {body:'bad\0body'},
  {body:'lone\ud800'}, {body:'lone\udfff'}, {body:'\ud800\ud800'},
  {accountId:`${accountId}\n`}, {agreementId:`${agreementId}\n`},
  {clientMessageId:'valid_key\n'}, {clientMessageId:'valid_key\r'}, {clientMessageId:'valid_key\u2028'},
])('rejects malformed commands before dispatch %#', async patch => {
  const rpc=jest.fn(); await expect(createAgreementMessageService(rpc).send({...command(),...patch})).rejects.toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
});

it('preserves the server Unicode limit for 2000 astral code points', async () => {
  const rpc=jest.fn().mockResolvedValue({data:messageId,error:null});
  await expect(createAgreementMessageService(rpc).send({...command(),body:'😀'.repeat(2000)})).resolves.toEqual({messageId});
  await expect(createAgreementMessageService(rpc).send({...command(),body:'😀'.repeat(2001)})).rejects.toMatchObject({code:'INVALID_MESSAGE'});
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('captures an ordered photo-only command and validates every field of the canonical receipt', async () => {
  const assetIds = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
  const input = { ...command(), body: '', photos: { agreementVersion: 7, assetIds } };
  const frozen = captureAgreementMessage(input); assetIds.reverse();
  expect(frozen.photos!.assetIds).toEqual([...assetIds].reverse()); expect(Object.isFrozen(frozen.photos!.assetIds)).toBe(true);
  const receipt = { messageId, agreementId, agreementVersion: 7, clientMessageId: frozen.clientMessageId, body: '', assetIds: [...frozen.photos!.assetIds] };
  const rpc = jest.fn().mockResolvedValue({ data: receipt, error: null });
  await expect(createAgreementMessageService(rpc).send(frozen)).resolves.toEqual({ messageId });
  expect(rpc).toHaveBeenCalledWith('rpc_send_agreement_photo_message_v5', { p_expected_user_id: accountId,
    p_agreement_id: agreementId, p_expected_version: 7, p_client_message_id: frozen.clientMessageId, p_body: '', p_asset_ids: frozen.photos!.assetIds });
  for (const patch of [{ body: 'other' }, { agreementVersion: 8 }, { agreementId: messageId }, { clientMessageId: 'another_key' },
    { assetIds: [...frozen.photos!.assetIds].reverse() }, { extra: 'private' }]) {
    rpc.mockResolvedValue({ data: { ...receipt, ...patch }, error: null });
    await expect(createAgreementMessageService(rpc).send(frozen)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  }
});
it.each([[], ['invalid'], Array(7).fill(messageId), [messageId, messageId]].map(assetIds => ({ assetIds })))(
  'rejects invalid photo arrays before any new RPC %#', async ({ assetIds }) => {
  const rpc = jest.fn(); await expect(createAgreementMessageService(rpc).send({ ...command(), body: '', photos: { agreementVersion: 1, assetIds } }))
    .rejects.toMatchObject({ code: 'INVALID_MESSAGE' }); expect(rpc).not.toHaveBeenCalled();
});
it('bounds a lost photo receipt without automatic replay and preserves exact explicit retry', async () => {
  jest.useFakeTimers(); const input = { ...command(), photos: { agreementVersion: 3, assetIds: [messageId] } };
  const rpc = jest.fn().mockReturnValue(new Promise(() => {})), service = createAgreementMessageService(rpc);
  const pending = service.send(input).catch(error => error);
  await jest.advanceTimersByTimeAsync(15000); expect(await pending).toMatchObject({ code: 'UNAVAILABLE' }); expect(rpc).toHaveBeenCalledTimes(1);
  rpc.mockResolvedValue({ data: { messageId, agreementId, agreementVersion: 3, clientMessageId: input.clientMessageId, body: input.body.trim(), assetIds: [messageId] }, error: null });
  await expect(service.send(input)).resolves.toEqual({ messageId }); expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]); jest.useRealTimers();
});
