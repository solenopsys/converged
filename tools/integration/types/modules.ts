export type Module = {
  name: string;
  link: string;
  protected: boolean;
  locales: Record<string, string>;
}

export type ModuleDefinition = {
  name: string;
  remote: boolean;
  protected: boolean;
}

export type ModulePreset = {
  name: string;
  modules: string[];
}

export type UserModuleConfig = {
  presets: string[];
  additions: string[];
  removals: string[];
}

export interface ModulesService {
  listForUser(userId: string): Promise<Module[]>;
  getUserConfig(userId: string): Promise<UserModuleConfig>;
  addModuleToUser(userId: string, moduleName: string): Promise<void>;
  removeModuleFromUser(userId: string, moduleName: string): Promise<void>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;

  createPreset(name: string, modules: string[]): Promise<void>;
  updatePreset(name: string, modules: string[]): Promise<void>;
  deletePreset(name: string): Promise<void>;
  getPreset(name: string): Promise<ModulePreset | null>;
  listPresets(): Promise<ModulePreset[]>;

  registerModule(module: ModuleDefinition): Promise<void>;
  unregisterModule(name: string): Promise<void>;
  getModule(name: string): Promise<ModuleDefinition | null>;
  listModules(): Promise<ModuleDefinition[]>;
}
