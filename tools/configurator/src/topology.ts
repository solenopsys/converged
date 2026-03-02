import type {
  GeneratorContext,
  MicroserviceRef,
  ResolvedContainer,
  Resources,
} from "./types";

export type PresetMode = "mono" | "multi";

export const UI_APP_PORT = 3000;
export const SERVICES_APP_PORT = 3001;
export const SERVICE_PORT = 80;

export const DATA_MOUNT = "/app/data";
export const CONFIG_MOUNT = "/app/config";
export const CONFIG_FILE = "config.json";
export const STORAGE_BIN_PATH = "/app/storage";
export const STORAGE_SOCKET_DIR = "/app/socket";
export const STORAGE_SOCKET_PATH = `${STORAGE_SOCKET_DIR}/storage.sock`;

const DEFAULT_UI_RESOURCES: Resources = {
  requests: { cpu: "100m", memory: "128Mi" },
  limits: { cpu: "500m", memory: "512Mi" },
};

const DEFAULT_SERVICES_RESOURCES: Resources = {
  requests: { cpu: "200m", memory: "256Mi" },
  limits: { cpu: "1000m", memory: "1Gi" },
};

export interface ServiceGroupPlan {
  name: string;
  microservices: MicroserviceRef[];
  resources: Resources;
  serviceName: string;
}

export interface UiPlan {
  serviceName: string;
  landing: boolean;
  spa: boolean;
  microfrontends: { name: string; project: string }[];
  resources: Resources;
}

export interface DeploymentPlan {
  mode: PresetMode;
  ui: UiPlan;
  serviceGroups: ServiceGroupPlan[];
}

function normalizePresetMode(preset: string): PresetMode {
  return preset === "mono" ? "mono" : "multi";
}

function sanitizeName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return cleaned || "group";
}

function dedupeMicroservices(services: MicroserviceRef[]): MicroserviceRef[] {
  const seen = new Set<string>();
  const result: MicroserviceRef[] = [];
  for (const svc of services) {
    const key = `${svc.category}/${svc.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(svc);
  }
  return result;
}

function dedupeMicrofrontends(
  frontends: { name: string; project: string }[],
): { name: string; project: string }[] {
  const seen = new Set<string>();
  const result: { name: string; project: string }[] = [];
  for (const frontend of frontends) {
    if (seen.has(frontend.name)) continue;
    seen.add(frontend.name);
    result.push(frontend);
  }
  return result;
}

function collectAllMicroservices(config: GeneratorContext["config"]): MicroserviceRef[] {
  const all: MicroserviceRef[] = [];
  for (const [category, services] of Object.entries(config.back.microservices)) {
    for (const name of services) {
      all.push({ category, name, project: "unknown" });
    }
  }
  return all;
}

function buildUiPlan(ctx: GeneratorContext): UiPlan {
  const projectName = ctx.projectDir.split("/").pop() || "project";
  const fromContainers = dedupeMicrofrontends(
    ctx.containers.flatMap((container) => container.microfrontends),
  );

  const microfrontends = fromContainers.length > 0
    ? fromContainers
    : ctx.config.spa.microfrontends.map((name) => ({ name, project: projectName }));

  return {
    serviceName: `${ctx.config.name}-ui`,
    landing: Boolean(ctx.config.landing),
    spa: true,
    microfrontends,
    resources: DEFAULT_UI_RESOURCES,
  };
}

function collectMonoServices(containers: ResolvedContainer[], config: GeneratorContext["config"]): MicroserviceRef[] {
  const combined = containers.flatMap((container) => container.microservices);
  if (combined.length > 0) return dedupeMicroservices(combined);
  return dedupeMicroservices(collectAllMicroservices(config));
}

function collectMultiGroups(ctx: GeneratorContext): ServiceGroupPlan[] {
  const groups = ctx.containers
    .filter((container) => container.microservices.length > 0)
    .map((container) => ({
      rawName: container.name,
      microservices: dedupeMicroservices(container.microservices),
      resources: container.resources || DEFAULT_SERVICES_RESOURCES,
    }));

  if (groups.length === 0) {
    groups.push({
      rawName: "services",
      microservices: dedupeMicroservices(collectAllMicroservices(ctx.config)),
      resources: DEFAULT_SERVICES_RESOURCES,
    });
  }

  const usedNames = new Set<string>();
  return groups.map((group) => {
    const base = sanitizeName(group.rawName);
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${base}-${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return {
      name,
      microservices: group.microservices,
      resources: group.resources,
      serviceName: `${ctx.config.name}-${name}`,
    };
  });
}

export function buildDeploymentPlan(ctx: GeneratorContext): DeploymentPlan {
  const mode = normalizePresetMode(ctx.preset);
  const ui = buildUiPlan(ctx);

  if (mode === "mono") {
    const monoServices = collectMonoServices(ctx.containers, ctx.config);
    const monoResources =
      ctx.containers[0]?.resources || DEFAULT_SERVICES_RESOURCES;
    return {
      mode,
      ui,
      serviceGroups: [
        {
          name: "services",
          microservices: monoServices,
          resources: monoResources,
          serviceName: `${ctx.config.name}-services`,
        },
      ],
    };
  }

  return {
    mode,
    ui,
    serviceGroups: collectMultiGroups(ctx),
  };
}
