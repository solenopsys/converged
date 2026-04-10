import type {
  ModulesService,
  Module,
  ModuleDefinition,
  ModulePreset,
  UserModuleConfig,
} from "./types";
import { createHttpClient, Access } from "nrpc";
import { StoresController } from "./stores";

const LOCALES = ["en", "ru", "de", "fr", "it", "pt"];

const REMOTE_BASE =
  process.env.MODULES_REMOTE_BASE ||
  "https://converged-modules.s3.us-east-2.amazonaws.com/front";

const LOCAL_BASE =
  process.env.MODULES_LOCAL_BASE || "http://localhost:3005/modules";

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
    const config = await this.stores.users.getConfig(userId);
    const identityUser = await this.identityClient()
      .getUser(userId)
      .catch(() => null);

    const moduleMap = new Map(allModules.map((m) => [m.name, m]));

    const included = new Set<string>();
    const presetNames = new Set<string>(config.presets as string[]);
    if (identityUser?.preset) {
      presetNames.add(identityUser.preset);
    }

    for (const presetName of presetNames) {
      const preset = await this.stores.config.getPreset(presetName);
      if (preset) {
        for (const name of preset.modules) included.add(name);
      }
    }

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
    return (await this.stores.config.getModule(name)) ?? null;
  }

  async listModules(): Promise<ModuleDefinition[]> {
    await this.ready();
    return this.stores.config.listModules();
  }
}

export default ModulesServiceImpl;
