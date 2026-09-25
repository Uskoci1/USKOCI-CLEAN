'use strict';

/**
 * MapLibre under Jest.
 *
 * The package ships ESM that Jest does not transform, so a suite does not fail an assertion when a
 * screen starts showing a map — it fails to parse at all, with "Jest encountered an unexpected
 * token" and no mention of the screen that caused it. Until 2026-09-20 only the map screens
 * themselves imported it, so the four suites that needed it wrote their own mock; the moment the
 * public Task detail began showing where the job is, two unrelated suites stopped running.
 *
 * This is the same answer as the reanimated and phosphor mocks beside it: one default that lets a
 * render finish, picked up automatically for a node_modules package. It draws nothing and it never
 * reports the map as loaded, so a screen under this mock shows its loading state — which is the
 * honest thing for a map that does not exist. The suites that assert what the renderer does with
 * the camera, the projection or a cluster keep their own `jest.mock`; this one is for the screens
 * that merely contain a map.
 */
const React = require('react');

/** Imperative handles the renderers call. Inert, and shaped like what the real ones return. */
const handle = () => ({
  jumpTo: () => undefined,
  easeTo: () => undefined,
  zoomTo: () => undefined,
  flyTo: () => undefined,
  setCamera: () => undefined,
  project: async () => null,
  unproject: async () => null,
  getZoom: async () => 0,
  getCenter: async () => [0, 0],
  getVisibleBounds: async () => null,
  getClusterExpansionZoom: async () => 0,
  getClusterLeaves: async () => ({ features: [] }),
});

const host = (name) => {
  const Component = React.forwardRef(({ children, ...props }, ref) => {
    React.useImperativeHandle(ref, handle);
    return React.createElement(name, props, children);
  });
  Component.displayName = name;
  return Component;
};

module.exports = {
  __esModule: true,
  Map: host('NativeMap'),
  MapView: host('NativeMap'),
  Camera: host('NativeCamera'),
  Marker: host('NativeMarker'),
  PointAnnotation: host('NativePointAnnotation'),
  ViewAnnotation: host('NativeViewAnnotation'),
  Layer: host('NativeLayer'),
  Images: host('NativeImages'),
  SymbolLayer: host('NativeSymbolLayer'),
  CircleLayer: host('NativeCircleLayer'),
  GeoJSONSource: host('NativeGeoJSONSource'),
  ShapeSource: host('NativeShapeSource'),
  UserLocation: host('NativeUserLocation'),
  LocationManager: {
    start: () => undefined,
    stop: () => undefined,
    getLastKnownLocation: async () => null,
    requestAuthorization: async () => 'denied',
    addListener: () => undefined,
    removeListener: () => undefined,
  },
  UserTrackingMode: { Follow: 'follow', FollowWithHeading: 'followWithHeading', FollowWithCourse: 'followWithCourse' },
  setAccessToken: () => undefined,
};
