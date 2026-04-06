import { BaseRepositoryJson, JsonStore } from "back-core";
import { ModuleKey, PresetKey } from "./entities";
import type { ModuleDefinition, ModulePreset } from "../../types";

class ModuleRepository extends BaseRepositoryJson<ModuleKey, ModuleDefinition> {}
class PresetRepository extends BaseRepositoryJson<PresetKey, ModulePreset> {}

export class ConfigStoreService {
  private readonly moduleRepo: ModuleRepository;
  private readonly presetRepo: PresetRepository;

  constructor(store: JsonStore) {
    this.moduleRepo = new ModuleRepository(store);
    this.presetRepo = new PresetRepository(store);
  }

  async registerModule(module: ModuleDefinition): Promise<void> {
    await this.moduleRepo.save(new ModuleKey(module.name), module);
  }

  async unregisterModule(name: string): Promise<boolean> {
    return this.moduleRepo.delete(new ModuleKey(name));
  }

  async getModule(name: string): Promise<ModuleDefinition | undefined> {
    return this.moduleRepo.get(new ModuleKey(name));
  }

  async listModules(): Promise<ModuleDefinition[]> {
    return this.moduleRepo.listAll();
  }

  async createPreset(name: string, modules: string[]): Promise<void> {
    await this.presetRepo.save(new PresetKey(name), { name, modules });
  }

  async updatePreset(name: string, modules: string[]): Promise<void> {
    await this.presetRepo.save(new PresetKey(name), { name, modules });
  }

  async deletePreset(name: string): Promise<boolean> {
    return this.presetRepo.delete(new PresetKey(name));
  }

  async getPreset(name: string): Promise<ModulePreset | undefined> {
    return this.presetRepo.get(new PresetKey(name));
  }

  async listPresets(): Promise<ModulePreset[]> {
    return this.presetRepo.listAll();
  }
}
