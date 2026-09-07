import { execFileSync } from 'node:child_process';

describe('installed Expo Router query decoder', () => {
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
