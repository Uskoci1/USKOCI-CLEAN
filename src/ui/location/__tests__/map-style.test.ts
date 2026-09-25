import { currentMapStyle, forgetMapStyle, LATIN_PLACE_NAME, latinLabels, loadMapStyle, MAP_STYLE_DEADLINE_MS, MAP_STYLE_RETRY_MS, MAP_STYLE_URL }
  from '../mapStyle';
import { uskociMapColors } from '../mapAppearance';

/**
 * Map labels in Serbian Latin (Zadaci, 2026-09-24). The fixture is a small copy of the shapes the OpenFreeMap positron
 * style uses (read from the public style on 2026-09-24): place and road names are a `case` on `name:nonlatin` that
 * prints both scripts ("Beograd Београд"), shields read `ref`. Only names change; everything else is left as it was.
 */
const BOTH_SCRIPTS = ['case', ['has', 'name:nonlatin'], ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']],
  ['coalesce', ['get', 'name_en'], ['get', 'name']]];
const fixture = () => ({
  version: 8,
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    ne2_shaded: { type: 'raster', tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'] } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
    { id: 'label_city', type: 'symbol', layout: { 'text-field': BOTH_SCRIPTS, 'text-font': ['Noto Sans Regular'] } },
    { id: 'highway-name-major', type: 'symbol', layout: { 'text-field': ['case', ['has', 'name:nonlatin'], ['concat', ['get', 'name:latin'], ' ', ['get', 'name:nonlatin']], ['get', 'name']] } },
    { id: 'legacy_label', type: 'symbol', layout: { 'text-field': '{name:latin}\n{name:nonlatin}' } },
    { id: 'road_shield', type: 'symbol', layout: { 'text-field': ['to-string', ['get', 'ref']] } },
    { id: 'poi_icon', type: 'symbol', layout: { 'icon-image': 'dot' } },
  ],
});
const field = (style: { layers: unknown[] }, id: string) => (style.layers.find(layer => (layer as { id: string }).id === id) as { layout?: Record<string, unknown> }).layout?.['text-field'];

describe('latinLabels', () => {
  it('puts the Serbian Latin name first on every place-name label and keeps the layer\'s own expression as the last fallback', () => {
    const style = fixture(), latin = latinLabels(style);
    expect(LATIN_PLACE_NAME).toEqual(['coalesce', ['get', 'name:sr-Latn'], ['get', 'name:latin'], ['get', 'name']]);
    expect(field(latin, 'label_city')).toEqual(['coalesce', ['get', 'name:sr-Latn'], ['get', 'name:latin'], ['get', 'name'], BOTH_SCRIPTS]);
    expect((field(latin, 'highway-name-major') as unknown[]).slice(0, 4)).toEqual([...LATIN_PLACE_NAME]);
  });
  it('replaces a legacy token string outright: inside an expression it would be drawn as its literal braces', () => {
    expect(field(latinLabels(fixture()), 'legacy_label')).toEqual([...LATIN_PLACE_NAME]);
  });
  it('leaves labels that are not names, layers without text and every other key exactly as they were, and never changes its input', () => {
    const style = fixture(), before = JSON.stringify(style), latin = latinLabels(style);
    expect(JSON.stringify(style)).toBe(before);
    expect(field(latin, 'road_shield')).toEqual(['to-string', ['get', 'ref']]);
    expect(latin.layers[0]).toBe(style.layers[0]);
    expect(latin.layers[5]).toBe(style.layers[5]);
    expect({ ...latin, layers: undefined }).toEqual({ ...style, layers: undefined });
    expect((latin.layers[1] as { layout: Record<string, unknown> }).layout['text-font']).toEqual(['Noto Sans Regular']);
  });
});

describe('loadMapStyle', () => {
  const ok = (json: unknown) => jest.fn(async () => ({ ok: true, json: async () => json }));
  beforeEach(() => { forgetMapStyle(); jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-24T10:00:00Z')); });
  afterEach(() => { forgetMapStyle(); jest.useRealTimers(); });

  it('Jest itself never reaches the network: every map in every suite gets the address, as before', async () => {
    expect(currentMapStyle()).toBe(MAP_STYLE_URL);
    await expect(loadMapStyle()).resolves.toBe(MAP_STYLE_URL);
  });
  // Review r3 item 12 (2026-09-24): the Latin style is handed over as its JSON text, made once, instead of an object that
  // MapLibre's Map stringified again on every render. These two tests pinned the object; what they guard is unchanged:
  // one read for the whole app, the same style for every later map, and place names in Serbian Latin.
  it('reads the public style once for the whole app and hands every later map the same Latin style, as text made once', async () => {
    const fetcher = ok(fixture());
    expect(currentMapStyle(Date.now(), fetcher)).toBeNull();
    const [first, second] = await Promise.all([loadMapStyle(fetcher), loadMapStyle(fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledWith(MAP_STYLE_URL);
    expect(first).toBe(second); expect(typeof first).toBe('string');
    expect(JSON.parse(first as string)).toEqual(latinLabels(uskociMapColors(fixture())));
    expect(field(JSON.parse(first as string), 'label_city')).toEqual(expect.arrayContaining([['get', 'name:sr-Latn']]));
    expect(await loadMapStyle(fetcher)).toBe(first); expect(currentMapStyle(Date.now(), fetcher)).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['an HTTP failure', jest.fn(async () => ({ ok: false, json: async () => fixture() }))],
    ['a network failure', jest.fn(async () => { throw new Error('offline'); })],
    ['a style that is not version 8', ok({ ...fixture(), version: 7 })],
    ['a relative address that would lose its base', ok({ ...fixture(), sprite: '/sprites/ofm' })],
    ['a plain-http source', ok({ ...fixture(), sources: { openmaptiles: { type: 'vector', url: 'http://tiles.example/planet' } } })],
  ])('falls back to the address after %s, and tries again only a minute later', async (_case, fetcher) => {
    await expect(loadMapStyle(fetcher)).resolves.toBe(MAP_STYLE_URL);
    expect(currentMapStyle(Date.now(), fetcher)).toBe(MAP_STYLE_URL);
    await loadMapStyle(fetcher); expect(fetcher).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + MAP_STYLE_RETRY_MS + 1);
    expect(currentMapStyle(Date.now(), fetcher)).toBeNull();
    await loadMapStyle(fetcher); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('a slow read gives the waiting map the address at its deadline, and still serves the next map when it lands', async () => {
    let answer!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetcher = jest.fn(() => new Promise<{ ok: boolean; json: () => Promise<unknown> }>(resolve => { answer = resolve; }));
    const waiting = loadMapStyle(fetcher);
    await Promise.resolve(); jest.advanceTimersByTime(MAP_STYLE_DEADLINE_MS + 1);
    await expect(waiting).resolves.toBe(MAP_STYLE_URL);
    answer({ ok: true, json: async () => fixture() });
    await jest.runAllTimersAsync();
    const next = currentMapStyle(Date.now(), fetcher);
    expect(next).not.toBe(MAP_STYLE_URL); expect(typeof next).toBe('string');
    expect(field(JSON.parse(next as string), 'label_city')).toEqual(expect.arrayContaining([['get', 'name:sr-Latn']]));
  });
});
