import type { MarketplaceView, PublicBounds } from './marketplaceView';
import { pointKey, publicBounds } from './marketplaceView';
import { createDiscoveryV1Owner, type DiscoveryV1OwnerTransport, type DiscoveryV1Point } from './discoveryV1Owner';
import { discoveryV1MapMarkers, discoveryV1Opportunities, discoveryV1PlaceSuggestions, discoveryV1ViewPlan,
  type DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import type { PrilikaProjekcija } from '../contracts/projections';
import type { DiscoveryV1Counts, DiscoveryV1Availability, DiscoveryV1Item } from './discoveryV1Contract';
import type { DiscoveryV1MapResponse, DiscoveryV1PlacesResponse, DiscoveryV1PlaceRow } from './discoveryV1SpatialContract';

type DiscoveryV1MapCounts = DiscoveryV1MapResponse['counts'];
type DiscoveryV1PlaceCounts = DiscoveryV1PlacesResponse['counts'];

export type DiscoveryV1Peek =
  | { kind: 'TASK'; item: PrilikaProjekcija & { revision: number } }
  | { kind: 'PLACE'; point: DiscoveryV1Point; items: (PrilikaProjekcija & { revision: number })[] };

export type DiscoveryV1ScreenSnapshot = {
  active: boolean;
  view: MarketplaceView | null;
  /** Strict public PAGE rows retained for bounded optional overlay ownership. */
  wireItems: DiscoveryV1Item[];
  items: (PrilikaProjekcija & { revision: number })[];
  mapMarkers: DiscoveryV1MapMarker[];
  mapWholeBounds: PublicBounds | null;
  places: DiscoveryV1PlaceRow[];
  peek: DiscoveryV1Peek | null;
  counts: DiscoveryV1Counts | null;
  availability: DiscoveryV1Availability | null;
  mapCounts: DiscoveryV1MapCounts | null;
  placeCounts: DiscoveryV1PlaceCounts | null;
  pageHasMore: boolean;
  memberHasMore: boolean;
  placeHasMore: boolean;
};
export type DiscoveryV1SelectionResult =
  | { kind: 'TASK' | 'PLACE'; applied: boolean }
  | { kind: 'CLUSTER'; bounds: PublicBounds }
  | { kind: 'stale' };

function cloneView(view: MarketplaceView): MarketplaceView {
  return {
    ...view,
    area: view.area ? [...view.area] as PublicBounds : null,
    dates: view.dates ? { ...view.dates } : null,
    viewport: view.viewport ? { ...view.viewport, center: [...view.viewport.center] as [number, number],
      bounds: [...view.viewport.bounds] as PublicBounds } : null,
  };
}
function bounds(value: readonly number[]): PublicBounds {
  const valid=publicBounds(value);
  if(!valid) throw new Error('DISCOVERY_V1_SCREEN_BOUNDS');
  return valid;
}

/**
 * Production-shaped P6 screen state under quarantine. It owns how list/map/filter/pin/places share
 * one server anchor, but it is not mounted by any app route until the rollout gate is explicitly opened.
 */
export function createDiscoveryV1ScreenSession(transport: DiscoveryV1OwnerTransport, isCurrent: () => boolean = () => true) {
  const owner=createDiscoveryV1Owner(transport,isCurrent);
  let view:MarketplaceView|null=null, peek:DiscoveryV1Peek|null=null, selectionSequence=0;

  const snapshot=():DiscoveryV1ScreenSnapshot=>{
    const state=owner.snapshot();
    return {
      active:state.active,view:view?cloneView(view):null,
      wireItems:state.page?[...state.page.items]:[],
      items:state.page?discoveryV1Opportunities(state.page.items):[],
      mapMarkers:state.map?discoveryV1MapMarkers(state.map):[],
      mapWholeBounds:state.map?.wholeBounds ? [...state.map.wholeBounds] as PublicBounds : null,
      places:state.places?discoveryV1PlaceSuggestions(state.places):[],
      peek,
      counts:state.page?.counts ?? null,availability:state.page?.availability ?? null,mapCounts:state.map?.counts ?? null,
      placeCounts:state.places?.counts ?? null,pageHasMore:state.page?.hasMore ?? false,
      memberHasMore:state.members?.hasMore ?? false,placeHasMore:state.places?.hasMore ?? false,
    };
  };

  async function open(next:MarketplaceView,pageLimit=50){
    view=cloneView(next);peek=null;selectionSequence++;
    owner.clearSelectionReads();
    const plan=discoveryV1ViewPlan(view);
    owner.begin(plan.filter,plan.pageScope,pageLimit);
    const page=await owner.firstPage();
    if(page.kind!=='applied') return page.kind==='stale'?{kind:'stale' as const,snapshot:snapshot()}:{kind:'noop' as const,snapshot:snapshot()};
    if(plan.mapBounds){
      const mapped=await owner.loadMap(plan.mapBounds);
      if(mapped.kind==='stale') return {kind:'stale' as const,snapshot:snapshot()};
    }
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  async function settleMap(nextBounds:PublicBounds){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const area=bounds(nextBounds);
    view={...view,area:[...area] as PublicBounds,pinPlace:null,selectedId:null,selectedPlace:null};
    peek=null;selectionSequence++;owner.clearSelectionReads();
    owner.setScope({kind:'AREA',bounds:[...area] as PublicBounds});
    const pagePromise=owner.firstPage(),mapPromise=owner.loadMap(area);
    const [page,map]=await Promise.all([pagePromise,mapPromise]);
    if(page.kind==='stale'||map.kind==='stale') return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  async function showPoint(point:DiscoveryV1Point){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const key=pointKey(point);
    if(!key) throw new Error('DISCOVERY_V1_SCREEN_POINT');
    view={...view,pinPlace:key,selectedId:null,selectedPlace:null};peek=null;selectionSequence++;owner.clearSelectionReads();
    owner.setScope({kind:'POINT_LIST',point:{...point}});
    const result=await owner.firstPage();
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showAll(){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    view={...view,area:null,pinPlace:null,selectedId:null,selectedPlace:null};peek=null;selectionSequence++;owner.clearSelectionReads();
    owner.setScope({kind:'ALL'});
    const result=await owner.firstPage();
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function selectMarker(marker:DiscoveryV1MapMarker):Promise<DiscoveryV1SelectionResult>{
    const selection=++selectionSequence;owner.clearSelectionReads();
    if(marker.kind==='CLUSTER'){peek=null;return {kind:'CLUSTER',bounds:[...marker.memberBounds] as PublicBounds};}
    if(marker.kind==='TASK'){
      const result=await owner.readExact(marker.taskId);
      if(selection!==selectionSequence||!isCurrent()||result.kind==='stale') return {kind:'stale'};
      if(result.kind!=='applied'){peek=null;return {kind:'TASK',applied:false};}
      const item=result.value.items[0];
      peek=item?{kind:'TASK',item:discoveryV1Opportunities([item])[0]}:null;
      return {kind:'TASK',applied:!!item};
    }
    const result=await owner.firstMembers(marker.point,50);
    if(selection!==selectionSequence||!isCurrent()||result.kind==='stale') return {kind:'stale'};
    if(result.kind!=='applied'){peek=null;return {kind:'PLACE',applied:false};}
    peek={kind:'PLACE',point:{...marker.point},items:discoveryV1Opportunities(result.value.items)};
    return {kind:'PLACE',applied:true};
  }

  async function nextPage(){const result=await owner.nextPage();return {kind:result.kind,snapshot:snapshot()};}
  async function nextMembers(){const result=await owner.nextMembers();if(result.kind==='applied'&&peek?.kind==='PLACE')
    peek={...peek,items:discoveryV1Opportunities(result.value.items)};return {kind:result.kind,snapshot:snapshot()};}
  async function queryPlaces(prefix:string,facetArea:PublicBounds|null=null,limit=10){
    const result=await owner.firstPlaces(prefix,facetArea?bounds(facetArea):null,limit);return {kind:result.kind,snapshot:snapshot()};
  }
  async function nextPlaces(){const result=await owner.nextPlaces();return {kind:result.kind,snapshot:snapshot()};}
  const clearPeek=()=>{selectionSequence++;peek=null;owner.clearSelectionReads();};
  const retire=()=>{selectionSequence++;peek=null;view=null;owner.retire();};

  return {open,settleMap,showPoint,showAll,selectMarker,nextPage,nextMembers,queryPlaces,nextPlaces,clearPeek,retire,snapshot};
}
