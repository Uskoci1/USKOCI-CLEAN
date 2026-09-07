import { execFileSync } from 'node:child_process';

describe('installed Expo Router query decoder', () => {
  it('transforms the decoder on Linux while preserving native and unrelated dependency rules', () => {
    const { transformIgnorePatterns } = require('../jest.config.cjs');
    const ignored = (modulePath: string) => transformIgnorePatterns.some((pattern: string) =>
      new RegExp(pattern).test(`/home/runner/work/USKOCI-CLEAN/node_modules/${modulePath}`));
    expect(ignored('decode-uri-component-upstream/index.js')).toBe(false);
    expect(ignored('expo-router/build/views/Screen.js')).toBe(false);
    expect(ignored('react-native/index.js')).toBe(false);
    expect(ignored('lodash/index.js')).toBe(true);
    expect(ignored('react-native-reanimated/plugin/index.js')).toBe(true);
    expect(ignored('@react-native/babel-preset/index.js')).toBe(true);
  });

  it('loads the real patched decoder through query-string inside Jest', () => {
    // Unlike the bounded Node child checks below, this exercises Jest's own
    // ESM transform path used when loading the actual Expo screen filter.
    const query = require('query-string');
    const decoder = require('decode-uri-component');
    expect(typeof decoder).toBe('function');
    expect(decoder('USKO%C4%8CI+%F0%9F%91%8B')).toBe('USKOČI 👋');
    expect({ ...query.parse('city=Novi+Sad&plus=%2B&title=USKO%C4%8CI') }).toEqual({
      city: 'Novi Sad', plus: '+', title: 'USKOČI',
    });
  });

  it('keeps Router CommonJS parsing, Unicode, plus, array and fragment behavior', () => {
    const result = execFileSync(process.execPath, ['-e', String.raw`
      const assert = require('node:assert/strict');
      const {createRequire} = require('node:module');
      const routerRequire = createRequire(require.resolve('expo-router/package.json'));
      const queryPath = routerRequire.resolve('query-string');
      const query = routerRequire('query-string');
      const decoder = createRequire(queryPath)('decode-uri-component');
      assert.equal(typeof decoder, 'function');
      assert.equal(decoder('USKO%C4%8CI+%F0%9F%91%8B'), 'USKOČI 👋');
      assert.equal(decoder('%EA%41%'), '%EAA%');
      assert.throws(() => decoder(null), TypeError);
      assert.deepEqual({...query.parse('city=Novi+Sad&q=USKO%C4%8CI&tag=a&tag=b&empty=')},
        {city: 'Novi Sad', empty: '', q: 'USKOČI', tag: ['a', 'b']});
      assert.equal(query.stringify({needId: 'a/b', q: 'č + %'}), 'needId=a%2Fb&q=%C4%8D%20%2B%20%25');
      assert.equal(query.parseUrl('/dogovor/id?q=x#Novi+Sad', {parseFragmentIdentifier: true}).fragmentIdentifier, 'Novi Sad');
      assert.equal(query.parse('key=%2B').key, '+');
      console.log('ROUTER_QUERY_COMPAT_PASS');
    `], { cwd: process.cwd(), timeout: 15000, encoding: 'utf8' });
    expect(result.trim()).toBe('ROUTER_QUERY_COMPAT_PASS');
  });

  it('finishes a large malformed external query without the recursive decoder stall', () => {
    // Run in a bounded child so reintroducing the vulnerable decoder cannot hang Jest.
    const result = execFileSync(process.execPath, ['-e', String.raw`
      const assert = require('node:assert/strict');
      const {createRequire} = require('node:module');
      const query = createRequire(require.resolve('expo-router/package.json'))('query-string');
      const malformed = '%EA'.repeat(20000);
      const parsed = query.parse('id=' + malformed + '&title=USKO%C4%8CI');
      assert.equal(parsed.id, malformed);
      assert.equal(parsed.title, 'USKOČI');
      console.log('MALFORMED_QUERY_COMPLETED');
    `], { cwd: process.cwd(), timeout: 15000, encoding: 'utf8' });
    expect(result.trim()).toBe('MALFORMED_QUERY_COMPLETED');
  });
});
