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
  let active=true,attached=true,generation=0,routeView:MarketplaceView|null=null,selectedMarkerKey:string|null=null,loadingMore=false,restoring=0;
  // EX-03: who drives this coordinator right now. A screen that leaves detaches it (the route may keep it for a short while, see DiscoveryV1WarmReturn); the next screen attaches its own callbacks.
  let binding={isCurrent,onOptionalState};
  const driven=()=>active&&attached&&binding.isCurrent();
  const screen=createDiscoveryV1ScreenSession(transport,driven);
  const overlay=createDiscoveryV1OverlayOwner(overlayLoaders,driven);
  const search=createDiscoveryV1SearchOwner(transport,driven);

  const current=(g?:number)=>driven()&&(g===undefined||g===generation);
  // The server's anchor lives 30 minutes. A screen left open longer reads with an expired anchor: the transport names that refusal and the read is RENEWED by one fresh open of the
  // same traversal (the old anchor is never retried). A second refusal, or any other error, reaches the screen exactly as before.
  const anchorExpired=(error:unknown)=>error instanceof Error&&error.message==='DISCOVERY_V1_ANCHOR_EXPIRED';
  // While a read REPLACES what the screen shows (a filter, a place, an area, everything), the last COMPLETE picture stays in the snapshot and the new one lands whole.
  // A commit another action or the overlay makes in the middle of such a read would otherwise publish the owner's emptied state (no rows, no markers), which the screen
  // reads as "nothing found" (found on the emulator: the list rose over the map right after a place was chosen). All of them drop the peek at once. A read that only ADDS
  // to the picture (a next page, a map refresh, a selection) holds nothing back: what another read lands meanwhile is shown at once.
  let reading=0,held:DiscoveryV1ScreenSnapshot|null=null;
  const whileReplacing=async<T,>(work:()=>Promise<T>):Promise<T>=>{
    if(reading++===0)held={...screen.snapshot(),peek:null};
    try{return await work();}
    finally{if(--reading===0)held=null;}
  };
  // Every selection (or dismissal) is a newer intent than a read that began before it: such a read landing later neither takes it away nor puts an older one back.
  let selections=0;
  // A scope change that landed: the new scope, one page read, and no selection, unless one was made (or dismissed) while it was read.
  const scoped=(chosen:number,scope:Partial<MarketplaceView>)=>{
    const fresh=chosen===selections;
    routeView={...routeView!,...scope,pages:1,...(fresh?{selectedId:null,selectedPlace:null}:{})};
    if(fresh)selectedMarkerKey=null;
  };
  const screenSnapshot=():DiscoveryV1ScreenSnapshot=>{
    const value=held??screen.snapshot();
    return routeView?{...value,view:cloneView(routeView)}:value;
  };
  const snapshot=():DiscoveryV1RouteSnapshot=>({active,generation,view:routeView?cloneView(routeView):null,screen:screenSnapshot(),
    overlay:overlay.snapshot(),search:search.snapshot(),selectedMarkerKey,loadingMore});

  const refreshOverlay=async(g:number)=>{
    if(!driven())return false;
    const rows=screen.snapshot().wireItems.slice(0,DISCOVERY_V1_OVERLAY_LIMIT);
    const result=await overlay.load(rows);
    const changed=current(g)&&result.kind==='applied';
    if(changed)binding.onOptionalState();
    return changed;
  };
  const refreshOverlayInBackground=(g:number)=>{void refreshOverlay(g).catch(()=>{if(current(g))binding.onOptionalState();});};
  const savedMarker=()=>{
    if(!routeView)return null;
    const markers=screen.snapshot().mapMarkers;
    if(routeView.selectedId)return markers.find(marker=>marker.kind==='TASK'&&marker.taskId===routeView!.selectedId)??null;
    if(routeView.selectedPlace)return markers.find(marker=>marker.kind==='PLACE'&&pointKey(marker.point)===routeView!.selectedPlace)??null;
    return null;
  };
  const restoreSelection=async(g:number,chosen:number)=>{
    const marker=savedMarker();
    if(!marker||chosen!==selections)return;
    const result=await screen.selectMarker(marker);
    if(!current(g)||result.kind==='stale')return;
    if((result.kind==='TASK'||result.kind==='PLACE')&&result.applied)selectedMarkerKey=marker.key;
    else if(routeView){routeView={...routeView,selectedId:null,selectedPlace:null};selectedMarkerKey=null;}
  };

  async function open(next:MarketplaceView,pageLimit=50){
    if(!active)return {kind:'stale' as const,snapshot:snapshot()};
    const g=++generation,chosen=selections;routeView={...cloneView(next),pages:1};selectedMarkerKey=null;loadingMore=false;
    const result=await whileReplacing(()=>screen.open(routeView!,pageLimit));
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind!=='applied')return {kind:result.kind,snapshot:snapshot()};
    await restoreSelection(g,chosen);
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
    // A traversal that is still being restored (the extra pages) is not a picture worth keeping: `detach`/`warm` say no until it is whole.
    restoring++;
    try{
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
    }finally{restoring--;}
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
    const g=generation,chosen=selections;
    let result;
    try{result=await whileReplacing(()=>screen.settleMap(bounds));}
    catch(error){
      if(!anchorExpired(error)||!current(g)||!routeView)throw error;
      return open({...routeView,area:[...bounds] as PublicBounds,pinPlace:null,selectedId:null,selectedPlace:null});
    }
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      scoped(chosen,{area:[...bounds] as PublicBounds,pinPlace:null});refreshOverlayInBackground(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function refreshMap(bounds:PublicBounds){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation;
    let result;
    try{result=await screen.refreshMap(bounds);}
    catch(error){
      if(!anchorExpired(error)||!current(g)||!routeView)throw error;
      return restore({...routeView});
    }
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showPoint(point:{lat:number;lng:number}){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,chosen=selections;
    let result;
    try{result=await whileReplacing(()=>screen.showPoint(point));}
    catch(error){
      if(!anchorExpired(error)||!current(g)||!routeView)throw error;
      return open({...routeView,pinPlace:pointKey(point),selectedId:null,selectedPlace:null});
    }
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      scoped(chosen,{pinPlace:pointKey(point)});refreshOverlayInBackground(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showAll(){
    if(!routeView)return {kind:'noop' as const,snapshot:snapshot()};
    const g=generation,chosen=selections;
    let result;
    try{result=await whileReplacing(()=>screen.showAll());}
    catch(error){
      if(!anchorExpired(error)||!current(g)||!routeView)throw error;
      return open({...routeView,area:null,pinPlace:null,selectedId:null,selectedPlace:null});
    }
    if(!current(g)||result.kind==='stale')return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'){
      scoped(chosen,{area:null,pinPlace:null});refreshOverlayInBackground(g);
    }
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function selectMarker(marker:DiscoveryV1MapMarker){
    const g=generation;selections++;
    const result=await screen.selectMarker(marker);
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

  const clearPeek=()=>{selections++;selectedMarkerKey=null;if(routeView)routeView={...routeView,selectedId:null,selectedPlace:null};screen.clearPeek();};

  async function nextPage(){
    let g=generation;loadingMore=true;
    try{
      let result;
      try{result=await screen.nextPage();}
      catch(error){
        if(!anchorExpired(error)||!current(g)||!routeView)throw error;
        // One renewal: the traversal is opened again on a fresh anchor at the depth already read (as a return to the screen does), then the page that was asked for is read.
        const renewed=await restore({...routeView});
        if(renewed.kind!=='applied')return {kind:renewed.kind,snapshot:snapshot()};
        g=generation;loadingMore=true;
        result=await screen.nextPage();
      }
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

  // EX-03 (owner approval 2026-09-30): the screen that drives this coordinator may leave and come back within a short while. What it showed is worth keeping only if it is WHOLE: nothing is
  // replacing it (a filter, a place, an area, a refresh), the traversal is not being restored, and a first page was read.
  const whole=()=>reading===0&&restoring===0&&!!routeView&&screen.snapshot().counts!==null;
  /**
   * The screen is leaving but may return (DiscoveryV1WarmReturn). Everything in flight is fenced for good, even if the coordinator is driven again (the owners abort their requests and their
   * sequences move on); what the screen showed stays. Returns whether that picture is whole and worth keeping: false, and the caller retires the coordinator instead.
   */
  const detach=():boolean=>{
    if(!active||!attached)return false;
    const keep=whole();
    attached=false;generation++;loadingMore=false;
    screen.suspend();overlay.suspend();search.suspend();
    return keep;
  };
  /** The next screen takes the coordinator over with its own callbacks. The public picture is shown as it is; the optional overlay (relations, urgency, profiles) is asked again in the background. */
  const attach=(next:{isCurrent:()=>boolean;onOptionalState:()=>void}):boolean=>{
    if(!active)return false;
    binding=next;attached=true;refreshOverlayInBackground(generation);
    return true;
  };
  /** A detached coordinator whose picture can be shown again without a read: whole, and of the same search intent as the view the next screen would open (sheet, offset, camera and selection are not intent). */
  const warm=(next:MarketplaceView):boolean=>active&&!attached&&whole()&&discoveryV1RouteIntentKey(next)===discoveryV1RouteIntentKey(routeView!);

  const retire=()=>{if(!active)return;active=false;generation++;loadingMore=false;selectedMarkerKey=null;routeView=null;held=null;
    screen.retire();overlay.retire();search.retire();};

  return {open,restore,updateView,settleMap,refreshMap,showPoint,showAll,selectMarker,clearPeek,nextPage,previewSearch,nextSearchPlaces,applySearch,
    snapshot,refreshOverlay:()=>refreshOverlay(generation),attach,detach,warm,retire};
}

export type DiscoveryV1RouteCoordinator=ReturnType<typeof createDiscoveryV1RouteCoordinator>;
