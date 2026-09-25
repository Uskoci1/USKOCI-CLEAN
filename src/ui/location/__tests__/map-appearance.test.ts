import { uskociMapColors } from '../mapAppearance';
import { sys } from '../../system/tokens';

test('a colored public map preserves geometry, source, filtering, widths, zoom limits and label contents', () => {
  const style = {
    version: 8, sources: { public: { type: 'vector', url: 'https://tiles.example/public' } },
    layers: [
      { id: 'water', type: 'fill', source: 'public', 'source-layer': 'water', minzoom: 4, maxzoom: 18,
        filter: ['==', 'class', 'lake'], paint: { 'fill-color': '#eeeeee', 'fill-opacity': 0.7 } },
      { id: 'highway_major_inner', type: 'line', source: 'public', paint: { 'line-color': '#eeeeee', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 16, 8] } },
      { id: 'label_city', type: 'symbol', layout: { 'text-field': ['get', 'name:sr-Latn'], 'text-size': 16 }, paint: { 'text-halo-width': 1.5 } },
    ],
  };
  const before = JSON.stringify(style), result = uskociMapColors(style);
  expect(JSON.stringify(style)).toBe(before);
  expect(result.sources).toBe(style.sources);
  expect(result.layers[0]).toEqual({ ...style.layers[0], paint: { ...style.layers[0].paint, 'fill-color': sys.map.water } });
  expect(result.layers[1]).toEqual({ ...style.layers[1], paint: { ...style.layers[1].paint, 'line-color': sys.map.road } });
  expect(result.layers[2].layout).toBe(style.layers[2].layout);
  expect(result.layers[2].paint).toMatchObject({ 'text-halo-width': 1.5, 'text-color': sys.map.label });
});

test('an unknown provider layer or a changed layer type retains its original appearance', () => {
  const layers = [
    { id: 'new_park', type: 'fill', paint: { 'fill-color': '#123456' } },
    { id: 'water', type: 'line', paint: { 'line-color': '#123456' } },
    { id: 'constructor', type: 'fill', paint: { 'fill-color': '#123456' } },
  ];
  const result = uskociMapColors({ layers });
  layers.forEach((layer, i) => expect(result.layers[i]).toBe(layer));
  expect(uskociMapColors({ name: 'missing', layers: undefined })).toEqual({ name: 'missing', layers: undefined });
});
