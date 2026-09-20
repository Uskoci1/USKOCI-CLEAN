jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockOwner}));
import { agreementCurrentLocationService as service,parseLocationJournal,pointValid,type LocationJournal } from '../agreementCurrentLocationService';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',ID='20000000-0000-4000-8000-000000000001',KEY='30000000-0000-4000-8000-000000000001';
const mockRpc=jest.fn();let mockOwner={user:{id:A},accountRevision:5};const account={accountId:A,accountRevision:5};
const journal:LocationJournal={version:1,agreementId:ID,agreementVersion:7,clientRequestId:KEY,kind:'SHARE',inputSha256:'a'.repeat(64)};
const point={latitude:45.25,longitude:19.85,accuracyMeters:9,capturedAt:'2026-09-13T12:00:00.123456Z'},sharedAt='2026-09-13T12:00:01.123456Z';
const context=()=>({agreementId:ID,agreementVersion:7,role:'WORKER',canShare:true,canRequest:false,requestedAt:null,point:{...point,sharedAt},authoritative:true});
const receipt=(patch={})=>({agreementId:ID,agreementVersion:7,clientRequestId:KEY,kind:'SHARE',inputSha256:'a'.repeat(64),state:'COMMITTED',recordedAt:sharedAt,authoritative:true,...patch});
const response=(data:unknown)=>({data,error:null});
beforeEach(()=>{mockRpc.mockReset();mockOwner={user:{id:A},accountRevision:5};});
it('decodes only the owned current location context and preserves timestamp precision',async()=>{
 mockRpc.mockResolvedValue(response(context()));expect(await service.read(ID,account)).toEqual({ok:true,podatak:context()});
 expect(mockRpc).toHaveBeenCalledWith('rpc_read_agreement_current_location',{p_expected_user_id:A,p_agreement_id:ID});
});
it.each([{agreementId:B},{agreementVersion:0},{role:'PEER'},{canRequest:true},{authoritative:false},{provider:'secret'},
 {point:{...point,sharedAt,secret:'PRIVATE'}},{point:{...point,latitude:91,sharedAt}},{point:{...point,accuracyMeters:-1,sharedAt}},
 {point:{...point,capturedAt:'not-a-time',sharedAt}},{requestedAt:'yesterday'},
 {canShare:false,canRequest:false},{role:'REQUESTER',canShare:true,canRequest:false}])('rejects forged, extra or incompatible read fields %#',async patch=>{
 mockRpc.mockResolvedValue(response({...context(),...patch}));expect(await service.read(ID,account)).toMatchObject({ok:false,kod:'LOCATION_RECEIPT_INVALID'});
});
it('accepts a closed context only when it reveals no previous point or request',async()=>{
 const closed={...context(),canShare:false,point:null,requestedAt:null};mockRpc.mockResolvedValue(response(closed));expect(await service.read(ID,account)).toEqual({ok:true,podatak:closed});
 mockRpc.mockResolvedValue(response({...closed,requestedAt:sharedAt}));expect((await service.read(ID,account)).ok).toBe(false);
});
it.each([{latitude:NaN},{latitude:91},{longitude:Infinity},{longitude:-181},{accuracyMeters:-0.1},{capturedAt:'bad'},{secret:'EXTRA'}])('rejects malformed point shape %#',patch=>{
 expect(pointValid({...point,...patch})).toBe(false);
});
it('requires exactly six opaque journal fields, exact route identity and bounded JSON',()=>{
 expect(parseLocationJournal(JSON.stringify(journal),ID)).toEqual(journal);
 for(const patch of [{version:2},{agreementId:B},{agreementVersion:0},{clientRequestId:'bad'},{kind:'TRACK'},{inputSha256:'A'.repeat(64)},{point},{capturedAt:point.capturedAt}])
  expect(()=>parseLocationJournal(JSON.stringify({...journal,...patch}),ID)).toThrow('LOCATION_JOURNAL_INVALID');
 expect(()=>parseLocationJournal('x'.repeat(1025),ID)).toThrow('LOCATION_JOURNAL_INVALID');
});
it('reads exact unknown identity without point, write, new key or mutable request revision',async()=>{
 mockRpc.mockResolvedValue(response({found:false,command:null}));expect(await service.recover(journal,account)).toEqual({ok:true,podatak:{found:false,command:null}});
 expect(mockRpc).toHaveBeenCalledTimes(1);expect(mockRpc).toHaveBeenCalledWith('rpc_read_agreement_location_command',{p_expected_user_id:A,p_agreement_id:ID,p_client_request_id:KEY});
 expect(JSON.stringify(mockRpc.mock.calls)).not.toMatch(/latitude|longitude|capturedAt/);
});
it.each([{agreementId:B},{agreementVersion:8},{clientRequestId:B},{kind:'REQUEST'},{inputSha256:'b'.repeat(64)},
 {state:'PROCESSING'},{recordedAt:'bad'},{authoritative:false},{point}])('rejects mismatched recovery and write confirmation %#',async patch=>{
 mockRpc.mockResolvedValue(response({found:true,command:receipt(patch)}));expect(await service.recover(journal,account)).toMatchObject({ok:false,kod:'LOCATION_RECEIPT_INVALID'});
 mockRpc.mockResolvedValue(response(receipt(patch)));expect(await service.write(journal,point,account)).toMatchObject({ok:false,kod:'LOCATION_RECEIPT_INVALID'});
});
it.each([{found:false,command:receipt()},{found:true,command:null},{found:1,command:null},{found:false,command:null,extra:1}])('rejects malformed readback union %#',async data=>{
 mockRpc.mockResolvedValue(response(data));expect((await service.recover(journal,account)).ok).toBe(false);
});
it.each(['COMMITTED','CANCELLED'])('sends explicit cancellation with no coordinates and accepts actual %s race result',async state=>{
 mockRpc.mockResolvedValue(response(receipt({state})));expect(await service.write(journal,null,account,true)).toMatchObject({ok:true,podatak:{state}});
 expect(mockRpc).toHaveBeenCalledWith('rpc_write_agreement_current_location',{p_expected_user_id:A,p_agreement_id:ID,p_agreement_version:7,p_client_request_id:KEY,
  p_kind:'SHARE',p_input_sha256:journal.inputSha256,p_point:null,p_cancel:true});expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('sends exactly one explicit measured point under its original opaque identity',async()=>{
 mockRpc.mockResolvedValue(response(receipt()));expect((await service.write(journal,point,account)).ok).toBe(true);
 expect(mockRpc.mock.calls[0][1]).toEqual({p_expected_user_id:A,p_agreement_id:ID,p_agreement_version:7,p_client_request_id:KEY,p_kind:'SHARE',p_input_sha256:journal.inputSha256,p_point:point,p_cancel:false});
});
it('fences account replacement before dispatch and ABA while waiting',async()=>{
 mockOwner={user:{id:B},accountRevision:6};expect(await service.read(ID,account)).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});expect(mockRpc).not.toHaveBeenCalled();
 mockOwner={user:{id:A},accountRevision:5};let resolve!:(value:unknown)=>void;mockRpc.mockReturnValue(new Promise(done=>{resolve=done;}));
 const pending=service.write(journal,point,account);mockOwner={user:{id:A},accountRevision:7};resolve(response(receipt()));expect(await pending).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
 expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('a bounded timeout is unknown and neither retries nor publishes a late receipt',async()=>{
 jest.useFakeTimers();try{let resolve!:(value:unknown)=>void;mockRpc.mockReturnValue(new Promise(done=>{resolve=done;}));
  const pending=service.write(journal,point,account);await jest.advanceTimersByTimeAsync(15_000);expect(await pending).toMatchObject({ok:false,kod:'LOCATION_UNCONFIRMED'});
  resolve(response(receipt()));await Promise.resolve();expect(mockRpc).toHaveBeenCalledTimes(1);expect(jest.getTimerCount()).toBe(0);
 }finally{jest.useRealTimers();}
});
it('sanitizes unrecognized server errors and preserves known permission refusal',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'private coordinates 45.25 and provider token'}});const failed=await service.write(journal,point,account);
 expect(failed).toMatchObject({ok:false,kod:'LOCATION_UNCONFIRMED'});expect(JSON.stringify(failed)).not.toMatch(/45\.25|provider token/);
 mockRpc.mockResolvedValue({data:null,error:{message:'LOCATION_NOT_AVAILABLE'}});expect(await service.read(ID,account)).toMatchObject({ok:false,kod:'LOCATION_NOT_AVAILABLE'});
});
