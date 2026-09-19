// Actual Deno/npm WASM resolution of the production module, without external
// Auth, Storage or provider calls. Supabase's deployed bundle remains a separate
// gate: this proves the exact loader and codec on the local Deno runtime only.
declare const Deno: { serve: (...args: unknown[]) => unknown; test: (name: string, run: () => Promise<void>) => void };
Deno.test('production media module resolves pinned npm WASM and sanitizes real pixels in Deno', async () => {
  const serve = Deno.serve;
  let registered = false;
  Deno.serve = () => { registered = true; return {}; };
  try {
    const { loadMediaRuntime } = await import('../../functions/uskoci-media/index.ts');
    if (!registered) throw new Error('Production handler was not registered');
    const runtime = await loadMediaRuntime();
    const { sanitizeImage } = await import('../../functions/_shared/mediaImageSanitizer.mjs');
    const source = runtime.ImageMagick.read(new Uint8Array([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,
      0,0,0,11,73,68,65,84,120,218,99,100,248,15,0,1,5,1,1,39,24,227,102,0,0,0,0,73,69,78,68,174,66,96,130,
    ]), image => image.write(runtime.MagickFormat.Png, bytes => new Uint8Array(bytes)));
    const output = sanitizeImage(source, 'image/png', runtime);
    if (output.width !== 1 || output.height !== 1 || output.contentType !== 'image/jpeg'
      || output.bytes[0] !== 255 || output.bytes[1] !== 216) throw new Error('Real codec output mismatch');
  } finally { Deno.serve = serve; }
});
