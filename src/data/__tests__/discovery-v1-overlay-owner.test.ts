import type { JavniProfilProjekcija } from '../../contracts/projections';
import { createDiscoveryV1OverlayOwner, discoveryV1ApplyOverlays, discoveryV1OverlayRelation,
  type DiscoveryV1OverlayLoaders } from '../discoveryV1OverlayOwner';
import { taskRelationIndex } from '../taskRelation';
import type { DiscoveryV1Item } from '../discoveryV1Contract';

const ID1='11111111-1111-4111-8111-111111111111',ID2='33333333-3333-4333-8333-333333333333';
const PROFILE='22222222-2222-4222-8222-222222222222',AT='2026-09-28T10:00:00.000000Z';
const item=(id=ID1,patch:Partial<DiscoveryV1Item>={}):DiscoveryV1Item=>({id,revision:1,sortAt:AT,publishedAt:AT,title:'Zadatak',category:'Selidbe',
 status:'PUBLISHED',urgent:true,scheduleKind:'FLEXIBLE',startsAt:null,endsAt:null,executionLocationMode:'STATIONARY',taskCountryCode:'RS',
 taskTimezone:'Europe/Belgrade',verifiedIdentityRequired:false,approximateCity:'Novi Sad',approximateArea:'Liman',
 pin:{lat:45.25,lng:19.83,precision:'COARSE_1KM'},requiredSlots:1,coveredSlots:0,requiredSkills:[],requiredTools:[],requiredVehicles:[],
 requiredLicenses:[],minimumExperienceYears:null,priceMode:'OFFERS',requesterPriceRsd:null,priceBasis:null,requesterProfileId:PROFILE,
 responseDeadline:null,acceptsApplications:true,publicTopology:null,criticalConditions:null,...patch});
const profile=(id=PROFILE):JavniProfilProjekcija=>({profilId:id,uloga:'narucilac',ime:'Ana',avatarPutanja:'hidden/avatar.jpg',grad:'Novi Sad',
 naslov:null,biografija:null,poverenje:{ocenaProsek:4.8,brojRecenzija:12,zavrseniBroj:4,identitetVerifikovan:false,
 ocenaDostupna:true,recenzijeDostupne:true,verifikacijaIdentitetaDostupna:false}});
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve};};

it('late overlays from an old visible slice cannot overwrite a newer slice',async()=>{
 const old=deferred<any>(),fresh=deferred<any>();let calls=0;
 const loaders:DiscoveryV1OverlayLoaders={relations:()=>++calls===1?old.promise:fresh.promise,profile:async()=>profile(),urgencies:async()=>new Map()};
 const owner=createDiscoveryV1OverlayOwner(loaders);
 const first=owner.load([item(ID1)]),second=owner.load([item(ID2)]);
 fresh.resolve(taskRelationIndex([], [ID2]));await second;old.resolve(taskRelationIndex([], [ID1]));
 expect((await first).kind).toBe('stale');expect(owner.snapshot().sliceKey).toContain(ID2);expect(owner.snapshot().sliceKey).not.toContain(ID1);
});

it('bounded overlay refuses more than one hundred before any loader runs',async()=>{
 const fn=jest.fn();const loaders:DiscoveryV1OverlayLoaders={relations:fn,profile:fn,urgencies:fn} as any;
 const owner=createDiscoveryV1OverlayOwner(loaders);
 const rows=Array.from({length:101},(_,i)=>item(String(i).padStart(8,'0')+'-1111-4111-8111-111111111111'));
 await expect(owner.load(rows)).rejects.toThrow('DISCOVERY_V1_OVERLAY_BOUND');
 expect(fn).not.toHaveBeenCalled();
});

it('profile and urgency enrich display facts without exposing storage path or changing membership',async()=>{
 const loaders:DiscoveryV1OverlayLoaders={
  relations:async ids=>taskRelationIndex([{needId:ids[0],relation:'OWNER',applicationId:null,applicationState:null,agreementId:null}],ids),
  profile:async()=>profile(),urgencies:async rows=>new Map([[rows[0].id,{level:'HITNO' as const,expiresAt:'2026-09-28T12:00:00Z'}]])};
 const owner=createDiscoveryV1OverlayOwner(loaders),source=[item()];await owner.load(source);
 const overlay=owner.snapshot(),mapped=discoveryV1ApplyOverlays(source,overlay);
 expect(mapped).toHaveLength(1);expect(mapped[0]).toMatchObject({narucilacIme:'Ana',narucilacOcena:'4,8',narucilacBrojOcena:12,
  urgency:{level:'HITNO'},narucilacAvatarId:null});
 expect(JSON.stringify(mapped)).not.toContain('hidden/avatar.jpg');
 expect(discoveryV1OverlayRelation(overlay,ID1)).toEqual({kind:'OWNER'});
});

it('optional overlay failures keep task membership and relation stays UNKNOWN',async()=>{
 const loaders:DiscoveryV1OverlayLoaders={relations:async()=>{throw Error('down')},profile:async()=>{throw Error('down')},urgencies:async()=>{throw Error('down')}};
 const owner=createDiscoveryV1OverlayOwner(loaders),source=[item()];await owner.load(source);
 const overlay=owner.snapshot(),mapped=discoveryV1ApplyOverlays(source,overlay);
 expect(mapped).toHaveLength(1);expect(mapped[0]).toMatchObject({narucilacIme:'',narucilacOcena:null});
 expect(discoveryV1OverlayRelation(overlay,ID1)).toEqual({kind:'UNKNOWN'});
 expect(overlay.errors).toEqual({relations:true,profiles:true,urgencies:true});
});

it('profile reads are capped at four concurrent calls',async()=>{
 let active=0,max=0,cursor=0;const gates=Array.from({length:8},()=>deferred<JavniProfilProjekcija|null>());
 const rows=Array.from({length:8},(_,i)=>item(String(i)+'1111111-1111-4111-8111-111111111111',{requesterProfileId:String(i)+'2222222-2222-4222-8222-222222222222'}));
 const loaders:DiscoveryV1OverlayLoaders={relations:async ids=>taskRelationIndex([],ids),urgencies:async()=>new Map(),
  profile:async id=>{const at=cursor++,gate=gates[at];active++;max=Math.max(max,active);const value=await gate.promise;active--;return value?{...value,profilId:id}:null;}};
 const owner=createDiscoveryV1OverlayOwner(loaders),loading=owner.load(rows);
 for(let n=0;n<20&&cursor<4;n++)await Promise.resolve();
 expect(cursor).toBe(4);expect(max).toBe(4);
 gates.slice(0,4).forEach(g=>g.resolve(null));
 for(let n=0;n<20&&cursor<8;n++)await Promise.resolve();
 expect(cursor).toBe(8);
 gates.slice(4).forEach(g=>g.resolve(null));await loading;expect(max).toBe(4);
});

it('account/focus guard and retire fence ignored aborts',async()=>{
 const gate=deferred<any>();let current=true;
 const loaders:DiscoveryV1OverlayLoaders={relations:()=>gate.promise,profile:async()=>profile(),urgencies:async()=>new Map()};
 const owner=createDiscoveryV1OverlayOwner(loaders,()=>current),read=owner.load([item()]);
 current=false;gate.resolve(taskRelationIndex([], [ID1]));
 expect((await read).kind).toBe('stale');expect(owner.snapshot().relations).toBeNull();
 const gate2=deferred<any>(),owner2=createDiscoveryV1OverlayOwner({...loaders,relations:()=>gate2.promise}),read2=owner2.load([item()]);
 owner2.retire();gate2.resolve(taskRelationIndex([], [ID1]));
 expect((await read2).kind).toBe('stale');expect(owner2.snapshot().active).toBe(false);
});

it('a bounded overlay can enrich its admitted prefix without rejecting a longer paged list',async()=>{
 const source=Array.from({length:120},(_,i)=>item(String(i).padStart(8,'0')+'-1111-4111-8111-111111111111',
  {requesterProfileId:String(i%2).padStart(8,'0')+'-2222-4222-8222-222222222222'}));
 const admitted=source.slice(0,100);
 const loaders:DiscoveryV1OverlayLoaders={relations:async ids=>taskRelationIndex([],ids),profile:async id=>profile(id),urgencies:async()=>new Map()};
 const owner=createDiscoveryV1OverlayOwner(loaders);await owner.load(admitted);
 const mapped=discoveryV1ApplyOverlays(source,owner.snapshot());
 expect(mapped).toHaveLength(120);
 expect(mapped[0].narucilacIme).toBe('Ana');
 expect(mapped[99].narucilacIme).toBe('Ana');
 expect(mapped[100].narucilacIme).toBe('');
 expect(mapped[119].narucilacOcena).toBeNull();
});
