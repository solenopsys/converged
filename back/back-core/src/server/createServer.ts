import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { resolve } from "path";
import { installBackendLogBridge } from "./logBridge";
import { loadAiProvidersFromEnv } from "./envConfig";
export type { AiConfig } from "./envConfig";

export interface PluginConfig {
  dbPath: string;
  openai?: { key: string; model: string };
  claude?: { key: string; model: string };
  gemini?: { key: string; model: string };
  registerStartupTask?: (name: string, task: () => Promise<void>) => void;
  registerShutdownTask?: (name: string, task: () => Promise<void>) => void;
  [key: string]: any;
}

export interface ServerConfig {
  name: string;
  port: number;
  dataDir: string;
  openai?: { key: string; model: string };
  claude?: { key: string; model: string };
  gemini?: { key: string; model: string };
  extraConfig?: Record<string, any>;
}

export type PluginFactory = (config: PluginConfig) => (app: Elysia) => Elysia;

export interface CreateServerOptions {
  config: ServerConfig;
  plugins: PluginFactory[];
  staticDir?: string;
}

function toModuleName(taskName: string): string {
  const [kind, rest] = taskName.split(":", 2);
  if (!rest) return taskName;
  if (kind === "nrpc") return rest;
  return `${kind}:${rest}`;
}

function collectActiveModules(taskNames: string[]): string[] {
  const modules: string[] = [];
  const seen = new Set<string>();
  for (const taskName of taskNames) {
    const moduleName = toModuleName(taskName);
    if (seen.has(moduleName)) continue;
    seen.add(moduleName);
    modules.push(moduleName);
  }
  return modules;
}

export function loadConfigFromEnv(): ServerConfig {
  const ai = loadAiProvidersFromEnv();
  return {
    name: process.env.APP_NAME || "app",
    port: Number(process.env.PORT) || Number(process.env.SERVICES_PORT) || 3000,
    dataDir: process.env.DATA_DIR || "./data",
    ...ai,
  };
}

/**
 * Creates and configures an Elysia server instance
 */
export function createServer({ config, plugins, staticDir }: CreateServerOptions) {
  const logBridge = installBackendLogBridge({
    serviceBaseUrl: `http://127.0.0.1:${config.port}/services`,
    source: "back.core",
  });
  const startupTasks: Array<{ name: string; task: () => Promise<void> }> = [];
  const shutdownTasks: Array<{ name: string; task: () => Promise<void> }> = [];
  let shuttingDown = false;
  let serverHandle: any = null;

  const pluginConfig: PluginConfig = {
    dbPath: config.dataDir,
    openai: config.openai,
    claude: config.claude,
    gemini: config.gemini,
    registerStartupTask: (name, task) => {
      startupTasks.push({ name, task });
    },
    registerShutdownTask: (name, task) => {
      shutdownTasks.push({ name, task });
    },
    ...config.extraConfig,
  };

  console.log(`Creating server: ${config.name}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Data directory: ${resolve(config.dataDir)}`);
  console.log(`  Plugins: ${plugins.length}`);

  const app = new Elysia()
    .use(cors({ origin: true }))
    .onAfterHandle(({ set }) => {
      // Override Vary: * set by CORS plugin — it prevents browser caching
      // of static assets loaded via <script type="module"> (Sec-Fetch-Mode: cors)
      if (set.headers["vary"] === "*") {
        set.headers["vary"] = "Accept-Encoding";
      }
    })
    .onError(({ error, path, code }) => {
      logBridge.enqueue({
        level: logBridge.level.error,
        code: logBridge.code.httpHandlerError,
        message: `[${code}] ${path}: ${error instanceof Error ? error.stack || error.message : String(error)}`,
      });
    })
    .get("/health", () => ({
      status: "ok",
      name: config.name,
      timestamp: Date.now(),
    }))
    .group("/services", (api) => {
      for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i];
        try {
          const pluginInstance = plugin(pluginConfig);
          if (!pluginInstance) {
            console.warn("[back-core] Skipping empty plugin");
            continue;
          }
          api.use(pluginInstance as any);
        } catch (err) {
          console.error(
            `[back-core] Plugin #${i + 1} failed to register and was skipped`,
            err,
          );
          continue;
        }
      }
      return api;
    });

  // Serve static files if directory specified
  if (staticDir) {
    app.get("/*", async ({ params, set }) => {
      const filePath = params["*"] || "index.html";
      const fullPath = `${staticDir}/${filePath}`;

      const file = Bun.file(fullPath);
      if (await file.exists()) {
        return file;
      }

      // SPA fallback
      const indexFile = Bun.file(`${staticDir}/index.html`);
      if (await indexFile.exists()) {
        return indexFile;
      }

      set.status = 404;
      return { error: "Not found" };
    });
  }

  return {
    app,
    start: async () => {
      const runShutdown = async (reason: string) => {
        if (shuttingDown) {
          return;
        }
        shuttingDown = true;

        console.log(`[back-core] Shutdown start (${reason})`);

        try {
          if (serverHandle && typeof serverHandle.stop === "function") {
            serverHandle.stop();
          } else if (typeof (app as any).stop === "function") {
            (app as any).stop();
          }
        } catch (error) {
          console.error("[back-core] Failed to stop HTTP listener", error);
        }

        for (let i = shutdownTasks.length - 1; i >= 0; i--) {
          const shutdownTask = shutdownTasks[i];
          const startedAt = Date.now();
          console.log(
            `[back-core] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} start: ${shutdownTask.name}`,
          );
          try {
            await shutdownTask.task();
            console.log(
              `[back-core] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} done: ${shutdownTask.name} (${Date.now() - startedAt}ms)`,
            );
          } catch (error) {
            console.error(
              `[back-core] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} failed: ${shutdownTask.name}`,
              error,
            );
          }
        }

        console.log("[back-core] Shutdown complete");
        await logBridge.flushNow();
      };

      process.once("SIGTERM", () => {
        void runShutdown("SIGTERM").finally(() => process.exit(0));
      });
      process.once("SIGINT", () => {
        void runShutdown("SIGINT").finally(() => process.exit(0));
      });

      const activeModules = collectActiveModules(startupTasks.map((t) => t.name));
      if (activeModules.length > 0) {
        console.log(`Active modules (${activeModules.length}): ${activeModules.join(", ")}`);
      }

      for (let i = 0; i < startupTasks.length; i++) {
        const startupTask = startupTasks[i];
        try {
          await startupTask.task();
        } catch (error) {
          console.error(
            `[back-core] Init ${i + 1}/${startupTasks.length} failed: ${startupTask.name}`,
            error,
          );
          throw error;
        }
      }

      serverHandle = app.listen(
        { port: config.port, hostname: "0.0.0.0" },
        () => {
          console.log(`Server ${config.name} running on http://localhost:${config.port}`);
        }
      );
      return app;
    },
    stop: async (reason = "manual") => {
      // Reuse the same code path as signal-based shutdown.
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      console.log(`[back-core] Shutdown start (${reason})`);
      try {
        if (serverHandle && typeof serverHandle.stop === "function") {
          serverHandle.stop();
        } else if (typeof (app as any).stop === "function") {
          (app as any).stop();
        }
      } catch (error) {
        console.error("[back-core] Failed to stop HTTP listener", error);
      }
      for (let i = shutdownTasks.length - 1; i >= 0; i--) {
        const shutdownTask = shutdownTasks[i];
        try {
          await shutdownTask.task();
        } catch (error) {
          console.error(`[back-core] Shutdown task failed: ${shutdownTask.name}`, error);
        }
      }
      console.log("[back-core] Shutdown complete");
      await logBridge.flushNow();
    },
  };
}
