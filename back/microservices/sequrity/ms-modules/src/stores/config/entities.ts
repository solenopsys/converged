import { BaseKeyJson } from "back-core";
import type { ModuleDefinition, ModulePreset } from "../../types";

export class ModuleKey extends BaseKeyJson {
  readonly type = "module";
}

export class PresetKey extends BaseKeyJson {
  readonly type = "preset";
}

export type { ModuleDefinition, ModulePreset };
