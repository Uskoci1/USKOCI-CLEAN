import { decodeDiscoveryV1Exact, decodeDiscoveryV1Page, type DiscoveryV1Anchor, type DiscoveryV1Cursor,
  type DiscoveryV1ExactResponse, type DiscoveryV1Filter, type DiscoveryV1PageResponse } from './discoveryV1Contract';
import { decodeDiscoveryV1Map, decodeDiscoveryV1Places, type DiscoveryV1MapResponse,
  type DiscoveryV1PlacesResponse } from './discoveryV1SpatialContract';

export type DiscoveryV1Bounds = [number, number, number, number];
export type DiscoveryV1Point = { lat: number; lng: number };
export type DiscoveryV1Scope =
  | { kind: 'ALL' }
  | { kind: 'AREA'; bounds: DiscoveryV1Bounds }
  | { kind: 'POINT_LIST' | 'POINT_MEMBERS'; point: DiscoveryV1Point };

export type DiscoveryV1PageRequest = {
  mode: 'PAGE'; filter: DiscoveryV1Filter; anchor: DiscoveryV1Anchor | null; scope: DiscoveryV1Scope;
  limit: number; after: DiscoveryV1Cursor | null;
};
export type DiscoveryV1MapRequest = {
  mode: 'MAP'; filter: DiscoveryV1Filter; anchor: DiscoveryV1Anchor; bounds: DiscoveryV1Bounds; grid: number;
};
export type DiscoveryV1PlacesRequest = {
  mode: 'PLACES'; filter: DiscoveryV1Filter; anchor: DiscoveryV1Anchor | null; prefix: string;
  facetArea: DiscoveryV1Bounds | null; limit: number; after: DiscoveryV1PlacesResponse['nextCursor'];
};
export type DiscoveryV1ExactRequest = { mode: 'EXACT_PUBLIC'; needId: string };
export type DiscoveryV1OwnerRequest = DiscoveryV1PageRequest | DiscoveryV1MapRequest | DiscoveryV1PlacesRequest | DiscoveryV1ExactRequest;
export type DiscoveryV1OwnerTransport = (request: DiscoveryV1OwnerRequest, signal: AbortSignal) => Promise<unknown>;

export type DiscoveryV1PageState = Omit<DiscoveryV1PageResponse, 'items'> & { items: DiscoveryV1PageResponse['items'] };
export type DiscoveryV1PlacesState = Omit<DiscoveryV1PlacesResponse, 'items'> & { items: DiscoveryV1PlacesResponse['items'] };
export type DiscoveryV1OwnerSnapshot = {
  active: boolean; epoch: number; page: DiscoveryV1PageState | null; map: DiscoveryV1MapResponse | null;
  places: DiscoveryV1PlacesState | null; exact: DiscoveryV1ExactResponse | null;
};
export type DiscoveryV1OwnerResult<T> =
  | { kind: 'applied'; value: T }
  | { kind: 'stale' }
  | { kind: 'noop'; reason: 'NO_INTENT' | 'NO_PAGE_ANCHOR' | 'NO_MORE' | 'NO_PLACES_CHAIN' };

type Intent = { filter: DiscoveryV1Filter; scope: DiscoveryV1Scope; pageLimit: number };
type Token = { epoch: number; sequence: number };
type PlacesBase = { prefix: string; facetArea: DiscoveryV1Bounds | null; limit: number };

const stale = <T>(): DiscoveryV1OwnerResult<T> => ({ kind: 'stale' });
const noop = <T>(reason: 'NO_INTENT' | 'NO_PAGE_ANCHOR' | 'NO_MORE' | 'NO_PLACES_CHAIN'): DiscoveryV1OwnerResult<T> => ({ kind: 'noop', reason });
const applied = <T>(value: T): DiscoveryV1OwnerResult<T> => ({ kind: 'applied', value });

const validLimit = (value: number, max: number, code: string) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(code);
  return value;
};
const cloneFilter = (filter: DiscoveryV1Filter): DiscoveryV1Filter => ({
  ...filter, dates: filter.dates ? { ...filter.dates } : null,
});
const cloneBounds = (bounds: DiscoveryV1Bounds): DiscoveryV1Bounds => [...bounds] as DiscoveryV1Bounds;
const cloneScope = (scope: DiscoveryV1Scope): DiscoveryV1Scope => scope.kind === 'ALL' ? { kind: 'ALL' }
  : scope.kind === 'AREA' ? { kind: 'AREA', bounds: cloneBounds(scope.bounds) }
  : { kind: scope.kind, point: { ...scope.point } };
const sameAnchor = (a: DiscoveryV1Anchor | null, b: DiscoveryV1Anchor | null) => !!a && !!b
  && a.version === b.version && a.filterKey === b.filterKey && a.timeAt === b.timeAt
  && a.publishedThrough === b.publishedThrough && a.expiresAt === b.expiresAt;
const sameBounds = (a: DiscoveryV1Bounds, b: DiscoveryV1Bounds) => a.every((value, index) => value === b[index]);
const cursorIdentity = (cursor: DiscoveryV1Cursor | null) => cursor
  ? [cursor.scopeKey, cursor.section, cursor.sortAt, cursor.id].join('|') : 'terminal';
const placeCursorIdentity = (cursor: DiscoveryV1PlacesResponse['nextCursor']) => cursor
  ? [cursor.count, cursor.text, cursor.key].join('|') : 'terminal';

export function createDiscoveryV1Owner(transport: DiscoveryV1OwnerTransport, isCurrent: () => boolean = () => true) {
  let active = true, epoch = 0, intent: Intent | null = null;
  let page: DiscoveryV1PageState | null = null, map: DiscoveryV1MapResponse | null = null;
  let places: DiscoveryV1PlacesState | null = null, exact: DiscoveryV1ExactResponse | null = null;
  let pageAnchor: DiscoveryV1Anchor | null = null, placesBase: PlacesBase | null = null;
  let pageSequence = 0, mapSequence = 0, placesSequence = 0, exactSequence = 0;
  let pageAbort: AbortController | null = null, mapAbort: AbortController | null = null;
  let placesAbort: AbortController | null = null, exactAbort: AbortController | null = null;
  let nextPageFlight: { key: string; promise: Promise<DiscoveryV1OwnerResult<DiscoveryV1PageState>> } | null = null;
  let nextPlacesFlight: { key: string; promise: Promise<DiscoveryV1OwnerResult<DiscoveryV1PlacesState>> } | null = null;

  const abort = (controller: AbortController | null) => controller?.abort();
  const abortAll = () => {
    abort(pageAbort); abort(mapAbort); abort(placesAbort); abort(exactAbort);
    pageAbort = mapAbort = placesAbort = exactAbort = null;
    nextPageFlight = null; nextPlacesFlight = null;
  };
  const tokenCurrent = (token: Token, sequence: number) =>
    active && token.epoch === epoch && token.sequence === sequence && isCurrent();
  const snapshot = (): DiscoveryV1OwnerSnapshot => ({ active, epoch, page, map, places, exact });

  const begin = (filter: DiscoveryV1Filter, scope: DiscoveryV1Scope = { kind: 'ALL' }, pageLimit = 50) => {
    if (!active) throw new Error('DISCOVERY_V1_OWNER_RETIRED');
    validLimit(pageLimit, 100, 'DISCOVERY_V1_OWNER_PAGE_LIMIT');
    epoch++; abortAll();
    intent = { filter: cloneFilter(filter), scope: cloneScope(scope), pageLimit };
    page = null; map = null; places = null; exact = null; pageAnchor = null; placesBase = null;
    pageSequence++; mapSequence++; placesSequence++; exactSequence++;
    return snapshot();
  };
  const requireIntent = () => intent;

  const setScope = (scope: DiscoveryV1Scope) => {
    const currentIntent = requireIntent();
    if (!currentIntent) return false;
    abort(pageAbort); pageAbort = null; nextPageFlight = null; pageSequence++;
    intent = { ...currentIntent, scope: cloneScope(scope) };
    page = null;
    return true;
  };

  async function firstPage(): Promise<DiscoveryV1OwnerResult<DiscoveryV1PageState>> {
    const currentIntent = requireIntent();
    if (!currentIntent) return noop('NO_INTENT');
    const sequence = ++pageSequence, token = { epoch, sequence };
    abort(pageAbort); nextPageFlight = null;
    const controller = new AbortController(); pageAbort = controller;
    const request: DiscoveryV1PageRequest = { mode: 'PAGE', filter: cloneFilter(currentIntent.filter), anchor: pageAnchor,
      scope: cloneScope(currentIntent.scope), limit: currentIntent.pageLimit, after: null };
    try {
      let raw: unknown;
      try { raw = await transport(request, controller.signal); }
      catch (error) { if (!tokenCurrent(token, pageSequence)) return stale(); throw error; }
      if (!tokenCurrent(token, pageSequence)) return stale();
      const decoded = decodeDiscoveryV1Page(raw, currentIntent.pageLimit);
      if (pageAnchor && !sameAnchor(pageAnchor, decoded.anchor)) throw new Error('DISCOVERY_V1_OWNER_PAGE_ANCHOR_DRIFT');
      pageAnchor = decoded.anchor; page = decoded;
      return applied(page);
    } finally {
      controller.abort();
      if (pageAbort === controller) pageAbort = null;
    }
  }

  function nextPage(): Promise<DiscoveryV1OwnerResult<DiscoveryV1PageState>> {
    const currentIntent = requireIntent();
    if (!currentIntent) return Promise.resolve(noop('NO_INTENT'));
    const previous = page, previousCursor = previous?.nextCursor ?? null;
    if (!previous || !previous.hasMore || !previousCursor || !pageAnchor) return Promise.resolve(noop('NO_MORE'));
    const flightKey = [epoch, pageSequence, cursorIdentity(previousCursor)].join(':');
    if (nextPageFlight?.key === flightKey) return nextPageFlight.promise;
    const sequence = ++pageSequence, token = { epoch, sequence };
    abort(pageAbort);
    const controller = new AbortController(); pageAbort = controller;
    const request: DiscoveryV1PageRequest = { mode: 'PAGE', filter: cloneFilter(currentIntent.filter), anchor: pageAnchor,
      scope: cloneScope(currentIntent.scope), limit: currentIntent.pageLimit, after: { ...previousCursor } };
    const promise = (async (): Promise<DiscoveryV1OwnerResult<DiscoveryV1PageState>> => {
      try {
        let raw: unknown;
        try { raw = await transport(request, controller.signal); }
        catch (error) { if (!tokenCurrent(token, pageSequence)) return stale(); throw error; }
        if (!tokenCurrent(token, pageSequence)) return stale();
        const decoded = decodeDiscoveryV1Page(raw, currentIntent.pageLimit);
        if (!sameAnchor(pageAnchor, decoded.anchor)) throw new Error('DISCOVERY_V1_OWNER_PAGE_ANCHOR_DRIFT');
        if (decoded.nextCursor && decoded.nextCursor.scopeKey !== previousCursor.scopeKey)
          throw new Error('DISCOVERY_V1_OWNER_PAGE_SCOPE_DRIFT');
        const seen = new Set(previous.items.map(item => item.id)), items = [...previous.items];
        for (const item of decoded.items) if (!seen.has(item.id)) { seen.add(item.id); items.push(item); }
        page = { ...decoded, items };
        return applied(page);
      } finally {
        controller.abort();
        if (pageAbort === controller) pageAbort = null;
      }
    })();
    nextPageFlight = { key: [epoch, sequence, cursorIdentity(previousCursor)].join(':'), promise };
    const clearNextPage = () => { if (nextPageFlight?.promise === promise) nextPageFlight = null; };
    void promise.then(clearNextPage, clearNextPage);
    return promise;
  }

  async function loadMap(bounds: DiscoveryV1Bounds, grid = 24): Promise<DiscoveryV1OwnerResult<DiscoveryV1MapResponse>> {
    const currentIntent = requireIntent();
    if (!currentIntent) return noop('NO_INTENT');
    if (!pageAnchor) return noop('NO_PAGE_ANCHOR');
    validLimit(grid, 24, 'DISCOVERY_V1_OWNER_MAP_GRID');
    const sequence = ++mapSequence, token = { epoch, sequence };
    abort(mapAbort);
    const controller = new AbortController(); mapAbort = controller;
    const request: DiscoveryV1MapRequest = { mode: 'MAP', filter: cloneFilter(currentIntent.filter), anchor: { ...pageAnchor },
      bounds: cloneBounds(bounds), grid };
    try {
      let raw: unknown;
      try { raw = await transport(request, controller.signal); }
      catch (error) { if (!tokenCurrent(token, mapSequence)) return stale(); throw error; }
      if (!tokenCurrent(token, mapSequence)) return stale();
      const decoded = decodeDiscoveryV1Map(raw);
      if (!sameAnchor(pageAnchor, decoded.anchor)) throw new Error('DISCOVERY_V1_OWNER_MAP_ANCHOR_DRIFT');
      if (!sameBounds(decoded.coverageBounds as DiscoveryV1Bounds, bounds)) throw new Error('DISCOVERY_V1_OWNER_MAP_COVERAGE_DRIFT');
      map = decoded;
      return applied(map);
    } finally {
      controller.abort();
      if (mapAbort === controller) mapAbort = null;
    }
  }

  async function firstPlaces(prefix: string, facetArea: DiscoveryV1Bounds | null = null, limit = 10)
    : Promise<DiscoveryV1OwnerResult<DiscoveryV1PlacesState>> {
    const currentIntent = requireIntent();
    if (!currentIntent) return noop('NO_INTENT');
    validLimit(limit, 30, 'DISCOVERY_V1_OWNER_PLACES_LIMIT');
    const sequence = ++placesSequence, token = { epoch, sequence };
    abort(placesAbort); nextPlacesFlight = null;
    const controller = new AbortController(); placesAbort = controller;
    const base: PlacesBase = { prefix, facetArea: facetArea ? cloneBounds(facetArea) : null, limit };
    const request: DiscoveryV1PlacesRequest = { mode: 'PLACES', filter: cloneFilter(currentIntent.filter), anchor: null,
      prefix, facetArea: base.facetArea ? cloneBounds(base.facetArea) : null, limit, after: null };
    try {
      let raw: unknown;
      try { raw = await transport(request, controller.signal); }
      catch (error) { if (!tokenCurrent(token, placesSequence)) return stale(); throw error; }
      if (!tokenCurrent(token, placesSequence)) return stale();
      places = decodeDiscoveryV1Places(raw, limit); placesBase = base;
      return applied(places);
    } finally {
      controller.abort();
      if (placesAbort === controller) placesAbort = null;
    }
  }

  function nextPlaces(): Promise<DiscoveryV1OwnerResult<DiscoveryV1PlacesState>> {
    const currentIntent = requireIntent();
    if (!currentIntent) return Promise.resolve(noop('NO_INTENT'));
    const current = places, base = placesBase, previousCursor = current?.nextCursor ?? null;
    if (!current || !base) return Promise.resolve(noop('NO_PLACES_CHAIN'));
    if (!current.hasMore || !previousCursor) return Promise.resolve(noop('NO_MORE'));
    const flightKey = [epoch, placesSequence, placeCursorIdentity(previousCursor)].join(':');
    if (nextPlacesFlight?.key === flightKey) return nextPlacesFlight.promise;
    const sequence = ++placesSequence, token = { epoch, sequence };
    abort(placesAbort);
    const controller = new AbortController(); placesAbort = controller;
    const request: DiscoveryV1PlacesRequest = { mode: 'PLACES', filter: cloneFilter(currentIntent.filter), anchor: { ...current.anchor },
      prefix: base.prefix, facetArea: base.facetArea ? cloneBounds(base.facetArea) : null, limit: base.limit, after: { ...previousCursor } };
    const promise = (async (): Promise<DiscoveryV1OwnerResult<DiscoveryV1PlacesState>> => {
      try {
        let raw: unknown;
        try { raw = await transport(request, controller.signal); }
        catch (error) { if (!tokenCurrent(token, placesSequence)) return stale(); throw error; }
        if (!tokenCurrent(token, placesSequence)) return stale();
        const decoded = decodeDiscoveryV1Places(raw, base.limit);
        if (!sameAnchor(current.anchor, decoded.anchor)) throw new Error('DISCOVERY_V1_OWNER_PLACES_ANCHOR_DRIFT');
        const seen = new Set(current.items.map(item => item.key)), items = [...current.items];
        for (const item of decoded.items) if (!seen.has(item.key)) { seen.add(item.key); items.push(item); }
        places = { ...decoded, items };
        return applied(places);
      } finally {
        controller.abort();
        if (placesAbort === controller) placesAbort = null;
      }
    })();
    nextPlacesFlight = { key: [epoch, sequence, placeCursorIdentity(previousCursor)].join(':'), promise };
    const clearNextPlaces = () => { if (nextPlacesFlight?.promise === promise) nextPlacesFlight = null; };
    void promise.then(clearNextPlaces, clearNextPlaces);
    return promise;
  }

  async function readExact(needId: string): Promise<DiscoveryV1OwnerResult<DiscoveryV1ExactResponse>> {
    if (!requireIntent()) return noop('NO_INTENT');
    const sequence = ++exactSequence, token = { epoch, sequence };
    abort(exactAbort);
    const controller = new AbortController(); exactAbort = controller;
    try {
      let raw: unknown;
      try { raw = await transport({ mode: 'EXACT_PUBLIC', needId }, controller.signal); }
      catch (error) { if (!tokenCurrent(token, exactSequence)) return stale(); throw error; }
      if (!tokenCurrent(token, exactSequence)) return stale();
      exact = decodeDiscoveryV1Exact(raw, needId);
      return applied(exact);
    } finally {
      controller.abort();
      if (exactAbort === controller) exactAbort = null;
    }
  }

  const retire = () => {
    if (!active) return;
    active = false; epoch++; pageSequence++; mapSequence++; placesSequence++; exactSequence++;
    abortAll(); intent = null; page = null; map = null; places = null; exact = null; pageAnchor = null; placesBase = null;
  };

  return { begin, setScope, firstPage, nextPage, loadMap, firstPlaces, nextPlaces, readExact, retire, snapshot };
}
