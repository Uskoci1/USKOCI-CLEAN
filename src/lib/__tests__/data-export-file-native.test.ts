import type { DataExportFile } from '../../contracts/dataExport';
const mockPick = jest.fn(), mockList = jest.fn(), mockCreate = jest.fn(), mockWrite = jest.fn(), mockDelete = jest.fn();
let mockCurrent = true;
let mockFile: { uri: string; name: string; exists: boolean; size: number; md5: string; create: typeof mockCreate; write: typeof mockWrite; delete: typeof mockDelete };
const mockDirectory = { uri: 'content://provider/tree/export', list: mockList, createFile: jest.fn() };
jest.mock('expo-file-system', () => ({ Directory: { pickDirectoryAsync: (...args: unknown[]) => mockPick(...args) },
  File: jest.fn().mockImplementation(() => mockFile) }));
import { saveDataExportFile } from '../dataExportFile.native';
import { dataExportFileName } from '../dataExportFile.types';
const artifact = (): DataExportFile => ({ receiptId: '11111111-1111-4111-8111-111111111111',
  artifactGeneration: '22222222-2222-4222-8222-222222222222', bytes: new Uint8Array([1, 2, 3]), byteLength: 3,
  sha256: 'a'.repeat(64), md5: 'b'.repeat(32) });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const save = (value = artifact(), controller = new AbortController()) => saveDataExportFile({ artifact: value, isCurrent: () => mockCurrent, signal: controller.signal });
beforeEach(() => {
  jest.clearAllMocks(); mockCurrent = true; mockDirectory.uri = 'content://provider/tree/export';
  mockFile = { uri: 'content://provider/document/new-file', name: dataExportFileName(artifact())!, exists: true, size: 0,
    md5: 'b'.repeat(32), create: mockCreate, write: mockWrite, delete: mockDelete };
  mockList.mockReturnValue([]); mockDirectory.createFile.mockReturnValue(mockFile); mockPick.mockResolvedValue(mockDirectory);
  mockCreate.mockReset(); mockWrite.mockImplementation(() => { mockFile.size = 3; }); mockDelete.mockReset();
});
it('uses the actual SAF creation API and verifies bytes and MD5 before reporting saved', async () => {
  await expect(save()).resolves.toEqual({ status: 'SAVED', fileName: dataExportFileName(artifact()) });
  expect(mockDirectory.createFile).toHaveBeenCalledWith(dataExportFileName(artifact()), 'application/json');
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockWrite).toHaveBeenCalledWith(artifact().bytes); expect(mockDelete).not.toHaveBeenCalled();
});
it('uses exclusive File.create for a local directory and never overwrites', async () => {
  mockDirectory.uri = 'file:///chosen'; mockFile.uri = 'file:///chosen/' + dataExportFileName(artifact());
  await expect(save()).resolves.toMatchObject({ status: 'SAVED' });
  expect(mockCreate).toHaveBeenCalledWith({ overwrite: false, intermediates: false }); expect(mockDirectory.createFile).not.toHaveBeenCalled();
});
it.each(['name', 'returned URI'])('does not write or delete a pre-existing file detected by %s', async mode => {
  mockList.mockReturnValue([{ name: mode === 'name' ? dataExportFileName(artifact()) : 'different.json', uri: mockFile.uri }]);
  await expect(save()).resolves.toMatchObject({ status: 'FAILED', code: 'EXISTS' });
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockDelete).not.toHaveBeenCalled();
  if (mode === 'name') expect(mockDirectory.createFile).not.toHaveBeenCalled();
});
it.each(['foreign provider', 'directory alias', 'nonempty returned object'])('does not claim ownership of a %s', async mode => {
  if (mode === 'foreign provider') mockFile.uri = 'content://other/document/file';
  else if (mode === 'directory alias') mockFile.uri = mockDirectory.uri; else mockFile.size = 40;
  await expect(save()).resolves.toMatchObject({ status: 'FAILED' }); expect(mockWrite).not.toHaveBeenCalled(); expect(mockDelete).not.toHaveBeenCalled();
});
it.each(['scope', 'abort'])('does not create any file when %s changes during the native picker', async mode => {
  const picker = deferred<typeof mockDirectory>(); mockPick.mockReturnValueOnce(picker.promise); const controller = new AbortController();
  const pending = save(artifact(), controller); if (mode === 'scope') mockCurrent = false; else controller.abort();
  picker.resolve(mockDirectory); await expect(pending).resolves.toEqual({ status: 'STALE' });
  expect(mockList).not.toHaveBeenCalled(); expect(mockDirectory.createFile).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});
it('serializes native pickers across retained or remounted screens', async () => {
  const picker = deferred<typeof mockDirectory>(); mockPick.mockReturnValueOnce(picker.promise); const first = save();
  await expect(save()).resolves.toEqual({ status: 'BUSY' }); expect(mockPick).toHaveBeenCalledTimes(1);
  picker.resolve(mockDirectory); await expect(first).resolves.toMatchObject({ status: 'SAVED' });
});
it.each(['size', 'md5', 'write failure', 'scope after create', 'scope after write'])('removes only its newly created partial file on %s', async mode => {
  if (mode === 'size') mockWrite.mockImplementationOnce(() => { mockFile.size = 2; });
  if (mode === 'md5') mockFile.md5 = 'c'.repeat(32);
  if (mode === 'write failure') mockWrite.mockImplementationOnce(() => { throw new Error('private file path'); });
  if (mode === 'scope after create') mockDirectory.createFile.mockImplementationOnce(() => { mockCurrent = false; return mockFile; });
  if (mode === 'scope after write') mockWrite.mockImplementationOnce(() => { mockCurrent = false; });
  expect((await save()).status).not.toBe('SAVED'); expect(mockDelete).toHaveBeenCalledTimes(1);
});
it('reports incomplete cleanup honestly without exposing the path', async () => {
  mockWrite.mockImplementationOnce(() => { throw new Error('private'); }); mockDelete.mockImplementationOnce(() => { throw new Error('private/path'); });
  await expect(save()).resolves.toEqual({ status: 'FAILED', code: 'CLEANUP_FAILED' });
});
it.each(['ERR_PICKER_CANCELLED', 'ERR_FILE_PICKING_CANCELLED'])('recognizes actual native cancellation %s', async code => {
  mockPick.mockRejectedValueOnce({ code }); await expect(save()).resolves.toEqual({ status: 'CANCELLED' }); expect(mockDelete).not.toHaveBeenCalled();
});
it('does not treat permission failure as user cancellation', async () => {
  mockPick.mockRejectedValueOnce({ code: 'ERR_PERMISSION', message: '/private/path' });
  await expect(save()).resolves.toEqual({ status: 'FAILED', code: 'WRITE_FAILED' });
});
it.each([{ byteLength: 2 }, { receiptId: '../private' }, { artifactGeneration: '' }, { md5: '' }, { sha256: '' }])('rejects malformed descriptor %s before the picker', async change => {
  await expect(save({ ...artifact(), ...change })).resolves.toMatchObject({ status: 'FAILED', code: 'INVALID' }); expect(mockPick).not.toHaveBeenCalled();
});
