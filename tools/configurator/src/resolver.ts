import type {
  BuildConfig,
  ContainerConfig,
  ResolvedContainer,
  MicroserviceRef,
} from "./types";

/**
 * Check if a category belongs to the child project (vs inherited from parent).
 */
function isOwnCategory(category: string, config: BuildConfig): boolean {
  return config.ownCategories?.includes(category) ?? false;
}

/**
 * Determine which project directory owns a given category.
 * If ownCategories is set and includes this category → child project.
 * Otherwise → parent project (if exists).
 */
function resolveProjectForCategory(
  category: string,
  config: BuildConfig,
  projectName: string,
  parentProjectName?: string,
): string {
  if (!parentProjectName) return projectName;
  return isOwnCategory(category, config) ? projectName : parentProjectName;
}

/**
 * Resolve microservice selector (e.g., "sequrity/*" or "club/mailing")
 */
function resolveMicroservices(
  selector: string,
  allServices: Record<string, string[]>,
  config: BuildConfig,
  projectName: string,
  parentProjectName?: string,
): MicroserviceRef[] {
  const [category, name] = selector.split("/");
  const services = name === "*" ? (allServices[category] || []) : [name];
  const project = resolveProjectForCategory(category, config, projectName, parentProjectName);

  return services.map((s) => ({ category, name: s, project }));
}

function dedupeMicrofrontends(
  input: { name: string; project: string }[],
): { name: string; project: string }[] {
  const seen = new Set<string>();
  const result: { name: string; project: string }[] = [];
  for (const item of input) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    result.push(item);
  }
  return result;
}

function dedupeMicroservices(input: MicroserviceRef[]): MicroserviceRef[] {
  const seen = new Set<string>();
  const result: MicroserviceRef[] = [];
  for (const item of input) {
    const key = `${item.category}/${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * Determine which project a microfrontend belongs to.
 * MFs whose names match an ownCategory's services live in child project.
 */
function resolveMfProject(
  mfName: string,
  config: BuildConfig,
  projectName: string,
  parentProjectName?: string,
): string {
  if (!parentProjectName) return projectName;

  // If the MF name matches a service in any own category, it belongs to the child
  for (const cat of config.ownCategories ?? []) {
    const services = config.back.microservices[cat];
    if (services?.includes(mfName)) return projectName;
  }

  return parentProjectName;
}

/**
 * Resolve container configuration to concrete lists
 */
export function resolveContainer(
  container: ContainerConfig,
  config: BuildConfig,
  projectName: string,
  parentProjectName?: string,
): ResolvedContainer {
  const landing = container.landing ?? false;

  let microfrontends: { name: string; project: string }[] = [];
  if (container.microfrontends === "*") {
    microfrontends = config.spa.microfrontends.map((mf) => ({
      name: mf,
      project: resolveMfProject(mf, config, projectName, parentProjectName),
    }));
  } else if (Array.isArray(container.microfrontends)) {
    microfrontends = container.microfrontends.map((mf) => ({
      name: mf,
      project: resolveMfProject(mf, config, projectName, parentProjectName),
    }));
  }

  let microservices: MicroserviceRef[] = [];
  if (container.microservices === "*") {
    for (const [category, services] of Object.entries(config.back.microservices)) {
      const project = resolveProjectForCategory(category, config, projectName, parentProjectName);
      for (const name of services) {
        microservices.push({ category, name, project });
      }
    }
  } else if (Array.isArray(container.microservices)) {
    for (const selector of container.microservices) {
      microservices.push(
        ...resolveMicroservices(selector, config.back.microservices, config, projectName, parentProjectName),
      );
    }
  }

  microfrontends = dedupeMicrofrontends(microfrontends);
  microservices = dedupeMicroservices(microservices);

  return {
    name: container.name,
    landing,
    spa: container.spa ?? false,
    microfrontends,
    microservices,
    resources: container.resources ?? {
      requests: { cpu: "100m", memory: "128Mi" },
      limits: { cpu: "500m", memory: "512Mi" },
    },
  };
}

export function normalizePresetName(
  config: BuildConfig,
  presetName: string,
): string {
  if (config.presets[presetName]) return presetName;

  // Backward compatibility aliases.
  if (presetName === "multy" && config.presets.multi) return "multi";
  if (presetName === "micro" && config.presets.multi) return "multi";
  if (presetName === "multi" && config.presets.micro) return "micro";
  if (presetName === "multi" && config.presets.multy) return "multy";
  if (presetName === "multy" && config.presets.micro) return "micro";

  return presetName;
}

/**
 * Resolve preset to list of resolved containers
 */
export function resolvePreset(
  config: BuildConfig,
  presetName: string,
  projectName: string,
  parentProjectName?: string,
): ResolvedContainer[] {
  const normalizedPreset = normalizePresetName(config, presetName);
  const preset = config.presets[normalizedPreset];
  if (!preset) {
    const available = Object.keys(config.presets).join(", ");
    throw new Error(
      `Preset "${presetName}" not found. Available: ${available}`,
    );
  }

  return preset.containers.map((c) =>
    resolveContainer(c, config, projectName, parentProjectName),
  );
}

/**
 * Get flat list of all microservices
 */
export function getAllMicroservices(
  config: BuildConfig,
  projectName: string,
  parentProjectName?: string,
): MicroserviceRef[] {
  const result: MicroserviceRef[] = [];
  for (const [category, services] of Object.entries(config.back.microservices)) {
    const project = resolveProjectForCategory(category, config, projectName, parentProjectName);
    for (const name of services) {
      result.push({ category, name, project });
    }
  }
  return result;
}
