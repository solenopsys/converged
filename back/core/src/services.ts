// services.ts
import { Elysia } from "elysia";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SERVICES_PORT = Number(process.env.SERVICES_PORT) || 3001;

interface PluginConfig {
  plugins: Record<string, string>;
}

const loadConfig = (): PluginConfig => {
  const configEnv = process.env.CONFIG;
  if (!configEnv) {
    console.warn("⚠️ CONFIG переменная не найдена");
    return { plugins: {} };
  }
  try {
    return JSON.parse(configEnv);
  } catch (error) {
    console.error("❌ Ошибка парсинга CONFIG:", error);
    return { plugins: {} };
  }
};

const loadPlugin = async (app: Elysia, name: string, url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const code = await response.text();
    const fileName = url.split('/').pop() || `${name}.js`;
    const tempDir = join(tmpdir(), 'plugins');
    mkdirSync(tempDir, { recursive: true });
    const tempPath = join(tempDir, fileName);
    
    writeFileSync(tempPath, code, 'utf8');
    
    const module = await import(`file://${tempPath}`);
    const plugin = module.default || module;
    
    if (typeof plugin === "function") {
      const value = process.env[name.toUpperCase() + "_CONF"] || "{}";
      const objectValue = JSON.parse(value);
      app.use(plugin(objectValue));
      console.log(`✅ Плагин ${name} загружен из ${url}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${name}:`, error);
  }
};

const app = new Elysia();
const config = loadConfig();
const pluginNames = Object.keys(config.plugins);

app.get("/", () => ({
  message: "Services Server",
  plugins: pluginNames
}));

for (const [pluginName, pluginUrl] of Object.entries(config.plugins)) {
  await loadPlugin(app, pluginName, pluginUrl);
}

app.listen(SERVICES_PORT, () => {
  console.log(`🚀 Services: http://localhost:${SERVICES_PORT}`);
  console.log(`📦 Загружено плагинов: ${pluginNames.length}`);
  console.log(`🔧 Плагины:`, pluginNames.join(", "));
});