import { pointMapUrl, routeMapUrl } from '../locationMapLinks';
const a = { id: 'private-grant-id', label: 'private address', latitude: 45.271234, longitude: 19.831234 };
const b = { ...a, id: 'end', latitude: 46.111111, longitude: 20.222222 };
describe('external map handoff carries coordinates only', () => {
  it('rounds public geography and never routes to an approximate address', () => {
    const url = pointMapUrl(a, true)!;
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=45.27%2C19.83');
    expect(url).not.toContain(a.id); expect(url).not.toContain(a.label);
  });
  it('keeps exact granted points, including true zero, only in the exact action', () => {
    expect(pointMapUrl(a, false)).toContain('destination=45.271234%2C19.831234');
    expect(pointMapUrl({ ...a, latitude: 0, longitude: 0 }, false)).toContain('destination=0%2C0');
    expect(pointMapUrl({ ...a, latitude: NaN }, false)).toBeNull();
    expect(pointMapUrl({ ...a, longitude: 181 }, true)).toBeNull();
  });
  it('preserves the complete route order and never truncates stops for browser limits', () => {
    const mid = { ...a, latitude: 45.5, longitude: 19.9 };
    expect(routeMapUrl([a, mid, b])).toBe('https://www.google.com/maps/dir/?api=1&origin=45.271234%2C19.831234&destination=46.111111%2C20.222222&waypoints=45.5%2C19.9');
    expect(routeMapUrl([a, mid, mid, mid, b])).not.toBeNull();
    expect(routeMapUrl([a, mid, mid, mid, mid, b])).toBeNull();
    expect(routeMapUrl([a])).toBeNull();
    expect(routeMapUrl([a, { ...b, latitude: Infinity }])).toBeNull();
  });
});
