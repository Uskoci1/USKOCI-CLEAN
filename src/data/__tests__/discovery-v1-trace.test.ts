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
it('names how a settled camera move was classified', () => {
  traceDiscoveryV1('settled', 'OWN_CLUSTER');
  traceDiscoveryV1('settled', 'QUIET_MOVE');
  expect(info.mock.calls).toEqual([['[USKOCI_P6_TRACE] ["settled","OWN_CLUSTER"]'], ['[USKOCI_P6_TRACE] ["settled","QUIET_MOVE"]']]);
});
it('names the milliseconds a touch took to its halo and to its card data, on a budget of its own', () => {
  traceDiscoveryV1('pin', '18/243');
  traceDiscoveryV1('pin', '5/9999');
  traceDiscoveryV1('pin', '18/10000');
  traceDiscoveryV1('pin', 'a free text');
  expect(info.mock.calls).toEqual([['[USKOCI_P6_TRACE] ["pin","18/243"]'], ['[USKOCI_P6_TRACE] ["pin","5/9999"]']]);
  jest.isolateModules(() => {
    const isolated = require('../discoveryV1Trace') as typeof import('../discoveryV1Trace');
    info.mockClear();
    for (let at = 0; at < 100; at++) isolated.traceDiscoveryV1('restored', '1/1');
    expect(info).toHaveBeenCalledTimes(60);
    isolated.traceDiscoveryV1('pin', '1/2');
    expect(info).toHaveBeenCalledTimes(61);
    for (let at = 0; at < 500; at++) isolated.traceDiscoveryV1('pin', '1/2');
    expect(info).toHaveBeenCalledTimes(60 + 400);
    isolated.traceDiscoveryV1('restored', '1/1');
    expect(info).toHaveBeenCalledTimes(60 + 400);
  });
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
