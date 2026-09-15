const mockLibrary = jest.fn(), mockCamera = jest.fn(), mockPermission = jest.fn(), mockManipulate = jest.fn();
const mockFiles = new Map<string, { size: number; bytes: ArrayBuffer; exists: boolean }>(), mockDelete = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamera(...a), requestCameraPermissionsAsync: () => mockPermission() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ Paths: { cache: { uri: 'file:///cache/' } }, File: class {
  uri: string; constructor(value: string) { this.uri = value; } get exists() { return mockFiles.get(this.uri)?.exists ?? false; }
  get size() { return mockFiles.get(this.uri)?.size ?? 0; }
  async arrayBuffer() { return mockFiles.get(this.uri)?.bytes; }
  delete() { mockDelete(this.uri); }
} }));
import { pickPreparedPhoto, PhotoSelectionError } from '../nativePhotoPicker';
const original = 'file:///cache/picker/original.jpg', saved = 'file:///cache/output.jpg';
const resize = jest.fn(), render = jest.fn(), save = jest.fn(), releaseContext = jest.fn(), releaseImage = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); mockFiles.clear();
  mockFiles.set(original, { size: 80, bytes: new ArrayBuffer(80), exists: true });
  mockFiles.set(saved, { size: 12, bytes: new ArrayBuffer(12), exists: true });
  mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: original, width: 4000, height: 3000, fileSize: 80 }] });
  mockCamera.mockImplementation(() => mockLibrary()); mockPermission.mockResolvedValue({ granted: true });
  save.mockResolvedValue({ uri: saved, width: 1600, height: 1200 });
  render.mockResolvedValue({ saveAsync: save, release: releaseImage });
  mockManipulate.mockReturnValue({ resize, renderAsync: render, release: releaseContext });
});
it('prepares a resized JPEG in memory and removes both owned cache copies with no metadata request', async () => {
  const result = await pickPreparedPhoto('LIBRARY', () => true);
  expect(result).toEqual({ bytes: new ArrayBuffer(12), width: 1600, height: 1200, contentType: 'image/jpeg' });
  expect(resize).toHaveBeenCalledWith({ width: 1600 }); expect(save).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  expect(mockLibrary.mock.calls[0][0]).toMatchObject({ exif: false, base64: false, mediaTypes: ['images'] });
  expect(mockPermission).not.toHaveBeenCalled(); expect(mockDelete.mock.calls.flat()).toEqual([saved, original]);
  expect(releaseContext).toHaveBeenCalledTimes(1); expect(releaseImage).toHaveBeenCalledTimes(1);
});
it('rejects a selected input over the approved size before decoding it', async () => {
  mockFiles.get(original)!.size = 10 * 1024 * 1024 + 1;
  await expect(pickPreparedPhoto('LIBRARY', () => true)).rejects.toEqual(new PhotoSelectionError('SIZE'));
  expect(mockManipulate).not.toHaveBeenCalled(); expect(mockDelete).toHaveBeenCalledWith(original);
});
it('retires a selection returned after account or focus change and cleans its cache copy', async () => {
  let current = true; mockLibrary.mockImplementation(async () => { current = false;
    return { canceled: false, assets: [{ uri: original, width: 20, height: 20 }] }; });
  expect(await pickPreparedPhoto('LIBRARY', () => current)).toBeNull();
  expect(mockManipulate).not.toHaveBeenCalled(); expect(mockDelete).toHaveBeenCalledWith(original);
});
it('never deletes the selected library original or a path outside cache', async () => {
  const uri = 'content://media/external/images/123'; mockFiles.set(uri, mockFiles.get(original)!);
  mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri, width: 4000, height: 3000 }] });
  await pickPreparedPhoto('LIBRARY', () => true);
  expect(mockDelete.mock.calls.flat()).toEqual([saved]);
});
it('requires camera permission and does not open the camera on denial', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  await expect(pickPreparedPhoto('CAMERA', () => true)).rejects.toEqual(new PhotoSelectionError('PERMISSION'));
  expect(mockCamera).not.toHaveBeenCalled(); expect(mockManipulate).not.toHaveBeenCalled();
});
