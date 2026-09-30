import { createDiscoveryV1OverlayOwner, DISCOVERY_V1_OVERLAY_LIMIT, type DiscoveryV1OverlayLoaders } from './discoveryV1OverlayOwner';
import { discoveryV1ViewPlan, type DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import { createDiscoveryV1ScreenSession, type DiscoveryV1ScreenSnapshot } from './discoveryV1ScreenSession';
import { createDiscoveryV1SearchOwner } from './discoveryV1SearchOwner';
import type { DiscoveryV1OwnerTransport } from './discoveryV1Owner';
import { pointKey, type MarketplaceView, type PublicBounds } from './marketplaceView';

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

/** A return to the screen reads at most this many pages again before it restores the list offset (8 pages of 50 rows). */
export const DISCOVERY_V1_RESTORE_PAGES=8;

const cloneBounds=(value:PublicBounds|null)=>value?[...value] as PublicBounds:null;
const cloneView=(view:MarketplaceView):MarketplaceView=>({...view,area:cloneBounds(view.area),dates:view.dates?{...view.dates}:null,
  viewport:view.viewport?{...view.viewport,center:[...view.viewport.center] as [number,number],
    bounds:[...view.viewport.bounds] as PublicBounds}:null});

export function discoveryV1RouteIntentKey(view:MarketplaceView):string{
  const plan=discoveryV1ViewPlan(view);
  return JSON.stringify([plan.filter,plan.pageScope]);
}

/**
 * P6 route owner. Search/filter intent may reopen the server traversal; viewport, sheet and list offset never do.
 * Map-area, point and paging operations stay on the accepted anchor through DiscoveryV1ScreenSession.
 */
export function createDiscoveryV1RouteCoordinator(transport:DiscoveryV1OwnerTransport,overlayLoaders:DiscoveryV1OverlayLoaders,
  isCurrent:()=>boolean=()=>true,onOptionalState:()=>void=()=>{}){
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
    const changed=current(g)&&result.kind==='applied';
    if(changed)onOptionalState();
    return changed;
  };
  const refreshOverlayInBackground=(g:number)=>{void refreshOverlay(g).catch(()=>{if(current(g))onOptionalState();});};
  const savedMarker=()=>{
    if(!routeView)return null;
    const markers=screen.snapshot().mapMarkers;
    if(routeView.selectedId)return markers.find(marker=>marker.kind==='TASK'&&marker.taskId===routeView!.selectedId)??null;
    if(routeView.selectedPlace)return markers.find(marker=>marker.kind==='PLACE'&&pointKey(marker.point)===routeView!.selectedPlace)??null;
    return null;
  };
  const restoreSelection=async(g:number)=>{
    const marker=savedMarker();
    if(!marker)return;
    const result=await screen.selectMarker(marker);
    if(!current(g)||result.kind==='stale')return;
    if((result.kind==='TASK'||result.kind==='PLACE')&&result.applied)selectedMarkerKey=marker.key;
    else if(routeView){routeView={...routeView,selectedId:null,selectedPlace:null};selectedMarkerKey=null;}
  };

  async function open(next:MarketplaceView,pageLimit=50){
    if(!active)return {kind:'stale' as const,snapshot:snapshot()};
    const g=++generation;routeView={...cloneView(next),pages:1};selectedMarkerKey=null;loadingMore=false;
    const result=await screen.open(routeView,pageLimit);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind!=='applied')return {kind:result.kind,snapshot:snapshot()};
    await restoreSelection(g);
    if(!current(g))return {kind:'stale' as const,snapshot:snapshot()};
    refreshOverlayInBackground(g);
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  /**
   * Opens the traversal for a return to the screen: the first page as `open` reads it, then as many further pages as the list
   * had read (`next.pages`, at most DISCOVERY_V1_RESTORE_PAGES), so that the presentation restores its offset over the same
   * rows instead of clamping it to the end of page one. Extra pages are best effort: a failed or exhausted one keeps what is read.
   */
  async function restore(next:MarketplaceView,pageLimit=50){
    const wanted=Math.min(DISCOVERY_V1_RESTORE_PAGES,Math.max(1,Math.trunc(next.pages??1)||1));
    const first=await open(next,pageLimit);
    if(first.kind!=='applied'||wanted<2)return first;
    const g=generation;
    for(let read=1;read<wanted&&screen.snapshot().pageHasMore;read++){
      let step;
      try{step=await screen.nextPage();}catch{break;}
      if(!current(g)||step.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
      if(step.kind!=='applied'||!routeView)break;
      routeView={...routeView,pages:read+1};
    }
    refreshOverlayInBackground(g);
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  async function updateView(next:MarketplaceView){
    if(!routeView)return open(next);
    const copy=cloneView(next);
    if(discoveryV1RouteIntentKey(copy)!==discoveryV1RouteIntentKey(routeView))return open(copy);
    // The read depth is the coordinator's: a screen hands back the view it was last given, which may be one page behind.
    routeView={...copy,pages:routeView.pages};
    return {kind:'passive' as const,snapshot:snapshot()};
  }

  async function settleMap(bounds:PublicBounds){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.settleMap(bounds);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      routeView={...routeView,area:[...bounds] as PublicBounds,pinPlace:null,selectedId:null,selectedPlace:null,pages:1};
      selectedMarkerKey=null;refreshOverlayInBackground(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function refreshMap(bounds:PublicBounds){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.refreshMap(bounds);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showPoint(point:{lat:number;lng:number}){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.showPoint(point);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      routeView={...routeView,pinPlace:pointKey(point),selectedId:null,selectedPlace:null,pages:1};
      selectedMarkerKey=null;refreshOverlayInBackground(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showAll(){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,result=await screen.showAll();
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      routeView={...routeView,area:null,pinPlace:null,selectedId:null,selectedPlace:null,pages:1};
      selectedMarkerKey=null;refreshOverlayInBackground(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function selectMarker(marker:DiscoveryV1MapMarker){
    const g=generation,result=await screen.selectMarker(marker);
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='CLUSTER'){
      if(routeView)routeView={...routeView,selectedId:null,selectedPlace:null};
      selectedMarkerKey=null;
    }else if(result.applied&&routeView){
      if(result.kind==='TASK'&&marker.kind==='TASK')
        routeView={...routeView,selectedId:marker.taskId,selectedPlace:null,sheet:'peek'};
      else if(result.kind==='PLACE'&&marker.kind==='PLACE')
        routeView={...routeView,selectedId:null,selectedPlace:pointKey(marker.point),sheet:'peek'};
      else throw new Error('DISCOVERY_V1_ROUTE_SELECTION_KIND_DRIFT');
      selectedMarkerKey=marker.key;
    }else{
      if(routeView)routeView={...routeView,selectedId:null,selectedPlace:null};
      selectedMarkerKey=null;
    }
    return {...result,snapshot:snapshot()};
  }

  const clearPeek=()=>{selectedMarkerKey=null;if(routeView)routeView={...routeView,selectedId:null,selectedPlace:null};screen.clearPeek();};

  async function nextPage(){
    const g=generation;loadingMore=true;
    try{
      const result=await screen.nextPage();
      if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
      if(result.kind==='applied'){
        if(routeView)routeView={...routeView,pages:(routeView.pages??1)+1};
        refreshOverlayInBackground(g);
      }
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

  return {open,restore,updateView,settleMap,refreshMap,showPoint,showAll,selectMarker,clearPeek,nextPage,previewSearch,nextSearchPlaces,applySearch,
    snapshot,refreshOverlay:()=>refreshOverlay(generation),retire};
}
