import { resolve } from 'path';
import { createWorkspaceResolverPlugin } from '../../../../front-core/src/tools/workspace-resolver';

interface BundleConfig {
  name: string;
  entry: string;
  fileName: string;
  globalName: string;
}

const bundles: BundleConfig[] = [
  {
    name: 'Store Worker',
    entry: resolve('src/workers/store.worker.ts'),
    fileName: 'store.worker.js',
    globalName: 'StoreWorker',
  },
];

async function buildDevelopmentBundle({ name, entry, fileName, globalName }: BundleConfig) {
  console.log(`
🔧 Building ${name} (dev)...`);

  const result = await Bun.build({
    entrypoints: [entry],
    outdir: './dist',
    naming: fileName,
    target: 'browser',
    format: 'esm',
    globalName,
    plugins: [createWorkspaceResolverPlugin(resolve('../../..'))],

    minify: true,

    define: { 'process.env.NODE_ENV': '"development"' },
  });

  if (!result.success) {
    console.error(`❌ ${name} build failed`, result.logs);
    throw new Error(`${name} build failed`);
  }

  console.log(`✅ ${name} dev bundle ready.`);
}

async function main() {
  for (const bundle of bundles) {
    await buildDevelopmentBundle(bundle);
  }
}

main();
