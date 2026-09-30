import type { MarketplaceView, PublicBounds } from './marketplaceView';
import { pointKey, publicBounds } from './marketplaceView';
import { createDiscoveryV1Owner, wireBounds, type DiscoveryV1OwnerTransport, type DiscoveryV1Point } from './discoveryV1Owner';
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

/**
 * A settled region this close to what the map was last read over (a fraction of its larger span) needs no new read: the camera came back
 * to where the read already is, as on a return to the screen, and the buckets on it are the ones the person would see.
 */
export const DISCOVERY_V1_MAP_REFRESH_TOLERANCE = 0.02;
function nearBounds(a: readonly number[], b: readonly number[]) {
  const span = Math.max(a[2] - a[0], a[3] - a[1], b[2] - b[0], b[3] - b[1], 1e-6), tolerance = span * DISCOVERY_V1_MAP_REFRESH_TOLERANCE;
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

/**
 * The first MAP request of a view with no viewport or area covers the whole world. It exists only to learn the server's
 * whole-filter bounds (the map mounts and fits from them); the markers for the fitted area come from a second request over
 * exactly those bounds, so the first picture is not one world-sized bucket.
 */
export const DISCOVERY_V1_SEED_BOUNDS: PublicBounds = [-180, -90, 180, 90];

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
 * P6 screen state. It owns how list/map/filter/pin/places share one server anchor. The Zadaci route mounts it (through
 * DiscoveryV1Route) only in a build compiled with the P6 reader, against a backend that carries the P6 rollout.
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
    let mapBounds=plan.mapBounds;
    if(!mapBounds&&plan.mapSeed){
      const seeded=await owner.loadMap([...DISCOVERY_V1_SEED_BOUNDS] as PublicBounds);
      if(seeded.kind==='stale') return {kind:'stale' as const,snapshot:snapshot()};
      mapBounds=seeded.kind==='applied'&&seeded.value.wholeBounds?[...seeded.value.wholeBounds] as PublicBounds:null;
    }
    if(mapBounds){
      const mapped=await owner.loadMap(mapBounds);
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

  /**
   * A camera move that is not the person's own (a fit to a chosen place, Nearby, a saved work area) leaves the buckets of the region it left.
   * Only the MAP is read again, over the region now on screen: the list, its scope, the peek and the selection stay exactly as they are.
   */
  async function refreshMap(nextBounds:PublicBounds){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const wire=wireBounds(bounds(nextBounds));
    const covered=owner.snapshot().map?.coverageBounds;
    if(covered&&nearBounds(covered,wire)) return {kind:'noop' as const,snapshot:snapshot()};
    const result=await owner.loadMap(wire);
    return {kind:result.kind,snapshot:snapshot()};
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
      // EX-03: PAGE and EXACT_PUBLIC return the same public item, so a row the list already holds IS the card's data. It is exposed at once (this runs before the first await,
      // so the caller can publish it in the same turn as the touch) and the exact read, which still goes out, only confirms or refreshes it: the card is replaced only when the
      // answer differs, a failed read keeps the known card, an answer without the task takes it away. A task that is not loaded waits for the exact read as before, and the card
      // that was showing stays until the new one lands.
      const loaded=owner.snapshot().page?.items.find(row=>row.id===marker.taskId)??null;
      if(loaded) peek={kind:'TASK',item:discoveryV1Opportunities([loaded])[0]};
      let result;
      try{result=await owner.readExact(marker.taskId);}
      catch(error){
        if(selection!==selectionSequence||!isCurrent()) return {kind:'stale'};
        if(loaded) return {kind:'TASK',applied:true};
        throw error;
      }
      if(selection!==selectionSequence||!isCurrent()||result.kind==='stale') return {kind:'stale'};
      if(result.kind!=='applied'){if(!loaded)peek=null;return {kind:'TASK',applied:!!loaded};}
      const item=result.value.items[0];
      if(!item){peek=null;return {kind:'TASK',applied:false};}
      if(!loaded||JSON.stringify(item)!==JSON.stringify(loaded)) peek={kind:'TASK',item:discoveryV1Opportunities([item])[0]};
      return {kind:'TASK',applied:true};
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

  return {open,settleMap,refreshMap,showPoint,showAll,selectMarker,nextPage,nextMembers,queryPlaces,nextPlaces,clearPeek,retire,snapshot};
}
