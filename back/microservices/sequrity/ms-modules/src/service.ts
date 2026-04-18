import type {
  ModulesService,
  Module,
  ModuleDefinition,
  ModulePreset,
  UserModuleConfig,
} from "./types";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHttpClient, Access } from "nrpc";
import { StoresController } from "./stores";

const LOCALES = ["en", "ru", "de", "fr", "it", "pt"];

const REMOTE_BASE =
  process.env.MODULES_REMOTE_BASE ||
  "https://converged-modules.s3.us-east-2.amazonaws.com/front";

const LOCAL_BASE =
  process.env.MODULES_LOCAL_BASE || "http://localhost:3005/modules";

type RuntimeConfig = {
  spa?: {
    microfrontends?: string[];
  };
  frontend?: {
    modules?: Record<string, boolean>;
  };
};

function normalizeModuleName(name: string): string {
  return name.startsWith("mf-") ? name : `mf-${name}`;
}

function readRuntimeConfig(): RuntimeConfig {
  const configPath =
    process.env.CONFIG_PATH ||
    (process.env.PROJECT_DIR
      ? resolve(process.env.PROJECT_DIR, "config.json")
      : "");

  if (!configPath || !existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as RuntimeConfig;
  } catch (error) {
    console.warn("[modules] failed to read runtime config:", configPath, error);
    return {};
  }
}

function runtimeModuleDefinitions(): ModuleDefinition[] {
  const config = readRuntimeConfig();
  const fromSpa = Array.isArray(config.spa?.microfrontends)
    ? config.spa.microfrontends
    : [];
  const fromModules = Object.entries(config.frontend?.modules ?? {})
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  return [...new Set([...fromSpa, ...fromModules].map(normalizeModuleName))].map(
    (name) => ({
      name,
      remote: false,
      protected: true,
    }),
  );
}

export class ModulesServiceImpl implements ModulesService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController("modules-ms");
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  private get baseUrl(): string {
    return (
      (typeof process !== "undefined" && process.env?.SERVICES_BASE) ||
      "http://127.0.0.1:3000/services"
    );
  }

  private identityClient() {
    return createHttpClient<{
      getUser(userId: string): Promise<{ id: string; preset?: string } | null>;
    }>(
      {
        serviceName: "identity",
        methods: [
          { name: "getUser", parameters: [{ name: "userId", type: "string", optional: false, isArray: false }], returnType: "any", isAsync: true, returnTypeIsArray: false, isAsyncIterable: false },
        ],
      } as any,
      { baseUrl: this.baseUrl },
    );
  }

  private resolveModule(def: ModuleDefinition): Module {
    const base = def.remote ? REMOTE_BASE : LOCAL_BASE;
    const locales: Record<string, string> = {};
    for (const locale of LOCALES) {
      locales[locale] = `${base}/locale/${def.name}/${locale}.json`;
    }
    return {
      name: def.name,
      link: `${base}/${def.name}.js`,
      protected: def.protected,
      locales,
    };
  }

  @Access("public")
  async listForUser(userId: string): Promise<Module[]> {
    await this.ready();
    const allModules = await this.stores.config.listModules();
    const runtimeModules = runtimeModuleDefinitions();
    const runtimeModuleNames = runtimeModules.map((m) => m.name);
    const config = await this.stores.users.getConfig(userId);
    const identityUser = await this.identityClient()
      .getUser(userId)
      .catch(() => null);

    const moduleMap = new Map<string, ModuleDefinition>();
    for (const module of runtimeModules) moduleMap.set(module.name, module);
    for (const module of allModules) moduleMap.set(module.name, module);

    const included = new Set<string>();
    const presetNames = new Set<string>(config.presets as string[]);
    if (identityUser?.preset) {
      presetNames.add(identityUser.preset);
    }

    let hasPresetModules = false;
    for (const presetName of presetNames) {
      const preset = await this.stores.config.getPreset(presetName);
      if (preset) {
        for (const name of preset.modules) {
          included.add(name);
          hasPresetModules = true;
        }
      }
    }

    // Backward-compatible default: if user preset is empty/not configured,
    // serve baseline modules from `root` preset instead of returning nothing.
    if (!hasPresetModules) {
      const rootPreset = await this.stores.config.getPreset("root");
      if (rootPreset) {
        for (const name of rootPreset.modules) included.add(name);
      }
    }

    for (const name of runtimeModuleNames) included.add(name);

    for (const name of config.additions) included.add(name);
    for (const name of config.removals) included.delete(name);

    const result: Module[] = [];
    for (const name of included) {
      const def = moduleMap.get(name);
      if (def) result.push(this.resolveModule(def));
    }

    return result;
  }

  async getUserConfig(userId: string): Promise<UserModuleConfig> {
    await this.ready();
    return this.stores.users.getConfig(userId);
  }

  async addModuleToUser(userId: string, moduleName: string): Promise<void> {
    await this.ready();
    await this.stores.users.addModule(userId, moduleName);
  }

  async removeModuleFromUser(userId: string, moduleName: string): Promise<void> {
    await this.ready();
    await this.stores.users.removeModule(userId, moduleName);
  }

  async linkPresetToUser(userId: string, presetName: string): Promise<void> {
    await this.ready();
    await this.stores.users.linkPreset(userId, presetName);
  }

  async unlinkPresetFromUser(userId: string, presetName: string): Promise<void> {
    await this.ready();
    await this.stores.users.unlinkPreset(userId, presetName);
  }

  async createPreset(name: string, modules: string[]): Promise<void> {
    await this.ready();
    await this.stores.config.createPreset(name, modules);
  }

  async updatePreset(name: string, modules: string[]): Promise<void> {
    await this.ready();
    await this.stores.config.updatePreset(name, modules);
  }

  async deletePreset(name: string): Promise<void> {
    await this.ready();
    await this.stores.config.deletePreset(name);
  }

  async getPreset(name: string): Promise<ModulePreset | null> {
    await this.ready();
    return (await this.stores.config.getPreset(name)) ?? null;
  }

  async listPresets(): Promise<ModulePreset[]> {
    await this.ready();
    return this.stores.config.listPresets();
  }

  async registerModule(module: ModuleDefinition): Promise<void> {
    await this.ready();
    await this.stores.config.registerModule(module);
  }

  async unregisterModule(name: string): Promise<void> {
    await this.ready();
    await this.stores.config.unregisterModule(name);
  }

  async getModule(name: string): Promise<ModuleDefinition | null> {
    await this.ready();
    const normalizedName = normalizeModuleName(name);
    const storedModule =
      (await this.stores.config.getModule(normalizedName)) ??
      (normalizedName === name
        ? undefined
        : await this.stores.config.getModule(name));
    if (storedModule) return storedModule;

    const runtimeModule = runtimeModuleDefinitions().find(
      (module) => module.name === normalizedName,
    );
    return runtimeModule ?? null;
  }

  async listModules(): Promise<ModuleDefinition[]> {
    await this.ready();
    const moduleMap = new Map<string, ModuleDefinition>();
    for (const module of runtimeModuleDefinitions()) {
      moduleMap.set(module.name, module);
    }
    for (const module of await this.stores.config.listModules()) {
      moduleMap.set(module.name, module);
    }
    return [...moduleMap.values()];
  }
}

export default ModulesServiceImpl;
