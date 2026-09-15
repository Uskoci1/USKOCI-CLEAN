import { legacyRpcFailure } from '../legacyRpcFailure';

const fallback = { ok: false, kod: 'ACTION_UNCONFIRMED', poruka: 'Ishod radnje nije potvrđen.' };
const fail = (value: unknown) => legacyRpcFailure(value, fallback.kod, fallback.poruka);
describe('one public failure boundary for retained legacy adapters', () => {
  it.each([
    undefined, null, 'private-token', {}, { code: '42501' },
    { message: 'https://private.example/token?secret' },
    { message: 'private SQL with email@example.test', code: 'P0001' },
    { message: 'NOT_OWNER: secret details' }, { message: 'constructor' },
    { message: '__proto__' }, { message: 'toString' }, { message: ['NOT_OWNER'] },
    { get message() { throw new Error('opaque'); } },
  ])('refuses arbitrary messages, SQLSTATE and prototype names %#', value => {
    expect(fail(value)).toEqual(fallback);
  });
  it.each([
    ['NOT_OWNER', 'Ova radnja nije dostupna na ovom nalogu.'],
    ['NEED_VERSION_MISMATCH', 'Zadatak je izmenjen. Pregledajte važeće uslove.'],
    ['RESPONSE_NOT_WITHDRAWABLE', 'Prijavu sada nije moguće povući. Proverite aktuelno stanje.'],
    ['POLICY_BUNDLE_NOT_READY', 'Objava trenutno nije dostupna.'],
  ])('maps the exact known symbolic name %s to fixed user copy', (message, poruka) => {
    const result = fail({ message, code: 'P0001', details: 'private SQL', hint: 'secret' });
    expect(result).toEqual({ ok: false, kod: message, poruka });
  });
});
