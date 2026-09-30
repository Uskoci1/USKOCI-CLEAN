let mockPackage: string | undefined = 'rs.uskoci.dev';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));

import { discoveryV1ErrorCode, traceDiscoveryV1 } from '../discoveryV1Trace';

let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); mockPackage = 'rs.uskoci.dev'; });
afterEach(() => info.mockRestore());

it('names an error by its stable code and never by its text', () => {
  expect(discoveryV1ErrorCode(new Error('DISCOVERY_V1_OWNER_MAP_COVERAGE_DRIFT'))).toBe('DISCOVERY_V1_OWNER_MAP_COVERAGE_DRIFT');
  expect(discoveryV1ErrorCode(new Error('Network request failed for https://example.test/?token=secret'))).toBe('UNCODED');
  expect(discoveryV1ErrorCode(new Error('DISCOVERY_V1 with spaces'))).toBe('UNCODED');
  expect(discoveryV1ErrorCode('DISCOVERY_V1_READ_FAILED')).toBe('UNCODED');
  expect(discoveryV1ErrorCode(undefined)).toBe('UNCODED');
});
it('logs one fixed line in the DEV package', () => {
  traceDiscoveryV1('restore-failed', 'DISCOVERY_V1_OWNER_MAP_COVERAGE_DRIFT');
  traceDiscoveryV1('restored', '100/7');
  expect(info.mock.calls).toEqual([
    ['[USKOCI_P6_TRACE] ["restore-failed","DISCOVERY_V1_OWNER_MAP_COVERAGE_DRIFT"]'],
    ['[USKOCI_P6_TRACE] ["restored","100/7"]'],
  ]);
});
it('logs nothing in any other package', () => {
  for (const other of ['rs.uskoci', 'rs.uskoci.preview', 'com.example', undefined]) {
    mockPackage = other;
    traceDiscoveryV1('restore-failed', 'DISCOVERY_V1_READ_FAILED');
  }
  expect(info).not.toHaveBeenCalled();
});
it('refuses any detail that is not a fixed code or two counts', () => {
  traceDiscoveryV1('read-failed', 'a free text with spaces');
  traceDiscoveryV1('read-failed', 'https://example.test/?token=secret');
  traceDiscoveryV1('restored', '1234567/1');
  expect(info).not.toHaveBeenCalled();
});
