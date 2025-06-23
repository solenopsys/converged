// api-manager.ts
import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { spawn, ChildProcess } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";

const CONFIG_PATH = "./plugins-config.json";

//bun load .env


const API_PORT = Number(process.env.API_PORT) || 3000;

interface PluginConfig {
  enabled: string[];
}

class ServicesManager {
  private process: ChildProcess | null = null;

  private loadConfig(): PluginConfig {
    if (!existsSync(CONFIG_PATH)) {
      const defaultConfig: PluginConfig = { enabled: [] };
      writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  }

  private saveConfig(config: PluginConfig) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  async restart() {
    console.log("🔄 Перезапуск сервера сервисов...");
    
    if (this.process) {
      this.process.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.process = spawn("bun", ["run", "src/services.ts"], {
      stdio: "inherit",
    });

    return { success: true, message: "Сервер сервисов перезапущен" };
  }

  async enablePlugin(name: string) {
    const config = this.loadConfig();
    if (!config.enabled.includes(name)) {
      config.enabled.push(name);
      this.saveConfig(config);
      return await this.restart();
    }
    return { success: true, message: "Плагин уже включен" };
  }

  async disablePlugin(name: string) {
    const config = this.loadConfig();
    config.enabled = config.enabled.filter(p => p !== name);
    this.saveConfig(config);
    return await this.restart();
  }

  getStatus() {
    const config = this.loadConfig();
    return {
      enabled: config.enabled,
      servicesUrl: `http://localhost:${API_PORT}`,
      running: this.process !== null && !this.process.killed
    };
  }
}

const manager = new ServicesManager();

new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: "Plugin Manager API",
        version: "1.0.0"
      }
    }
  }))
  .get("/", () => ({ message: "Plugin Manager API" }))
  .get("/plugins", () => manager.getStatus())
  .post("/plugins/:name/enable", ({ params: { name } }) => manager.enablePlugin(name))
  .post("/plugins/:name/disable", ({ params: { name } }) => manager.disablePlugin(name))
  .post("/restart", () => manager.restart())
  .listen(API_PORT, () => {
    console.log(`🎮 Manager API: http://localhost:${API_PORT}`);
    console.log(`📖 Docs: http://localhost:${API_PORT}/swagger`);
    manager.restart();
  });