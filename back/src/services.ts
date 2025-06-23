// services.ts
import { Elysia } from "elysia";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const CONFIG_PATH = "./plugins-config.json";
const PLUGINS_DIR = resolve("./services");
const isDev = process.env.NODE_ENV !== 'production';

const SERVICES_PORT = Number(process.env.SERVICES_PORT) || 3001 ;
const DATA_DIR=process.env.DATA_DIR ;

interface PluginConfig {
  enabled: string[];
}

const loadConfig = (): PluginConfig => {
  if (!existsSync(CONFIG_PATH)) {
    return { enabled: [] };
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
};

const loadPlugin = async (app: Elysia, name: string) => {
  try {
    const pluginPath = isDev 
      ? join(PLUGINS_DIR, `${name}/src/index.ts`)
      : join(PLUGINS_DIR, `${name}.js`);
    const module = await import(pluginPath);
    const plugin = module.default || module;
    
    if (typeof plugin === "function") {
      app.use(plugin({ prefix: `/${name}`,dbPath:`${DATA_DIR}/${name}.db` }));
      console.log(`✅ Плагин ${name} загружен`);
    }
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${name}:`, error);
  }
};

const app = new Elysia();
const config = loadConfig();

app.get("/", () => ({ 
  message: "Services Server",
  plugins: config.enabled 
}));

// Загружаем включенные плагины
for (const pluginName of config.enabled) {
  await loadPlugin(app, pluginName);
}

app.listen(SERVICES_PORT, () => {
  console.log(`🚀 Services: http://localhost:${SERVICES_PORT}`);
  console.log(`📦 Загружено плагинов: ${config.enabled.length}`);
});