'use strict';

// query-string 7 consumes a callable CommonJS export; upstream 0.5 is ESM.
// Keep the legacy plus-to-space contract while using the maintained decoder.
const decodeUriComponent = require('decode-uri-component-upstream').default;

module.exports = function decodeLegacyComponent(value) {
  return decodeUriComponent(typeof value === 'string' ? value.replace(/\+/g, ' ') : value);
};
