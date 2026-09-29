import { discoveryV1NativeProofAllowed } from '../discoveryV1NativeProofGate';

it('is closed by default and a query parameter alone cannot switch readers', () => {
  expect(discoveryV1NativeProofAllowed(undefined, undefined, 'rs.uskoci.dev')).toBe(false);
  expect(discoveryV1NativeProofAllowed('1', undefined, 'rs.uskoci.dev')).toBe(false);
  expect(discoveryV1NativeProofAllowed('1', '1', 'rs.uskoci')).toBe(false);
  expect(discoveryV1NativeProofAllowed('0', '1', 'rs.uskoci.dev')).toBe(false);
});

it('requires the exact proof parameter, compile flag and DEV Android package together', () => {
  expect(discoveryV1NativeProofAllowed('1', '1', 'rs.uskoci.dev')).toBe(true);
});
