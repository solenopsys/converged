import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { resolve } from "path";

export interface AiConfig {
  key: string;
  model: string;
}

export interface PluginConfig {
  dbPath: string;
  openai?: AiConfig;
  claude?: AiConfig;
  registerStartupTask?: (name: string, task: () => Promise<void>) => void;
  [key: string]: any;
}

export interface ServerConfig {
  name: string;
  port: number;
  dataDir: string;
  openai?: AiConfig;
  claude?: AiConfig;
  extraConfig?: Record<string, any>;
}

export type PluginFactory = (config: PluginConfig) => (app: Elysia) => Elysia;

export interface CreateServerOptions {
  config: ServerConfig;
  plugins: PluginFactory[];
  staticDir?: string;
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): ServerConfig {
  return {
    name: process.env.APP_NAME || "app",
    port: Number(process.env.PORT) || Number(process.env.SERVICES_PORT) || 3000,
    dataDir: process.env.DATA_DIR || "./data",
    openai: {
      key: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
    claude: {
      key: process.env.CLAUDE_API_KEY || "",
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022",
    },
  };
}

/**
 * Creates and configures an Elysia server instance
 */
export function createServer({ config, plugins, staticDir }: CreateServerOptions) {
  const startupTasks: Array<{ name: string; task: () => Promise<void> }> = [];

  const pluginConfig: PluginConfig = {
    dbPath: config.dataDir,
    openai: config.openai,
    claude: config.claude,
    registerStartupTask: (name, task) => {
      startupTasks.push({ name, task });
    },
    ...config.extraConfig,
  };

  console.log(`Creating server: ${config.name}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Data directory: ${resolve(config.dataDir)}`);
  console.log(`  Plugins: ${plugins.length}`);

  const app = new Elysia()
    .use(cors())
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
      for (let i = 0; i < startupTasks.length; i++) {
        const startupTask = startupTasks[i];
        const startedAt = Date.now();
        console.log(
          `[back-core] Init ${i + 1}/${startupTasks.length} start: ${startupTask.name}`,
        );
        try {
          await startupTask.task();
          console.log(
            `[back-core] Init ${i + 1}/${startupTasks.length} done: ${startupTask.name} (${Date.now() - startedAt}ms)`,
          );
        } catch (error) {
          console.error(
            `[back-core] Init ${i + 1}/${startupTasks.length} failed: ${startupTask.name}`,
            error,
          );
          throw error;
        }
      }

      app.listen(
        { port: config.port, hostname: "0.0.0.0" },
        () => {
          console.log(`Server ${config.name} running on http://localhost:${config.port}`);
        }
      );
      return app;
    },
  };
}
