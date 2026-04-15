import type { GeneratorContext } from "../types";
import { buildDeploymentPlan } from "../topology";

function buildServiceHostMap(ctx: GeneratorContext): Record<string, string> {
  const plan = buildDeploymentPlan(ctx);
  const hostMap: Record<string, string> = {};

  for (const group of plan.serviceGroups) {
    for (const svc of group.microservices) {
      hostMap[`${svc.category}/${svc.name}`] = group.serviceName;
    }
  }

  return hostMap;
}

function buildMicroserviceMap(services: { category: string; name: string }[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const svc of services) {
    (map[svc.category] ??= []).push(svc.name);
  }
  return map;
}

export function generateRuntimeConfigs(ctx: GeneratorContext): Map<string, string> {
  const result = new Map<string, string>();
  const { config } = ctx;
  const plan = buildDeploymentPlan(ctx);
  const cacheConfig = {
    url: plan.cache.url,
    keyPrefix: plan.cache.keyPrefix,
    ssrTtlSeconds: plan.cache.ssrTtlSeconds,
  };

  // Service host map — single file for the whole cluster
  result.set("service-hosts.json", JSON.stringify(buildServiceHostMap(ctx), null, 2));

  const uiModules: Record<string, boolean> = {};
  for (const mf of plan.ui.microfrontends) {
    uiModules[mf.name] = true;
  }
  const chatModule = config.frontend?.mountChatViewModule;

  const uiConfig = {
    name: config.name,
    container: "ui",
    landing: plan.ui.landing ? config.landing : undefined,
    spa: plan.ui.spa ? config.spa : undefined,
    back: {
      core: config.back.core,
      microservices: {},
    },
    frontend: {
      modules: uiModules,
      layout: "sidebar",
      mountChatView: chatModule ? Boolean(uiModules[chatModule]) : false,
    },
    cache: cacheConfig,
  };

  result.set("ui.config.json", JSON.stringify(uiConfig, null, 2));

  for (const group of plan.serviceGroups) {
    const runtimeConfig = {
      name: config.name,
      container: group.name,
      back: {
        core: config.back.core,
        microservices: buildMicroserviceMap(group.microservices),
      },
      frontend: {
        modules: {},
        layout: "sidebar",
        mountChatView: false,
      },
      cache: cacheConfig,
    };

    result.set(
      `${group.name}.config.json`,
      JSON.stringify(runtimeConfig, null, 2),
    );
  }

  return result;
}
