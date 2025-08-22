// services.ts
import { Elysia } from "elysia";


const SERVICES_PORT = Number(process.env.SERVICES_PORT) || 3001;
const DATA_DIR = process.env.DATA_DIR;

interface PluginConfig {
  plugins: Record<string, string>;
}

 
const loadConfig = (): PluginConfig => {
  const configEnv = process.env.CONFIG;
  console.log(configEnv);
  
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
    // Скачиваем плагин по URL
    console.log("URL:",url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const code = await response.text();

    console.log("CODE:",code);
    
    // Создаем data URL для загрузки модуля
    const dataUrl = `data:text/javascript;base64,${btoa(code)}`;
    const module = await import(dataUrl);
    const plugin = module.default || module;
    
    if (typeof plugin === "function") {

      const value:string=process.env[name.toUpperCase()+"_CONF"]||"{}";
      const objectValue=JSON.parse(value);
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

// Загружаем плагины из конфигурации
for (const [pluginName, pluginUrl] of Object.entries(config.plugins)) {
  await loadPlugin(app, pluginName, pluginUrl);
}

app.listen(SERVICES_PORT, () => {
  console.log(`🚀 Services: http://localhost:${SERVICES_PORT}`);
  console.log(`📦 Загружено плагинов: ${pluginNames.length}`);
  console.log(`🔧 Плагины:`, pluginNames.join(", "));
});