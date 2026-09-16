import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

export type PreparedPhoto = { bytes: ArrayBuffer; contentType: 'image/jpeg'; width: number; height: number };
export type PhotoSource = 'LIBRARY' | 'CAMERA';
const INPUT_LIMIT = 10 * 1024 * 1024;
const OUTPUT_LIMIT = 5 * 1024 * 1024;
export class PhotoSelectionError extends Error {
  constructor(readonly code: 'PERMISSION' | 'SIZE' | 'PROCESSING') { super(code); }
}

/** Only the selected picker cache copy and our generated output are disposable.
 * Never delete a photo-library original, content URI, or another app document. */
function removeCacheCopy(uri: string | undefined) {
  if (!uri || !uri.startsWith(Paths.cache.uri + (Paths.cache.uri.endsWith('/') ? '' : '/'))) return;
  if (uri.includes('/../') || uri.includes('/./') || /%2e|%2f|%5c/i.test(uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* OS owns cache eviction if unavailable. */ }
}

/** Local preparation is a transport optimization. The server independently
 * decodes, orients, strips metadata and validates the immutable upload. */
export async function pickPreparedPhoto(source: PhotoSource, current: () => boolean,
  onProcessing: () => void = () => {}): Promise<PreparedPhoto | null> {
  let selected: string | undefined, output: string | undefined;
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let rendered: Awaited<ReturnType<NonNullable<typeof context>['renderAsync']>> | undefined;
  try {
    if (!current()) return null;
    if (source === 'CAMERA') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!current()) return null;
      if (!permission.granted) throw new PhotoSelectionError('PERMISSION');
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1,
      allowsEditing: false, allowsMultipleSelection: false, exif: false, base64: false };
    const picked = source === 'CAMERA' ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return null;
    const asset = picked.assets[0]; selected = asset?.uri;
    if (!current()) return null;
    if (!asset || !selected || !Number.isFinite(asset.width) || !Number.isFinite(asset.height)
      || asset.width < 1 || asset.height < 1) throw new PhotoSelectionError('PROCESSING');
    const input = new File(selected);
    if (!input.exists || input.size <= 0) throw new PhotoSelectionError('PROCESSING');
    if (input.size > INPUT_LIMIT || (asset.fileSize ?? 0) > INPUT_LIMIT) throw new PhotoSelectionError('SIZE');
    onProcessing();
    context = ImageManipulator.manipulate(selected);
    if (asset.width > 1600 || asset.height > 1600) {
      context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
    }
    rendered = await context.renderAsync();
    if (!current()) return null;
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    output = saved.uri;
    if (!current()) return null;
    const file = new File(output);
    if (file.size <= 0 || file.size > OUTPUT_LIMIT || saved.width > 1600 || saved.height > 1600)
      throw new PhotoSelectionError('PROCESSING');
    const bytes = await file.arrayBuffer();
    if (!current()) return null;
    if (bytes.byteLength !== file.size) throw new PhotoSelectionError('PROCESSING');
    return { bytes, contentType: 'image/jpeg', width: saved.width, height: saved.height };
  } catch (error) {
    if (!current()) return null;
    throw error instanceof PhotoSelectionError ? error : new PhotoSelectionError('PROCESSING');
  } finally {
    try { rendered?.release(); } catch { /* The native reference may already be released. */ }
    try { context?.release(); } catch { /* Cache cleanup still runs. */ }
    removeCacheCopy(output); removeCacheCopy(selected);
  }
}

/** Exact copy shown when the camera permission is denied; presentation matches it to offer settings recovery. */
export const PHOTO_PERMISSION_MESSAGE = 'Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije.';
export const isPhotoPermissionDenied = (error: unknown): boolean => error instanceof PhotoSelectionError && error.code === 'PERMISSION';
export function photoSelectionMessage(error: unknown): string {
  return isPhotoPermissionDenied(error)
    ? PHOTO_PERMISSION_MESSAGE
    : error instanceof PhotoSelectionError && error.code === 'SIZE' ? 'Izaberi fotografiju do 10 MB.'
      : 'Fotografija nije pripremljena. Pokušaj ponovo ili izaberi drugu.';
}
