import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { readdirSync } from "fs";
import { join, resolve } from "path";

interface PluginInfo {
  name: string;
  loaded: boolean;
  error?: string;
}

class PluginManager {
  private plugins = new Map<string, PluginInfo>();
  private pluginsDir = resolve("./plugins");
  private app: Elysia;

  constructor(app: Elysia) {
    this.app = app;
  }

  async loadPlugin(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const pluginPath = join(this.pluginsDir, `${name}.js`);
      
      // Очищаем кэш для hot reload
      delete require.cache[resolve(pluginPath)];
      
      const module = await import(pluginPath);
      const plugin = module.default || module;
      
      if (typeof plugin !== 'function') {
        throw new Error('Плагин должен экспортировать функцию');
      }

      this.app.use(plugin);
      
      this.plugins.set(name, { name, loaded: true });
      return { success: true, message: `Плагин ${name} загружен` };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.plugins.set(name, { name, loaded: false, error: errorMsg });
      return { success: false, message: `Ошибка загрузки ${name}: ${errorMsg}` };
    }
  }

  getPluginsList(): string[] {
    try {
      return readdirSync(this.pluginsDir)
        .filter(file => file.endsWith('.js'))
        .map(file => file.replace('.js', ''));
    } catch {
      return [];
    }
  }

  getLoadedPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }
}

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'Plugin Server API',
        version: '1.0.0'
      }
    }
  }))
  .get("/", () => ({ message: "Plugin Server" }));

const pluginManager = new PluginManager(app);

app
  .post("/api/plugins/:name/load", async ({ params: { name } }) => {
    return await pluginManager.loadPlugin(name);
  })
  
  .get("/api/plugins", () => ({
    available: pluginManager.getPluginsList(),
    loaded: pluginManager.getLoadedPlugins()
  }));

app.listen(3000, () => {
  console.log("Server: http://localhost:3000");
  console.log("Docs: http://localhost:3000/swagger");
});

export default app;