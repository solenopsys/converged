import { mkdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { brotliCompressSync, constants as zlibConstants } from 'zlib';

function brotliCompress(data: Buffer, quality: number): Buffer {
  return brotliCompressSync(data, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: quality },
  });
}

const distDir = resolve(import.meta.dir, '..', '..', 'dist');
const outPath = resolve(distDir, 'bridge.js');

mkdirSync(distDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(import.meta.dir, '..', 'bridge', 'entry.ts')],
  target: 'browser',
  format: 'esm',
  minify: true,
  bundle: true,
  sourcemap: 'none',
  write: false,
});

if (!result.success) {
  const errors = result.logs.map((item) => item.message).join('\n');
  throw new Error(`Failed to build bridge bundle:\n${errors}`);
}

if (result.outputs.length === 0) {
  throw new Error('Bridge build produced no output');
}

await Bun.write(outPath, result.outputs[0]);

const bytes = Buffer.from(await Bun.file(outPath).arrayBuffer());
await Bun.write(`${outPath}.br`, brotliCompress(bytes, 5));

const kb = (statSync(outPath).size / 1024).toFixed(1);
const kbBr = (statSync(`${outPath}.br`).size / 1024).toFixed(1);
console.log(`[front-core] bridge.js ${kb}kb (${kbBr}kb br)`);
