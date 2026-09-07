jest.mock('../supabaseClient', () => ({supabaseKlijent:()=>mockClient}));
import { needClientService } from '../needClientService';
import { needDisplayProjection } from '../needDisplayProjection';
import { correctionFromText, correctionInputText } from '../aiNeedV2Ui';
import { fact, id } from './fixtures/ai-v2';
const mockBuilder:any={select:jest.fn(),eq:jest.fn(),maybeSingle:jest.fn(),order:jest.fn()};
mockBuilder.select.mockReturnValue(mockBuilder);mockBuilder.eq.mockReturnValue(mockBuilder);
const mockClient={from:jest.fn(()=>mockBuilder),auth:{getUser:jest.fn().mockResolvedValue({data:{user:{id:id(1)}},error:null})}};
const raw={
 id:id(3),revision:1,title:'Generic transport',description:'Generic description',category:'Transport',status:'DRAFT',
 schedule_kind:'FIXED_WINDOW',starts_at:'2030-05-14T14:00:00Z',ends_at:'2030-05-14T16:00:00Z',
 required_slots:2,covered_slots:0,mode:'OFFERS',requester_price_rsd:null,marketplace_responses:[],
 execution_location_mode:'POINT_TO_POINT',approximate_city:'Alpha',approximate_area:'Center',
 need_geography:{public_topology:{mode:'POINT_TO_POINT',start:{city:'Alpha',area:'Center'},end:{city:'Beta',area:'North'}}},
 required_skills:['careful carrying'],required_tools:['straps'],required_vehicles:['van'],required_licenses:['B'],
 minimum_experience_years:2,verified_identity_required:true,need_requirement_details:{critical_conditions:['Keep upright']},
 public_photo_paths:['public/photo-1'],need_sensitive:{exact_address:'PRIVATE ADDRESS NEVER PROJECTED',access_notes:'PRIVATE NOTE'},
};
beforeEach(()=>{jest.clearAllMocks();mockBuilder.maybeSingle.mockResolvedValue({data:raw,error:null});});
describe('actual persisted Need read adapter',()=>{
 it('preserves materialized public route/date/people/offers and every requirement; private values never enter projection',async()=>{
  const result=await needClientService.potreba(id(3));
  expect(result).toMatchObject({stanje:'NACRT',podrucjeTekst:'Center, Alpha → North, Beta',kategorija:'Transport',brojFotografija:1,
   pokrivenost:{ukupno:2,popunjeno:0,preostalo:2,udeo:0},rezimCene:'OFFERS',
   uslovi:['careful carrying','straps','van','Dozvola: B','Keep upright','Iskustvo: najmanje 2 godina','Potreban potvrđen identitet']});
  expect(result?.vremeTekst).toContain('2030');expect(result?.vremeTekst).toContain('16:00');expect(result?.vremeTekst).toContain('18:00');
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  const select=mockBuilder.select.mock.calls[0][0];expect(select).toContain('need_geography(public_topology)');
  expect(select).toContain('need_requirement_details(critical_conditions)');expect(select).not.toContain('need_sensitive');
  expect(mockBuilder.eq.mock.calls).toEqual([['id',id(3)]]);
 });
 it('REMOTE is explicit with no fabricated city and no fixed time invented',async()=>{
  mockBuilder.maybeSingle.mockResolvedValue({data:{...raw,execution_location_mode:'REMOTE',need_geography:{public_topology:{mode:'REMOTE'}},
   approximate_city:'',approximate_area:'',schedule_kind:'REMOTE_ANYTIME',starts_at:null,ends_at:null},error:null});
  const result=await needClientService.potreba(id(3));expect(result?.podrucjeTekst).toBe('Daljinski');expect(result?.vremeTekst).toBe('Daljinski, bilo kada');
 });
 it('maps area and multi-stop topology without dropping optional endpoint/service area',()=>{
  expect(needDisplayProjection({...raw,need_geography:{public_topology:{mode:'MULTI_STOP',start:{city:'A'},waypoints:[{city:'B'},{city:'C'}]}}}).podrucjeTekst).toBe('A → B → C');
  expect(needDisplayProjection({...raw,need_geography:{public_topology:{mode:'AREA_BASED',start:{city:'A'},serviceArea:{area:'Region'}}}}).podrucjeTekst).toBe('A · Region');
 });
 it.each([
  {required_slots:undefined},{covered_slots:'0'}, {required_slots:0},
  {need_geography:null}, {ends_at:null}, {required_vehicles:'van'}, {verified_identity_required:'true'},
 ])('rejects malformed/lost materialized fields rather than filling plausible defaults %j',async patch=>{
  mockBuilder.maybeSingle.mockResolvedValue({data:{...raw,...patch},error:null});
  await expect(needClientService.potreba(id(3))).rejects.toThrow();
 });
 it('preserves relative schedule as conversation wording without rebasing it to device today',()=>{
  const result=needDisplayProjection({...raw,schedule_kind:'TOMORROW_FLEXIBLE',starts_at:null,ends_at:null});
  expect(result.vremeTekst).toBe('Fleksibilno · potvrđeno kao „sutra“');
 });
 it('inline corrections edit typed values, preserving comma-containing list entries',()=>{
  const f=fact('need.required_tools',['straps, 4 m','dolly'],{displayValue:'AI summary'});
  const input=correctionInputText(f);expect(input).toBe('straps, 4 m\ndolly');
  expect(correctionFromText(f,input,'lines')).toMatchObject({ok:true,value:['straps, 4 m','dolly']});
  expect(correctionInputText(fact('need.people_needed',2,{displayValue:'2 people'}))).toBe('2');
 });
});
