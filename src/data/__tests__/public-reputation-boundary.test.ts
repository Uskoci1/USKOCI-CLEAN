jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc})}));
import {publicProfileClientService as service} from '../publicProfileClientService';
const mockRpc=jest.fn();
const profile=()=>({profileId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'WORKER',displayName:'Ime',avatarPath:null,city:'Novi Sad',publicSummary:{headline:null,bio:null},trust:{ratingAverage:null,reviewCount:0,completedCount:0,identityVerified:false,ratingAvailable:false,reviewsAvailable:true,identityVerificationAvailable:false}});
beforeEach(()=>mockRpc.mockReset());
it('maps a real unrated account without inventing zero stars',async()=>{
 mockRpc.mockResolvedValue({data:profile(),error:null});
 expect(await service.javniProfil(profile().profileId)).toMatchObject({poverenje:{brojRecenzija:0,ocenaProsek:null,recenzijeDostupne:true,ocenaDostupna:false}});
});
it.each([{ratingAverage:0},{ratingAvailable:true},{reviewCount:-1},{reviewCount:1.5},{completedCount:null},{reviewsAvailable:false}])('rejects contradictory trust %j',async patch=>{
 mockRpc.mockResolvedValue({data:{...profile(),trust:{...profile().trust,...patch}},error:null});
 await expect(service.javniProfil(profile().profileId)).rejects.toThrow(/PUBLIC_PROFILE_/);
});
it('maps the same real rating shape for either public role',async()=>{
 for(const role of ['WORKER','REQUESTER']){
  mockRpc.mockResolvedValue({data:{...profile(),role,trust:{...profile().trust,reviewCount:2,ratingAverage:4.5,ratingAvailable:true}},error:null});
  expect(await service.javniProfil(profile().profileId)).toMatchObject({poverenje:{brojRecenzija:2,ocenaProsek:4.5}});
 }
});
it('does not leak SQL details or rejected transport messages',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'SECRET_SQL_DETAIL_HINT_TABLE'}});
 await expect(service.javniProfil(profile().profileId)).rejects.toThrow('PUBLIC_PROFILE_READ_FAILED');
 mockRpc.mockRejectedValue(new Error('SECRET_PROVIDER_STACK'));
 await expect(service.javniProfil(profile().profileId)).rejects.toThrow('PUBLIC_PROFILE_READ_FAILED');
});
