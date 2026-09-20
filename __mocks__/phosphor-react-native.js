'use strict';

/**
 * Phosphor icons under Jest.
 *
 * The icons themselves are harmless in a test — they are SVG — but the package was mocked by hand
 * in 37 test files, each one listing the glyphs the screens it renders happened to import that
 * day. So a screen could not be given an icon without breaking suites that never mention icons,
 * and the failure did not say so: React reports an unlisted glyph as
 * `Element type is invalid … got: undefined`, pointing at the screen rather than at the mock.
 * That is the same pathology the reanimated mock next to this file was written to end, and the
 * same answer: one mock, picked up automatically for a node_modules package, that answers for
 * every name the package can export.
 *
 * Each icon renders as a host element named after itself — `<CaretRight size={20} />` — so a tree
 * dump still says which glyph was drawn. Nothing here draws anything; it only lets a render
 * finish. A test that wants different behaviour still overrides it with its own `jest.mock`.
 */
module.exports = new Proxy(
  {},
  {
    // `__esModule` must stay falsy: the app imports named glyphs, and claiming to be an ES module
    // would send Babel's interop looking for a `default` that means nothing here.
    get: (_target, key) => (key === '__esModule' || typeof key === 'symbol' ? undefined : String(key)),
    has: () => true,
  },
);
