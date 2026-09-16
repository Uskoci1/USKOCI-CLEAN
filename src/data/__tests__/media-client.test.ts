import {mediaClientService as service,decodeMediaAsset,decodeTaskPhotos,type MediaAsset} from '../mediaClientService';
const OWNER='11111111-1111-4111-8111-111111111111',OTHER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CID='22222222-2222-4222-8222-222222222222',
 ASSET='33333333-3333-4333-8333-333333333333',KEY='44444444-4444-4444-8444-444444444444',PROFILE='55555555-5555-4555-8555-555555555555';
let mockSession={user:{id:OWNER},accountRevision:1};const mockRpc=jest.fn(),mockInvoke=jest.fn();
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockSession}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc,functions:{invoke:mockInvoke}})}));
const asset=(state:MediaAsset['state']='READY'):MediaAsset=>({assetId:ASSET,accountId:OWNER,scope:'TASK',conversationId:CID,profileId:null,clientRequestId:KEY,
 state,selected:true,ref:state==='READY'?`${OWNER}/v5/${ASSET}/${'a'.repeat(64)}.jpg`:null,sha256:state==='READY'?'a'.repeat(64):null,
 width:state==='READY'?1600:null,height:state==='READY'?800:null,byteSize:state==='READY'?120000:null,contentType:'image/jpeg',authoritative:true});
beforeEach(()=>{mockSession={user:{id:OWNER},accountRevision:1};mockRpc.mockReset();mockInvoke.mockReset();mockInvoke.mockResolvedValue({data:asset(),error:null});});
it('validates the exact fifteen-field READY receipt against immutable owner/asset/SHA path',()=>{
 expect(Object.keys(asset())).toHaveLength(15);expect(decodeMediaAsset(asset(),OWNER)).toEqual(asset());
 for(const patch of [{accountId:OTHER},{ref:'https://external.invalid/private.jpg'},{sha256:'b'.repeat(64)},{profileId:PROFILE},{width:1601},{url:'PRIVATE'}])
  expect(decodeMediaAsset({...asset(),...patch},OWNER)).toBeNull();
});
it('pending and failed assets never masquerade as viewable image bytes',()=>{
 for(const state of ['PROCESSING','STAGED','FAILED'] as const){expect(decodeMediaAsset(asset(state),OWNER)).toEqual(asset(state));
  expect(decodeMediaAsset({...asset(state),ref:asset().ref},OWNER)).toBeNull();}
});
it('upload transports the same UUID and bytes once without publishing or confirming fields',async()=>{
 const bytes=new ArrayBuffer(16);await expect(service.uploadTaskPhoto({conversationId:CID,clientRequestId:KEY,bytes,contentType:'image/png'})).resolves.toEqual({ok:true,podatak:asset()});
 expect(mockInvoke).toHaveBeenCalledTimes(1);expect(mockRpc).not.toHaveBeenCalled();
 expect(mockInvoke.mock.calls[0][1].body).toBe(bytes);expect(mockInvoke.mock.calls[0][1].headers['x-media-request-id']).toBe(KEY);
});
it('unknown upload recovery reads the durable same key without an implicit upload retry',async()=>{
 mockInvoke.mockRejectedValue(new Error('LOST_ACK'));await expect(service.uploadTaskPhoto({conversationId:CID,clientRequestId:KEY,bytes:new ArrayBuffer(16),contentType:'image/jpeg'})).resolves.toMatchObject({ok:false});
 mockRpc.mockResolvedValue({data:asset('STAGED'),error:null});await expect(service.readUploadCommand(KEY)).resolves.toMatchObject({ok:true,podatak:{state:'STAGED',clientRequestId:KEY}});
 expect(mockInvoke).toHaveBeenCalledTimes(1);expect(mockRpc).toHaveBeenCalledWith('rpc_read_media_upload',{p_client_request_id:KEY});
});
it('absent receipt stays an error and does not authorize generating a new upload',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'MEDIA_NOT_FOUND'}});await expect(service.readUploadCommand(KEY)).resolves.toMatchObject({ok:false,kod:'MEDIA_NOT_FOUND'});expect(mockInvoke).not.toHaveBeenCalled();
});
it('late upload result after account round trip is discarded',async()=>{
 mockInvoke.mockImplementation(async()=>{mockSession={user:{id:OWNER},accountRevision:3};return{data:asset(),error:null};});
 await expect(service.uploadTaskPhoto({conversationId:CID,clientRequestId:KEY,bytes:new ArrayBuffer(16),contentType:'image/jpeg'})).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
});
it('gallery rejects duplicate IDs, false readiness and private/foreign receipts',()=>{
 const gallery={conversationId:CID,accountId:OWNER,photos:[asset()],ready:true,authoritative:true};expect(decodeTaskPhotos(gallery,OWNER,CID)).toEqual(gallery);
 expect(decodeTaskPhotos({...gallery,photos:[asset(),asset()]},OWNER,CID)).toBeNull();
 expect(decodeTaskPhotos({...gallery,photos:[asset('STAGED')]},OWNER,CID)).toBeNull();
 expect(decodeTaskPhotos({...gallery,photos:[{...asset(),selected:false}]},OWNER,CID)).toBeNull();
});
it('apply avatar uses one asset ID and exact original CAS path, without calling upload or worker writer',async()=>{
 const receipt={profileId:PROFILE,accountId:OWNER,assetId:ASSET,avatarPath:asset().ref,saved:true,authoritative:true};mockRpc.mockResolvedValue({data:receipt,error:null});
 await expect(service.applyAvatar({assetId:ASSET,profileId:PROFILE,expectedAvatarPath:null})).resolves.toEqual({ok:true,podatak:receipt});
 expect(mockRpc).toHaveBeenCalledWith('rpc_apply_profile_avatar',{p_asset_id:ASSET,p_expected_avatar_path:null});expect(mockInvoke).not.toHaveBeenCalled();
});
it('avatar discard receipt must bind the requested asset and current owner',async()=>{
 const receipt={profileId:PROFILE,assetId:ASSET,accountId:OWNER,discarded:true,authoritative:true};mockRpc.mockResolvedValue({data:receipt,error:null});
 await expect(service.discardAvatar(ASSET)).resolves.toEqual({ok:true,podatak:receipt});
 mockRpc.mockResolvedValue({data:{...receipt,assetId:OTHER},error:null});await expect(service.discardAvatar(ASSET)).resolves.toMatchObject({ok:false,kod:'MEDIA_INVALID_RESPONSE'});
});
it('public gallery rejects extra account/storage metadata from the server',async()=>{
 const preview={assetId:ASSET,width:1600,height:800,contentType:'image/jpeg'};
 mockInvoke.mockResolvedValue({data:{needId:CID,photos:[preview],authoritative:true},error:null});await expect(service.readNeedPhotos(CID)).resolves.toMatchObject({ok:true});
 mockInvoke.mockResolvedValue({data:{needId:CID,photos:[{...preview,accountId:OWNER}],authoritative:true},error:null});await expect(service.readNeedPhotos(CID)).resolves.toMatchObject({ok:false,kod:'MEDIA_INVALID_RESPONSE'});
});
it('case photo read sends only the selected asset and private case identity through the existing gateway',async()=>{
 const controller=new AbortController();mockInvoke.mockResolvedValue({data:null,error:{message:'MEDIA_NOT_FOUND'}});
 const context={caseId:CID};const pending=service.readMedia(ASSET,context,{signal:controller.signal});context.caseId=OTHER;
 await pending;expect(mockInvoke).toHaveBeenCalledTimes(1);
 expect(mockInvoke.mock.calls[0]).toEqual(['uskoci-media',{body:{assetId:ASSET,caseId:CID},headers:{'x-media-operation':'read'},signal:controller.signal}]);
 expect(mockRpc).not.toHaveBeenCalled();
});
it('uses the private Agreement byte operation for an owned draft or exact canonical message, without Storage paths',async()=>{
 mockInvoke.mockResolvedValue({data:null,error:{message:'MEDIA_NOT_FOUND'}});
 await service.readMedia(ASSET,{agreementId:CID});
 expect(mockInvoke.mock.calls[0][1]).toEqual({body:{assetId:ASSET,agreementId:CID},headers:{'x-media-operation':'agreement-read'},signal:undefined});
 await service.readMedia(ASSET,{agreementId:CID,messageId:KEY});
 expect(mockInvoke.mock.calls[1][1]).toEqual({body:{assetId:ASSET,agreementId:CID,messageId:KEY},headers:{'x-media-operation':'agreement-read'},signal:undefined});
});
it.each([{messageId:KEY},{agreementId:CID,caseId:KEY},{agreementId:CID,needId:KEY},{agreementId:CID,profileId:PROFILE},
 {agreementId:CID,messageId:'bad'},{agreementId:CID,path:'PRIVATE'}])('rejects mixed Agreement photo authority before HTTP %#',async context=>{
 await expect(service.readMedia(ASSET,context)).resolves.toMatchObject({ok:false,kod:'MEDIA_NOT_FOUND'});expect(mockInvoke).not.toHaveBeenCalled();
});
it.each([{caseId:'bad'},{caseId:CID,needId:CID},{caseId:CID,profileId:PROFILE},{caseId:CID,path:'PRIVATE'},
 {needId:CID,profileId:PROFILE},{caseId:''}])('rejects ambiguous or leaked photo read context before HTTP %#',async context=>{
 await expect(service.readMedia(ASSET,context)).resolves.toMatchObject({ok:false,kod:'MEDIA_NOT_FOUND'});expect(mockInvoke).not.toHaveBeenCalled();
});
it('cancelled case image request does not invoke the gateway and an account ABA rejects a late response',async()=>{
 const controller=new AbortController();controller.abort();
 await expect(service.readMedia(ASSET,{caseId:CID},{signal:controller.signal})).resolves.toMatchObject({ok:false});expect(mockInvoke).not.toHaveBeenCalled();
 mockInvoke.mockImplementation(async()=>{mockSession.accountRevision=3;return{data:null,error:{message:'MEDIA_NOT_FOUND'}};});
 await expect(service.readMedia(ASSET,{caseId:CID})).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
});
describe('PKG-008 — explicit cancellation of an owned Task upload command',()=>{
 const cancelled=(previousState:string|null=null,assetId:string|null=null)=>({accountId:OWNER,conversationId:CID,clientRequestId:KEY,previousState,assetId,selected:false,cancelled:true,authoritative:true});
 it('sends the exact RPC and accepts the absent tombstone and the deselected admitted command',async()=>{
  mockRpc.mockResolvedValue({data:cancelled(),error:null});
  await expect(service.cancelUploadCommand({conversationId:CID,clientRequestId:KEY})).resolves.toEqual({ok:true,podatak:cancelled()});
  expect(mockRpc).toHaveBeenCalledWith('rpc_cancel_media_upload',{p_conversation_id:CID,p_client_request_id:KEY});expect(mockInvoke).not.toHaveBeenCalled();
  mockRpc.mockResolvedValue({data:cancelled('PROCESSING',ASSET),error:null});
  await expect(service.cancelUploadCommand({conversationId:CID,clientRequestId:KEY})).resolves.toEqual({ok:true,podatak:cancelled('PROCESSING',ASSET)});
 });
 it.each([{accountId:OTHER},{conversationId:OTHER},{clientRequestId:OTHER},{previousState:'CANCELLED'},{assetId:ASSET},{previousState:'READY'},
  {selected:true},{cancelled:false},{authoritative:false},{storagePath:'PRIVATE'}])('rejects a foreign, unbound or inconsistent cancellation receipt %#',async patch=>{
  mockRpc.mockResolvedValue({data:{...cancelled(),...patch},error:null});
  await expect(service.cancelUploadCommand({conversationId:CID,clientRequestId:KEY})).resolves.toMatchObject({ok:false,kod:'MEDIA_INVALID_RESPONSE'});
 });
 it.each([['MEDIA_COMMAND_CONFLICT','Ovaj zahtev pripada drugoj fotografiji ili zadatku. Osvežite prikaz.'],['MEDIA_NOT_FOUND','Fotografija nije dostupna.'],
  ['MEDIA_NOT_EDITABLE','Fotografije sada ne mogu da se menjaju.']])('maps the known refusal %s to its own copy',async(name,copy)=>{
  mockRpc.mockResolvedValue({data:null,error:{message:name,details:'private detail'}});
  await expect(service.cancelUploadCommand({conversationId:CID,clientRequestId:KEY})).resolves.toEqual({ok:false,kod:name,poruka:copy});
 });
 it('keeps an unknown refusal unconfirmed without echoing it, and refuses invalid identities before any RPC',async()=>{
  mockRpc.mockResolvedValue({data:null,error:{message:'SQLSTATE 55000 http://internal'}});
  const result=await service.cancelUploadCommand({conversationId:CID,clientRequestId:KEY});
  expect(result).toMatchObject({ok:false,kod:'MEDIA_UNCONFIRMED'});expect(JSON.stringify(result)).not.toContain('http');
  mockRpc.mockReset();
  await expect(service.cancelUploadCommand({conversationId:'draft',clientRequestId:KEY})).resolves.toMatchObject({ok:false,kod:'MEDIA_INPUT_INVALID'});
  await expect(service.cancelUploadCommand({conversationId:CID,clientRequestId:'key'})).resolves.toMatchObject({ok:false,kod:'MEDIA_INPUT_INVALID'});
  expect(mockRpc).not.toHaveBeenCalled();
 });
 it('discards a cancellation receipt that arrives after an account round trip',async()=>{
  mockRpc.mockImplementation(async()=>{mockSession={user:{id:OWNER},accountRevision:3};return{data:cancelled(),error:null};});
  await expect(service.cancelUploadCommand({conversationId:CID,clientRequestId:KEY})).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
 });
});
