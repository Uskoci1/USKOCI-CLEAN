import { captureAgreementMessage, createAgreementMessageService } from '../agreementMessageClientService';
import type { AgreementMessageCommand } from '../../contracts/agreementMessages';

jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn(() => { throw new Error('Unexpected active RPC'); }) }));
const accountId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const command = (): AgreementMessageCommand => ({ accountId, agreementId, clientMessageId:'poruka_same_intent_123', body:'  Stižem uskoro.  ' });

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
