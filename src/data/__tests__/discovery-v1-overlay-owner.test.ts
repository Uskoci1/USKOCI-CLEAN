import type { JavniProfilProjekcija } from '../../contracts/projections';
import { createDiscoveryV1OverlayOwner, discoveryV1ApplyOverlays, discoveryV1OverlayRelation,
  type DiscoveryV1OverlayLoaders } from '../discoveryV1OverlayOwner';
import { taskRelationIndex, type TaskRelationIndex } from '../taskRelation';
import type { DiscoveryV1Item } from '../discoveryV1Contract';
import type { DiscoveryV1ScreenSnapshot } from '../discoveryV1ScreenSession';
import { discoveryV1PresentationBridgeModel } from '../discoveryV1PresentationBridge';
import { discoveryV1Opportunities } from '../discoveryV1MarketplaceAdapter';
import { initialMarketplaceView } from '../marketplaceView';

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

// Independent review (P6 client finding): `load()` emptied the snapshot at its start and `discoveryV1ApplyOverlays` handed back bare rows while it ran,
// so every next page, area change, place, show-all and open blanked the names, ratings and relation labels of the rows already on screen until the whole
// overlay came back. What the last settled load knew about the ids that are still asked for stays visible until its fresh answer lands; ids no longer
// asked for are dropped at once; nothing is invented for an id without an answer; a failed reload keeps the entries and records the error flags.
const PROFILE2='66666666-6666-4666-8666-666666666666',HITNO={level:'HITNO' as const,expiresAt:'2026-09-28T12:00:00Z'};
const marko=(id=PROFILE2):JavniProfilProjekcija=>({...profile(id),ime:'Marko',poverenje:{...profile(id).poverenje,ocenaProsek:3.5,brojRecenzija:2}});
const answers=(ids:readonly string[],rows:Record<string,'OWNER'|'APPLIED'>)=>taskRelationIndex(Object.entries(rows).filter(([id])=>ids.includes(id))
 .map(([needId,relation])=>relation==='OWNER'?{needId,relation}
  :{needId,relation,applicationId:'77777777-7777-4777-8777-777777777777',applicationState:'SUBMITTED',agreementId:null}),ids);
const urgent=(rows:readonly {id:string}[])=>new Map(rows.map(row=>[row.id,HITNO] as const));

it('a reload keeps the names, ratings, urgency and relations already known for the ids still listed until their fresh answers land',async()=>{
 let round=0;const relationGate=deferred<TaskRelationIndex>(),profileGate=deferred<JavniProfilProjekcija|null>();
 const loaders:DiscoveryV1OverlayLoaders={
  relations:async ids=>++round===1?answers(ids,{[ID1]:'OWNER'}):relationGate.promise,
  profile:async id=>id===PROFILE?profile():profileGate.promise,
  urgencies:async rows=>urgent(rows.filter(row=>row.id===ID1))};
 const owner=createDiscoveryV1OverlayOwner(loaders);
 await owner.load([item(ID1)]);
 const second=[item(ID1),item(ID2,{requesterProfileId:PROFILE2})],reload=owner.load(second);
 const during=owner.snapshot(),mapped=discoveryV1ApplyOverlays(second,during);
 expect(during.loading).toBe(true);
 expect(mapped[0]).toMatchObject({narucilacIme:'Ana',narucilacOcena:'4,8',narucilacBrojOcena:12,urgency:{level:'HITNO'}});
 expect(discoveryV1OverlayRelation(during,ID1)).toEqual({kind:'OWNER'});
 // The new row has no answer yet: nothing is invented for it.
 expect(mapped[1]).toMatchObject({narucilacIme:'',narucilacOcena:null,narucilacBrojOcena:null});expect(mapped[1]).not.toHaveProperty('urgency');
 expect(discoveryV1OverlayRelation(during,ID2)).toEqual({kind:'UNKNOWN'});
 relationGate.resolve(answers([ID1,ID2],{[ID1]:'OWNER',[ID2]:'APPLIED'}));profileGate.resolve(marko());
 expect((await reload).kind).toBe('applied');
 const after=owner.snapshot(),settled=discoveryV1ApplyOverlays(second,after);
 expect(after.loading).toBe(false);expect(after.errors).toEqual({relations:false,profiles:false,urgencies:false});
 expect(settled[0]).toMatchObject({narucilacIme:'Ana',urgency:{level:'HITNO'}});
 expect(settled[1]).toMatchObject({narucilacIme:'Marko',narucilacOcena:'3,5',narucilacBrojOcena:2});
 expect(discoveryV1OverlayRelation(after,ID2)).toMatchObject({kind:'APPLIED'});
});

it('a reload drops what was known about ids that are no longer asked for, and keeps the rest',async()=>{
 let round=0;const gate=deferred<TaskRelationIndex>();
 const loaders:DiscoveryV1OverlayLoaders={
  relations:async ids=>++round===1?answers(ids,{[ID1]:'OWNER',[ID2]:'APPLIED'}):gate.promise,
  profile:async id=>id===PROFILE?profile():marko(id),urgencies:async rows=>urgent(rows)};
 const owner=createDiscoveryV1OverlayOwner(loaders);
 const both=[item(ID1),item(ID2,{requesterProfileId:PROFILE2})];await owner.load(both);
 const reload=owner.load([both[1]]),during=owner.snapshot();
 expect(during.loading).toBe(true);expect(during.relations).not.toBeNull();
 expect(discoveryV1OverlayRelation(during,ID1)).toEqual({kind:'UNKNOWN'});expect([...during.relations!.owned]).toEqual([]);
 expect(discoveryV1OverlayRelation(during,ID2)).toMatchObject({kind:'APPLIED'});expect([...during.relations!.applied]).toEqual([ID2]);
 expect(during.profiles.has(PROFILE)).toBe(false);expect(during.profiles.get(PROFILE2)?.ime).toBe('Marko');
 expect(during.urgency.has(ID1)).toBe(false);expect(during.urgency.get(ID2)).toEqual(HITNO);
 expect(during.admitted.has(ID1)).toBe(false);
 const mapped=discoveryV1ApplyOverlays(both,during);
 expect(mapped[0]).toMatchObject({narucilacIme:'',narucilacOcena:null});expect(mapped[0]).not.toHaveProperty('urgency');
 expect(mapped[1]).toMatchObject({narucilacIme:'Marko',urgency:{level:'HITNO'}});
 gate.resolve(answers([ID2],{[ID2]:'APPLIED'}));expect((await reload).kind).toBe('applied');
});

it('a failed reload keeps the previous entries for the ids still listed and records the error flags',async()=>{
 let round=0;const down=()=>{throw Error('down');};
 const loaders:DiscoveryV1OverlayLoaders={
  relations:async ids=>++round>1?down():answers(ids,{[ID1]:'OWNER'}),
  profile:async id=>round>1?down():profile(id),
  urgencies:async rows=>round>1?down():urgent(rows)};
 const owner=createDiscoveryV1OverlayOwner(loaders);
 await owner.load([item(ID1)]);
 const second=[item(ID1),item(ID2,{requesterProfileId:PROFILE2})];
 expect((await owner.load(second)).kind).toBe('applied');
 const after=owner.snapshot(),mapped=discoveryV1ApplyOverlays(second,after);
 expect(after.loading).toBe(false);expect(after.errors).toEqual({relations:true,profiles:true,urgencies:true});
 expect(mapped[0]).toMatchObject({narucilacIme:'Ana',narucilacOcena:'4,8',urgency:{level:'HITNO'}});
 expect(discoveryV1OverlayRelation(after,ID1)).toEqual({kind:'OWNER'});
 expect(mapped[1]).toMatchObject({narucilacIme:'',narucilacOcena:null});expect(mapped[1]).not.toHaveProperty('urgency');
 expect(discoveryV1OverlayRelation(after,ID2)).toEqual({kind:'UNKNOWN'});
 // Missing means "nothing to show": the kept entry is not missing, the never-answered new one is.
 expect([...after.missingProfiles]).toEqual([PROFILE2]);
});

it('a fresh answer replaces a kept entry: a gone profile is dropped, and a changed row does not carry the older row\'s urgency',async()=>{
 let round=0;const gate=deferred<TaskRelationIndex>();
 const loaders:DiscoveryV1OverlayLoaders={
  relations:async ids=>++round===1?answers(ids,{}):gate.promise,
  profile:async id=>round===1?profile(id):null,
  urgencies:async rows=>round===1?urgent(rows):new Map()};
 const owner=createDiscoveryV1OverlayOwner(loaders);
 await owner.load([item(ID1)]);
 const changed=[item(ID1,{revision:2,urgent:false})],reload=owner.load(changed);
 const during=owner.snapshot(),mapped=discoveryV1ApplyOverlays(changed,during);
 expect(mapped[0]).toMatchObject({narucilacIme:'Ana',narucilacOcena:'4,8'});
 expect(mapped[0]).not.toHaveProperty('urgency');expect(during.urgency.has(ID1)).toBe(false);
 gate.resolve(answers([ID1],{}));expect((await reload).kind).toBe('applied');
 const after=owner.snapshot();
 expect(after.profiles.has(PROFILE)).toBe(false);expect([...after.missingProfiles]).toEqual([PROFILE]);expect(after.errors.profiles).toBe(false);
 expect(discoveryV1ApplyOverlays(changed,after)[0]).toMatchObject({narucilacIme:'',narucilacOcena:null,narucilacBrojOcena:null});
});

it('a retired owner keeps nothing for the next account, and a load after retire leaves nothing behind',async()=>{
 const loaders:DiscoveryV1OverlayLoaders={relations:async ids=>answers(ids,{[ID1]:'OWNER'}),profile:async id=>profile(id),urgencies:async rows=>urgent(rows)};
 const owner=createDiscoveryV1OverlayOwner(loaders);await owner.load([item(ID1)]);
 expect(owner.snapshot().profiles.size).toBe(1);expect(owner.snapshot().urgency.size).toBe(1);
 owner.retire();
 const cleared=owner.snapshot();
 expect(cleared).toMatchObject({active:false,loading:false,relations:null});
 expect(cleared.profiles.size).toBe(0);expect(cleared.urgency.size).toBe(0);expect(cleared.admitted.size).toBe(0);
 expect((await owner.load([item(ID1)])).kind).toBe('stale');
 expect(owner.snapshot()).toMatchObject({active:false,loading:false,relations:null});expect(owner.snapshot().profiles.size).toBe(0);
});

it('the presentation bridge model keeps labels and names during a reload with its existing mapping',async()=>{
 let round=0;const gate=deferred<TaskRelationIndex>();
 const loaders:DiscoveryV1OverlayLoaders={relations:async ids=>++round===1?answers(ids,{[ID1]:'OWNER'}):gate.promise,profile:async id=>profile(id),urgencies:async()=>new Map()};
 const owner=createDiscoveryV1OverlayOwner(loaders),rows=[item(ID1)];await owner.load(rows);
 const reload=owner.load(rows);
 const screen={active:true,view:{...initialMarketplaceView(),mode:'map'},wireItems:rows,items:discoveryV1Opportunities(rows),mapMarkers:[],mapWholeBounds:null,
  places:[],peek:null,counts:null,availability:null,mapCounts:null,placeCounts:null,pageHasMore:false,memberHasMore:false,placeHasMore:false} as unknown as DiscoveryV1ScreenSnapshot;
 const actions={onSelectMarker:jest.fn(),onArea:jest.fn(),onClearPeek:jest.fn(),onShowPlace:jest.fn(),onShowAll:jest.fn(),onNextPage:jest.fn()};
 const model=discoveryV1PresentationBridgeModel(screen,owner.snapshot(),null,false,actions);
 expect(model.relationsPending).toBe(true);
 expect(model.relations?.relation(ID1)).toEqual({kind:'OWNER'});
 expect(model.items[0]).toMatchObject({narucilacIme:'Ana',narucilacOcena:'4,8'});
 gate.resolve(answers([ID1],{[ID1]:'OWNER'}));expect((await reload).kind).toBe('applied');
});
