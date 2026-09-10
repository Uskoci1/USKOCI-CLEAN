import { createHash, webcrypto } from 'node:crypto';
import { saveDataExportFile } from '../dataExportFile.web';
import type { DataExportFile } from '../../contracts/dataExport';
const bytes = new Uint8Array([123, 125]);
const artifact = (): DataExportFile => ({ receiptId: '11111111-1111-4111-8111-111111111111', artifactGeneration: '22222222-2222-4222-8222-222222222222',
  bytes, byteLength: bytes.length, md5: createHash('md5').update(bytes).digest('hex'), sha256: createHash('sha256').update(bytes).digest('hex') });
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'), originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL'), originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
let current = true;
const click = jest.fn(), remove = jest.fn(), createUrl = jest.fn(), revokeUrl = jest.fn(), append = jest.fn();
let link: { href: string; download: string; rel: string; style: { display: string }; click: typeof click; remove: typeof remove };
const save = (value = artifact(), controller = new AbortController()) => saveDataExportFile({ artifact: value, isCurrent: () => current, signal: controller.signal });
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); current = true;
  link = { href: '', download: '', rel: '', style: { display: '' }, click, remove };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { appendChild: append }, createElement: () => link } });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  createUrl.mockReturnValue('blob:opaque-owned-export'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
});
afterEach(() => {
  jest.runOnlyPendingTimers(); jest.useRealTimers();
  for (const [target, key, descriptor] of [[globalThis, 'document', originalDocument], [globalThis, 'crypto', originalCrypto],
    [URL, 'createObjectURL', originalCreate], [URL, 'revokeObjectURL', originalRevoke]] as const) {
    if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key);
  }
});
it('verifies SHA256 and starts an explicit Blob download without claiming that the user saved it', async () => {
  await expect(save()).resolves.toMatchObject({ status: 'DOWNLOAD_STARTED' });
  expect(click).toHaveBeenCalledTimes(1); expect(link.download).toBe('uskoci-izvoz-' + artifact().receiptId + '-' + artifact().artifactGeneration + '.json');
  expect(createUrl.mock.calls[0][0].type).toBe('application/json'); expect(remove).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1000); expect(revokeUrl).toHaveBeenCalledWith('blob:opaque-owned-export');
});
it('rejects tampered bytes before creating a URL or starting a download', async () => {
  await expect(save({ ...artifact(), bytes: new Uint8Array([0, 1]) })).resolves.toEqual({ status: 'FAILED', code: 'INVALID' });
  expect(createUrl).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
});
it('does not deliver data after ownership changes during digest verification', async () => {
  const pending = save(); current = false; await expect(pending).resolves.toEqual({ status: 'STALE' }); expect(createUrl).not.toHaveBeenCalled();
});
it('zeroes its discarded verification copy while leaving caller-owned bytes untouched', async () => {
  let verificationBytes!: Uint8Array;
  const digest = jest.fn(async (algorithm: string, data: Uint8Array<ArrayBuffer>) => {
    verificationBytes = data; return webcrypto.subtle.digest(algorithm, data);
  });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest } } });
  const pending = save(); current = false; await expect(pending).resolves.toEqual({ status: 'STALE' });
  expect(verificationBytes).toEqual(new Uint8Array(2)); expect(bytes).toEqual(new Uint8Array([123, 125]));
  expect(createUrl).not.toHaveBeenCalled();
});
it('revokes the URL on abort and never clicks after ownership changes during DOM preparation', async () => {
  append.mockImplementationOnce(() => { current = false; });
  await expect(save()).resolves.toEqual({ status: 'STALE' }); expect(click).not.toHaveBeenCalled(); expect(revokeUrl).toHaveBeenCalledTimes(1);
});
it('releases an initiated Blob URL immediately on owner cancellation', async () => {
  const controller = new AbortController(); await save(artifact(), controller); controller.abort(); expect(revokeUrl).toHaveBeenCalledTimes(1);
  jest.runOnlyPendingTimers(); expect(revokeUrl).toHaveBeenCalledTimes(1);
});
it('reports unsupported honestly without DOM access', async () => {
  Reflect.deleteProperty(globalThis, 'document'); await expect(save()).resolves.toEqual({ status: 'UNSUPPORTED' }); expect(click).not.toHaveBeenCalled();
});
