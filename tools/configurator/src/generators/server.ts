import type { GeneratorContext } from "../types";

function buildServiceHostMap(ctx: GeneratorContext): Record<string, string> {
  const { config, containers } = ctx;
  const hostMap: Record<string, string> = {};

  for (const container of containers) {
    const host = `${config.name}-${container.name}`;
    for (const svc of container.microservices) {
      hostMap[`${svc.category}/${svc.name}`] = host;
    }
  }

  return hostMap;
}

export function generateRuntimeConfigs(ctx: GeneratorContext): Map<string, string> {
  const result = new Map<string, string>();
  const { config, containers } = ctx;

  // Service host map — single file for the whole cluster
  result.set("service-hosts.json", JSON.stringify(buildServiceHostMap(ctx), null, 2));

  // Per-container config
  for (const container of containers) {
    const msMap: Record<string, string[]> = {};
    for (const svc of container.microservices) {
      (msMap[svc.category] ??= []).push(svc.name);
    }

    const modules: Record<string, boolean> = {};
    for (const mf of container.microfrontends) {
      modules[mf.name] = true;
    }

    const runtimeConfig = {
      name: config.name,
      container: container.name,
      landing: container.landing ? config.landing : undefined,
      spa: container.spa ? config.spa : undefined,
      back: {
        core: config.back.core,
        microservices: msMap,
      },
      frontend: {
        modules,
        layout: "sidebar",
        mountChatView: container.microfrontends.some((mf) => mf.name === "assistants"),
      },
    };

    result.set(
      `${container.name}.config.json`,
      JSON.stringify(runtimeConfig, null, 2),
    );
  }

  return result;
}
