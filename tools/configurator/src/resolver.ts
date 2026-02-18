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

/**
 * Generate auto containers (scale mode)
 */
function generateAutoContainers(
  config: BuildConfig,
): ContainerConfig[] {
  const containers: ContainerConfig[] = [];

  containers.push({
    name: "gateway",
    landing: !!config.landing,
    spa: true,
    microfrontends: ["dasboards"],
    microservices: [],
    resources: {
      requests: { cpu: "100m", memory: "128Mi" },
      limits: { cpu: "500m", memory: "512Mi" },
    },
  });

  for (const [category, services] of Object.entries(config.back.microservices)) {
    for (const service of services) {
      const matchingMf = config.spa.microfrontends.find(
        (mf) => mf === service || mf === service + "s" || service === mf + "s",
      );

      containers.push({
        name: `${category.toLowerCase()}-${service}`,
        microfrontends: matchingMf ? [matchingMf] : [],
        microservices: [`${category}/${service}`],
        resources: {
          requests: { cpu: "100m", memory: "128Mi" },
          limits: { cpu: "500m", memory: "256Mi" },
        },
      });
    }
  }

  return containers;
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
  const preset = config.presets[presetName];
  if (!preset) {
    const available = Object.keys(config.presets).join(", ");
    throw new Error(
      `Preset "${presetName}" not found. Available: ${available}`,
    );
  }

  const containerConfigs =
    preset.containers === "auto"
      ? generateAutoContainers(config)
      : preset.containers;

  return containerConfigs.map((c) =>
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
