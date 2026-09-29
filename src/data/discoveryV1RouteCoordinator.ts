import { createDiscoveryV1OverlayOwner, DISCOVERY_V1_OVERLAY_LIMIT, type DiscoveryV1OverlayLoaders } from './discoveryV1OverlayOwner';
import { discoveryV1ViewPlan, type DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import { createDiscoveryV1ScreenSession, type DiscoveryV1ScreenSnapshot } from './discoveryV1ScreenSession';
import { createDiscoveryV1SearchOwner } from './discoveryV1SearchOwner';
import type { DiscoveryV1OwnerTransport } from './discoveryV1Owner';
import type { MarketplaceView, PublicBounds } from './marketplaceView';

export type DiscoveryV1SearchDraft = Pick<MarketplaceView,'query'|'place'|'area'|'pinPlace'|'when'|'dates'|'where'|'places'|'price'>;
export type DiscoveryV1RouteSnapshot = {
  active: boolean;
  generation: number;
  view: MarketplaceView | null;
  screen: DiscoveryV1ScreenSnapshot;
  overlay: ReturnType<ReturnType<typeof createDiscoveryV1OverlayOwner>['snapshot']>;
  search: ReturnType<ReturnType<typeof createDiscoveryV1SearchOwner>['snapshot']>;
  selectedMarkerKey: string | null;
  loadingMore: boolean;
};

const cloneBounds=(value:PublicBounds|null)=>value?[...value] as PublicBounds:null;
const cloneView=(view:MarketplaceView):MarketplaceView=>({...view,area:cloneBounds(view.area),dates:view.dates?{...view.dates}:null,
  viewport:view.viewport?{...view.viewport,center:[...view.viewport.center] as [number,number],
    bounds:[...view.viewport.bounds] as PublicBounds}:null});

export function discoveryV1RouteIntentKey(view:MarketplaceView):string{
  const plan=discoveryV1ViewPlan(view);
  return JSON.stringify([plan.filter,plan.pageScope]);
}

/**
 * Quarantined route owner. Search/filter intent may reopen the server traversal; viewport, sheet and list offset never do.
 * Map-area, point and paging operations stay on the accepted anchor through DiscoveryV1ScreenSession.
 */
export function createDiscoveryV1RouteCoordinator(transport:DiscoveryV1OwnerTransport,overlayLoaders:DiscoveryV1OverlayLoaders,
  isCurrent:()=>boolean=()=>true){
  let active=true,generation=0,routeView:MarketplaceView|null=null,selectedMarkerKey:string|null=null,loadingMore=false;
  const screen=createDiscoveryV1ScreenSession(transport,()=>active&&isCurrent());
  const overlay=createDiscoveryV1OverlayOwner(overlayLoaders,()=>active&&isCurrent());
  const search=createDiscoveryV1SearchOwner(transport,()=>active&&isCurrent());

  const current=(g?:number)=>active&&(g===undefined||g===generation)&&isCurrent();
  const screenSnapshot=():DiscoveryV1ScreenSnapshot=>{
    const value=screen.snapshot();
    return routeView?{...value,view:cloneView(routeView)}:value;
  };
  const snapshot=():DiscoveryV1RouteSnapshot=>({active,generation,view:routeView?cloneView(routeView):null,screen:screenSnapshot(),
    overlay:overlay.snapshot(),search:search.snapshot(),selectedMarkerKey,loadingMore});

  const refreshOverlay=async(g:number)=>{
    const rows=screen.snapshot().wireItems.slice(0,DISCOVERY_V1_OVERLAY_LIMIT);
    const result=await overlay.load(rows);
    return current(g)&&result.kind==='applied';
  };

  async function open(next:MarketplaceView,pageLimit=50){
    if(!active)return {kind:'stale' as const,snapshot:snapshot()};
    const g=++generation;routeView=cloneView(next);selectedMarkerKey=null;loadingMore=false;
    const result=await screen.open(routeView,pageLimit);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind!=='applied')return {kind:result.kind,snapshot:snapshot()};
    await refreshOverlay(g);
    if(!current(g))return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  async function updateView(next:MarketplaceView){
    if(!routeView)return open(next);
    const copy=cloneView(next);
    if(discoveryV1RouteIntentKey(copy)!==discoveryV1RouteIntentKey(routeView))return open(copy);
    routeView=copy;
    return {kind:'passive' as const,snapshot:snapshot()};
  }

  async function settleMap(bounds:PublicBounds){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.settleMap(bounds);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      routeView={...routeView,area:[...bounds] as PublicBounds,pinPlace:null,selectedId:null,selectedPlace:null};
      selectedMarkerKey=null;await refreshOverlay(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showPoint(point:{lat:number;lng:number}){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.showPoint(point);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      routeView={...routeView,pinPlace:point.lat.toFixed(2)+','+point.lng.toFixed(2),selectedId:null,selectedPlace:null};
      selectedMarkerKey=null;await refreshOverlay(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showAll(){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.showAll();
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      routeView={...routeView,area:null,pinPlace:null,selectedId:null,selectedPlace:null};
      selectedMarkerKey=null;await refreshOverlay(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function selectMarker(marker:DiscoveryV1MapMarker){
    const g=generation,result=await screen.selectMarker(marker);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    selectedMarkerKey=marker.kind==='CLUSTER'?null:marker.key;
    return {...result,snapshot:snapshot()};
  }

  const clearPeek=()=>{selectedMarkerKey=null;screen.clearPeek();};

  async function nextPage(){
    const g=generation;loadingMore=true;
    try{
      const result=await screen.nextPage();
      if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
      if(result.kind==='applied')await refreshOverlay(g);
      return {kind:result.kind,snapshot:snapshot()};
    }finally{if(current(g))loadingMore=false;}
  }

  async function previewSearch(draft:DiscoveryV1SearchDraft,mapArea:PublicBounds|null,limit=10){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const next={...routeView,...draft} as MarketplaceView;
    const result=await search.preview(next,mapArea,limit);
    return {kind:result.kind,snapshot:snapshot()};
  }
  async function nextSearchPlaces(){const result=await search.nextPlaces();return {kind:result.kind,snapshot:snapshot()};}

  async function applySearch(draft:DiscoveryV1SearchDraft){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    return open({...routeView,...draft,selectedId:null,selectedPlace:null,listOffset:0});
  }

  const retire=()=>{if(!active)return;active=false;generation++;loadingMore=false;selectedMarkerKey=null;routeView=null;
    screen.retire();overlay.retire();search.retire();};

  return {open,updateView,settleMap,showPoint,showAll,selectMarker,clearPeek,nextPage,previewSearch,nextSearchPlaces,applySearch,
    snapshot,retire};
}
