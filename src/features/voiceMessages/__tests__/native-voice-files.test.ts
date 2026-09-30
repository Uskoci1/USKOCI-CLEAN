// Voice messages B2-a (2026-10-01): the device file seam touches only the app's private cache and only plain leaves.
const mockStore = { files: new Map<string, Uint8Array>(), dirs: new Set<string>(), deleted: [] as string[], failDelete: false };
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map(part => (typeof part === 'string' ? part : (part as { uri: string }).uri))
    .reduce((left, right) => left + (left.endsWith('/') || right.startsWith('/') ? '' : '/') + right);
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return mockStore.dirs.has(this.uri); }
    create() { mockStore.dirs.add(this.uri); }
    delete() {
      if (mockStore.failDelete) throw new Error('DELETE');
      mockStore.dirs.delete(this.uri); mockStore.deleted.push(this.uri);
      for (const key of [...mockStore.files.keys()]) if (key.startsWith(this.uri + '/')) mockStore.files.delete(key);
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return mockStore.files.has(this.uri); }
    get size() { return mockStore.files.get(this.uri)?.byteLength ?? 0; }
    async arrayBuffer() { const bytes = mockStore.files.get(this.uri)!; return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
    create(options?: { overwrite?: boolean }) { if (options?.overwrite || !mockStore.files.has(this.uri)) mockStore.files.set(this.uri, new Uint8Array(0)); }
    write(content: Uint8Array) { mockStore.files.set(this.uri, content); }
    delete() { mockStore.files.delete(this.uri); mockStore.deleted.push(this.uri); }
  }
  return { Directory, File, Paths: { cache: new Directory('file:///cache/') } };
});
import { nativeVoiceFiles, purgeVoiceFiles, VOICE_CACHE_DIRECTORY, VOICE_FILE_MAX_BYTES } from '../nativeVoiceFiles';

const root = 'file:///cache/', voiceDirectory = root + VOICE_CACHE_DIRECTORY;
const bytesOf = (...values: number[]) => new Uint8Array(values).buffer;
beforeEach(() => { mockStore.files.clear(); mockStore.dirs.clear(); mockStore.deleted.length = 0; mockStore.failDelete = false; });

it('writes a downloaded message into the private voice directory and returns exactly that file', async () => {
  const uri = await nativeVoiceFiles.writeTemp('voice-abc.m4a', bytesOf(1, 2, 3, 4));
  expect(uri).toBe(`${voiceDirectory}/voice-abc.m4a`); expect(mockStore.dirs.has(voiceDirectory)).toBe(true);
  expect([...mockStore.files.get(uri)!]).toEqual([1, 2, 3, 4]);
});
it.each(['', '.', '..', '../escape.m4a', 'a/b.m4a', 'a\\b.m4a', 'with space.m4a', '.hidden', '%2e%2e', 'x'.repeat(97)])('refuses the unsafe leaf %j and writes nothing', async name => {
  await expect(nativeVoiceFiles.writeTemp(name, bytesOf(1))).rejects.toThrow('VOICE_FILE_NAME'); expect(mockStore.files.size).toBe(0);
});
it('refuses an empty or oversize payload and never writes a half file', async () => {
  await expect(nativeVoiceFiles.writeTemp('a.m4a', new ArrayBuffer(0))).rejects.toThrow('VOICE_FILE_SIZE');
  await expect(nativeVoiceFiles.writeTemp('a.m4a', new ArrayBuffer(VOICE_FILE_MAX_BYTES + 1))).rejects.toThrow('VOICE_FILE_SIZE');
  expect(mockStore.files.size).toBe(0);
});
it('reads exactly the bytes of a cache file', async () => {
  mockStore.files.set(`${root}Audio/recording-1.m4a`, new Uint8Array([9, 8, 7]));
  expect([...new Uint8Array(await nativeVoiceFiles.read(`${root}Audio/recording-1.m4a`))]).toEqual([9, 8, 7]);
});
it.each([
  ['a path outside the private cache', 'file:///data/user/0/other/files/x.m4a'], ['a content URI', 'content://media/external/audio/1'],
  ['a traversal', `${root}../secret.m4a`], ['a traversal inside', `${root}Audio/../../secret.m4a`], ['an encoded separator', `${root}Audio%2f..%2fx.m4a`],
  ['a backslash', `${root}Audio\\x.m4a`], ['the cache root itself', root], ['an empty string', ''],
])('refuses to read %s', async (_name, uri) => {
  mockStore.files.set(uri, new Uint8Array([1]));
  await expect(nativeVoiceFiles.read(uri)).rejects.toThrow('VOICE_FILE_PATH');
});
it('refuses to read a missing, empty or oversize file', async () => {
  await expect(nativeVoiceFiles.read(`${root}missing.m4a`)).rejects.toThrow('VOICE_FILE_MISSING');
  mockStore.files.set(`${root}empty.m4a`, new Uint8Array(0)); await expect(nativeVoiceFiles.read(`${root}empty.m4a`)).rejects.toThrow('VOICE_FILE_SIZE');
  mockStore.files.set(`${root}huge.m4a`, new Uint8Array(VOICE_FILE_MAX_BYTES + 1)); await expect(nativeVoiceFiles.read(`${root}huge.m4a`)).rejects.toThrow('VOICE_FILE_SIZE');
});
it('removes a cache file, ignores one that is already gone and never touches a file outside the cache', async () => {
  mockStore.files.set(`${root}Audio/recording-1.m4a`, new Uint8Array([1]));
  await nativeVoiceFiles.remove(`${root}Audio/recording-1.m4a`); expect(mockStore.files.size).toBe(0);
  await expect(nativeVoiceFiles.remove(`${root}Audio/recording-1.m4a`)).resolves.toBeUndefined();
  mockStore.files.set('file:///data/other/x.m4a', new Uint8Array([1]));
  await expect(nativeVoiceFiles.remove('file:///data/other/x.m4a')).rejects.toThrow('VOICE_FILE_PATH'); expect(mockStore.files.has('file:///data/other/x.m4a')).toBe(true);
  await expect(nativeVoiceFiles.remove(`${root}../x.m4a`)).rejects.toThrow('VOICE_FILE_PATH');
});
it('purges only the voice directory: other cache files stay', async () => {
  await nativeVoiceFiles.writeTemp('one.m4a', bytesOf(1)); await nativeVoiceFiles.writeTemp('two.m4a', bytesOf(2));
  mockStore.files.set(`${root}photo-cache.jpg`, new Uint8Array([7]));
  await nativeVoiceFiles.purgeAll();
  expect([...mockStore.files.keys()]).toEqual([`${root}photo-cache.jpg`]); expect(mockStore.dirs.has(voiceDirectory)).toBe(false);
  await expect(nativeVoiceFiles.purgeAll()).resolves.toBeUndefined();
});
it('the logout purge never throws into the logout', async () => {
  await nativeVoiceFiles.writeTemp('one.m4a', bytesOf(1)); mockStore.failDelete = true;
  await expect(purgeVoiceFiles()).resolves.toBeUndefined();
});
