'use strict';

const expoPreset = require('jest-expo/jest-preset');

// Extend the installed Expo allowlist instead of copying or replacing its
// native dependency rules. The official decoder alias is ESM in 0.5.0.
const nodeModulesPrefix = '/node_modules/(?!(';
let extendedRules = 0;
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map((pattern) => {
  if (!pattern.startsWith(nodeModulesPrefix)) return pattern;
  extendedRules++;
  return pattern.replace(nodeModulesPrefix, `${nodeModulesPrefix}decode-uri-component-upstream|`);
});
if (extendedRules !== 1) {
  throw new Error('Review the Expo Jest dependency allowlist before extending the decoder transform rule.');
}

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns,
};
