import { dirname, resolve } from "path";

export const workerInlinePlugin = {
  name: "worker-inline",
  setup(build: any) {
    // Обрабатываем импорты с суффиксом ?worker
    build.onResolve({ filter: /\.worker\.ts\?worker$/ }, (args: any) => {
      const workerPath = args.path.replace("?worker", "");
      const importerDir = dirname(args.importer);
      const resolved = resolve(importerDir, workerPath);
      return {
        path: resolved,
        namespace: "worker-inline",
      };
    });

    // Обрабатываем файлы в namespace worker-inline
    build.onLoad(
      { filter: /.*/, namespace: "worker-inline" },
      async (args: any) => {
        return await processWorkerFile(args.path);
      },
    );

    // Обрабатываем прямые импорты .worker.ts файлов
    build.onLoad({ filter: /\.worker\.ts$/ }, async (args: any) => {
      return await processWorkerFile(args.path);
    });

    async function processWorkerFile(filePath: string) {
      console.log(`[Worker] Processing: ${filePath}`);

      try {
        const prebuiltWorkerPath = resolve(dirname(filePath), "../../dist/store.worker.js");
        const prebuiltWorker = Bun.file(prebuiltWorkerPath);
        const workerCode = await prebuiltWorker.exists()
          ? await prebuiltWorker.text()
          : await Bun.file(filePath).text();
        console.log(`[Worker] Bundled: ${workerCode.length} bytes`);

        return {
          contents: `
const workerCode = ${JSON.stringify(workerCode)};
const blob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);

export default class InlineWorker extends Worker {
  constructor() {
    super(workerUrl, { type: 'module' });
  }
}

export const createWorker = () => new Worker(workerUrl, { type: 'module' });
          `,
          loader: "js",
        };
      } catch (error) {
        console.error("[Worker] Error during processing:", error);
        throw error;
      }
    }
  },
};
