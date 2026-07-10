import { transform } from 'lightningcss';
import { existsSync, statSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { brotliCompressSync } from 'zlib';
import { glob } from 'glob';
import { workerInlinePlugin } from './worker-inline.plugin';

const projectSrcDir = resolve('src');
const projectRoot = process.cwd();

async function logBundleDetails(result: any, bundleLabel: string) {
  if (!result.outputs || result.outputs.length === 0) {
    return;
  }

  for (const output of result.outputs) {
    if (output.kind !== 'entry-point') {
      continue;
    }

    const relPath = relative(projectRoot, output.path);
    const sizeKb = typeof output.size === 'number' ? (output.size / 1024).toFixed(2) : 'n/a';
    console.log(`📦 ${bundleLabel}: ${relPath} (${sizeKb} KB)`);

    const imports = output.imports ?? [];
    if (imports.length > 0) {
      console.log('  ⤷ includes:');
      for (const entry of imports) {
        const importPath = entry.path ? relative(projectRoot, entry.path) : '(unknown)';
        console.log(`    - ${importPath} [${entry.kind}]`);
      }
    }
  }
}

async function inlineCssImports(
  cssContent: string,
  fromPath: string,
  visited: Set<string> = new Set(),
  watchFiles: Set<string> = new Set()
): Promise<{ css: string; watchFiles: Set<string> }> {
  const importRegex = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?\s*;/g;
  let match: RegExpExecArray | null;
  let inlinedCss = cssContent;

  while ((match = importRegex.exec(cssContent)) !== null) {
    const importPath = match[1];

    // Skip absolute URLs (web fonts etc.)
    if (/^(https?:)?\/\//.test(importPath) || importPath.startsWith('data:')) {
      continue;
    }

    const resolvedPath = resolve(join(dirname(fromPath), importPath));
    if (visited.has(resolvedPath)) {
      continue;
    }

    visited.add(resolvedPath);
    watchFiles.add(resolvedPath);

    const importedContent = await Bun.file(resolvedPath).text();
    const { css: nestedCss } = await inlineCssImports(
      importedContent,
      resolvedPath,
      visited,
      watchFiles
    );

    inlinedCss = inlinedCss.replace(match[0], nestedCss);
  }

  return { css: inlinedCss, watchFiles };
}

const cssModulePlugin = {
  name: 'css-modules',
  setup(build: any) {
    build.onResolve({ filter: /^__styles_registry__$/ }, () => ({
      path: '__styles_registry__',
      namespace: 'styles-registry'
    }));

    build.onLoad({ filter: /.*/, namespace: 'styles-registry' }, () => {
      const globalCssFiles = glob.sync('src/styles/**/*.css');
      const allCssFiles = glob.sync('src/**/*.css');
      
      const otherCssFiles = allCssFiles.filter(f => !globalCssFiles.includes(f));
      
      const orderedCssFiles = [...new Set([...globalCssFiles, ...otherCssFiles])];
      
      const imports = orderedCssFiles
        .map((file, index) => `import style${index} from './${file.replace(/\\/g, '/')}';`)
        .join('\n');
      
      const exports = orderedCssFiles
        .map((_, index) => `style${index}`)
        .join(',\n  ');

      return {
        contents: `
${imports}

export const allStyles = [
  ${exports}
];
        `,
        loader: 'js',
        watchFiles: orderedCssFiles.map(f => resolve(f)),
        watchDirs: [projectSrcDir]
      };
    });

    build.onLoad({ filter: /\.module\.css$/ }, async (args: any) => {
      const cssContent = await Bun.file(args.path).text();

      const { code, exports } = transform({
        filename: args.path,
        code: Buffer.from(cssContent),
        minify: true,
        cssModules: true,
      });

      const css = code.toString();
      
      const classes: Record<string, string> = { __css: css };
      if (exports) {
        for (const [key, value] of Object.entries(exports)) {
          classes[key] = value.name;
        }
      }
      
      return { 
        contents: `export default ${JSON.stringify(classes)};`, 
        loader: 'js',
        watchFiles: [resolve(args.path)],
        watchDirs: [projectSrcDir]
      };
    });

    build.onLoad({ filter: /^(?!.*\.module).*\.css$/ }, async (args: any) => {
      const cssContent = await Bun.file(args.path).text();

      const { css: inlinedCss, watchFiles } = await inlineCssImports(
        cssContent,
        args.path,
        new Set([resolve(args.path)]),
        new Set([resolve(args.path)])
      );

      const { code } = transform({
        filename: args.path,
        code: Buffer.from(inlinedCss),
        minify: true,
      });

      const css = code.toString();

      return { 
        contents: `export default ${JSON.stringify(css)};`, 
        loader: 'js',
        watchFiles: Array.from(watchFiles),
        watchDirs: [projectSrcDir]
      };
    });
  }
};

// ==========================================
// WORKER INLINE PLUGIN
// ==========================================


const candidateExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.module.css', '.scss', '.sass'];

function resolveModuleForDisplay(modulePath: string): { display: string; absolute: string | null } {
  if (!modulePath) {
    return { display: modulePath, absolute: null };
  }

  if (modulePath.startsWith('\0') || /^(https?:|data:)/.test(modulePath)) {
    return { display: modulePath, absolute: null };
  }

  let absPath = modulePath;
  if (!isAbsolute(absPath)) {
    absPath = resolve(projectRoot, modulePath);
  }

  try {
    if (existsSync(absPath)) {
      const stats = statSync(absPath);
      if (stats.isDirectory()) {
        for (const ext of candidateExtensions) {
          const candidate = join(absPath, `index${ext}`);
          if (existsSync(candidate)) {
            return { display: relative(projectRoot, candidate), absolute: candidate };
          }
        }
        return { display: relative(projectRoot, absPath), absolute: absPath };
      }

      return { display: relative(projectRoot, absPath), absolute: absPath };
    }

    for (const ext of candidateExtensions) {
      const candidate = `${absPath}${ext}`;
      if (existsSync(candidate)) {
        return { display: relative(projectRoot, candidate), absolute: candidate };
      }
    }
  } catch (error) {
    // ignore file system errors and fall back to the original path
  }

  return { display: relative(projectRoot, absPath), absolute: existsSync(absPath) ? absPath : null };
}

function createBundleTracePlugin(bundleLabel: string) {
  const graph = new Map<string, Set<string>>();

  const normalizePath = (input: string, baseDir?: string) => {
    if (!input) return input;
    if (/^(https?:|data:)/.test(input)) {
      return input;
    }
    if (input.startsWith('\0')) {
      return input;
    }
    if (isAbsolute(input)) {
      return input;
    }
    const base = baseDir ? resolve(baseDir) : projectRoot;
    return resolve(base, input);
  };

  return {
    name: `bundle-trace-${bundleLabel}`,
    setup(build: any) {
      build.onStart(() => {
        graph.clear();
      });

      build.onResolve({ filter: /.*/ }, (args: any) => {
        if (!args.importer) {
          return;
        }

        const importer = normalizePath(args.importer);
        let resolvedPath = normalizePath(args.path, args.resolveDir ?? dirname(importer));

        try {
          if (
            importer &&
            !importer.startsWith('__') &&
            !importer.startsWith('\0') &&
            !/^(https?:|data:)/.test(args.path)
          ) {
            resolvedPath = Bun.resolveSync(args.path, importer);
          }
        } catch (error) {
          // Ignore resolution errors and fall back to normalized path
        }

        if (!importer || !resolvedPath) {
          return;
        }

        let deps = graph.get(importer);
        if (!deps) {
          deps = new Set<string>();
          graph.set(importer, deps);
        }
        deps.add(resolvedPath);

        return;
      });

      build.onEnd(() => {
        const entrypoints: string[] =
          build.initialOptions?.entrypoints?.map((entry: string) =>
            normalizePath(entry)
          ) ?? [];

        if (entrypoints.length === 0) {
          return;
        }

        for (const entry of entrypoints) {
          if (!entry) continue;

          const visited = new Set<string>();
          const stack = [entry];

          while (stack.length > 0) {
            const current = stack.pop()!;
            if (visited.has(current)) {
              continue;
            }

            visited.add(current);
            const deps = graph.get(current);
            if (!deps) {
              continue;
            }

            for (const dep of deps) {
              if (!visited.has(dep)) {
                stack.push(dep);
              }
            }
          }

          visited.delete(entry);

          const modules = Array.from(visited)
            .filter((item) => item && item !== entry)
            .sort((a, b) => a.localeCompare(b));

          const entryLabel = relative(projectRoot, entry);
          console.log(`  ⤷ modules embedded for ${bundleLabel} (${entryLabel}):`);
          if (modules.length === 0) {
            console.log('    - (no additional modules resolved)');
            continue;
          }

          for (const modulePath of modules) {
            if (modulePath.startsWith('\0')) {
              console.log(`    - [virtual] ${modulePath}`);
              continue;
            }

            if (/^(https?:|data:)/.test(modulePath)) {
              console.log(`    - ${modulePath}`);
              continue;
            }

            const { display, absolute } = resolveModuleForDisplay(modulePath);
            let sizeInfo = '';
            if (absolute) {
              try {
                const fileStat = statSync(absolute);
                if (fileStat.isFile()) {
                  sizeInfo = `${(fileStat.size / 1024).toFixed(2)} KB`;
                }
              } catch (error) {
                // ignore errors when reading file stats
              }
            }
            console.log(`    - ${display}${sizeInfo ? ` - ${sizeInfo}` : ''}`);
          }
        }
      });
    }
  };
}

type TargetName = 'widget' | 'design';

interface BundleConfig {
  name: TargetName;
  entry: string;
  fileName: string;
  globalName: string;
}

const targets: Record<TargetName, BundleConfig> = {
  widget: {
    name: 'widget',
    entry: './src/main.tsx',
    fileName: 'ai-chat.iife.js',
    globalName: 'ChatWidget',
  },
  design: {
    name: 'design',
    entry: './design/main.tsx',
    fileName: 'design.js',
    globalName: 'DesignPlayground',
  },
};

const args = new Set(process.argv.slice(2));
const isWatchMode = args.has('--watch');
const isTraceMode = args.has('--trace');

const selectedTargets: TargetName[] = (() => {
  if (args.has('--design')) {
    return ['design'];
  }
  if (args.has('--all') || args.has('--both')) {
    return ['widget', 'design'];
  }
  return ['widget'];
})();

async function buildProductionBundle({ name, entry, fileName, globalName }: BundleConfig) {
  console.log(`\n🛠️  Building ${name} bundle...`);
  const plugins = [
    ...(isTraceMode ? [createBundleTracePlugin(name)] : []),
    cssModulePlugin,
    workerInlinePlugin,
  ];
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: './dist',
    minify: {
      whitespace: true,
      identifiers: true,
      syntax: true,
    },
    naming: fileName,
    target: 'browser',
    format: 'iife',
    globalName,
    plugins,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  if (!result.success) {
    console.error(`❌ ${name} build failed`, result.logs);
    throw new Error(`${name} build failed`);
  }

  await logBundleDetails(result, `${name} entry`);

  const outputPath = join('dist', fileName);
  const brPath = `${outputPath}.br`;

  const originalSize = statSync(outputPath).size;
  const fileContent = await Bun.file(outputPath).arrayBuffer();

  const compressed = brotliCompressSync(new Uint8Array(fileContent));
  writeFileSync(brPath, compressed);

  const compressedSize = compressed.length;
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

  console.log(`✅ ${name} build completed!`);
  console.log('━'.repeat(50));
  console.log(`📦 ${fileName}: ${(originalSize / 1024).toFixed(2)} KB`);
  console.log(`🗜️  Brotli:    ${(compressedSize / 1024).toFixed(2)} KB`);
  console.log(`💾 Saved:      ${ratio}%`);
  console.log('━'.repeat(50));
}

async function buildDevelopmentBundle({ name, entry, fileName, globalName }: BundleConfig) {
  console.log(`\n🔧 Building ${name} (dev)...`);
  const plugins = [
    ...(isTraceMode ? [createBundleTracePlugin(name)] : []),
    cssModulePlugin,
    workerInlinePlugin,
  ];
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: './dist',
    naming: fileName,
    target: 'browser',
    format: 'iife',
    globalName,
    plugins,
    minify: false,
    define: { 'process.env.NODE_ENV': '"development"' },
  });

  if (!result.success) {
    console.error(`❌ ${name} build failed`, result.logs);
    throw new Error(`${name} build failed`);
  }

  await logBundleDetails(result, `${name} entry`);

  console.log(`✅ ${name} dev bundle ready.`);
}

async function startWatchMode() {
  console.log('\n🚀 Starting build in watch mode...');
  for (const targetName of selectedTargets) {
    const config = targets[targetName];
    await buildDevelopmentBundle(config);
  }

  let rebuilding = false;
  let queued = false;

  const triggerRebuild = async (reason: string) => {
    if (rebuilding) {
      queued = true;
      return;
    }

    rebuilding = true;
    console.log(`\n📂 Change detected (${reason}). Rebuilding...`);
    try {
      for (const targetName of selectedTargets) {
        await buildDevelopmentBundle(targets[targetName]);
      }
    } catch (error) {
      console.error('❌ Rebuild failed', error);
    } finally {
      rebuilding = false;
      if (queued) {
        queued = false;
        triggerRebuild('queued');
      }
    }
  };

  const watchRoots = Array.from(new Set([
    projectSrcDir,
    resolve('design'),
  ]));

  try {
    const { subscribe } = await import('@parcel/watcher');
    const unsubscribers = await Promise.all(
      watchRoots.map((root) =>
        subscribe(root, (error: Error | null, events: any[]) => {
          if (error) {
            console.error('Watcher error:', error);
            return;
          }

          if (!events || events.length === 0) {
            return;
          }

          const reason = events.map((event) => `${event.type}:${event.path}`).join(', ');
          triggerRebuild(reason);
        }, {
          ignore: ['dist', 'node_modules', '.git'],
        })
      )
    );

    console.log('\nAll watchers started. Press Ctrl+C to exit.');

    const stopAll = () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      process.exit(0);
    };

    process.on('SIGINT', stopAll);
    process.on('SIGTERM', stopAll);

    await new Promise(() => {});
  } catch (error) {
    console.error('Failed to start file watchers. Ensure @parcel/watcher is installed.', error);
    console.log('Falling back to polling using fs.watch...');

    const { watch } = await import('fs');

    const watchers = watchRoots.map((root) =>
      watch(root, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        if (filename.includes('dist/') || filename.includes('node_modules')) return;
        triggerRebuild(filename);
      })
    );

    console.log('\nAll watchers started (fs.watch fallback). Press Ctrl+C to exit.');

    const stopAll = () => {
      for (const watcher of watchers) {
        watcher.close();
      }
      process.exit(0);
    };

    process.on('SIGINT', stopAll);
    process.on('SIGTERM', stopAll);

    await new Promise(() => {});
  }
}

async function startProductionBuild() {
  console.log('\n🚀 Starting production build...');
  for (const targetName of selectedTargets) {
    await buildProductionBundle(targets[targetName]);
  }
  console.log('\n✅ All production builds completed.');
}

if (isWatchMode) {
  await startWatchMode();
} else {
  await startProductionBuild();
}
