import { createHttpBackend } from "nrpc";
import type { Provider } from "./dag-api";

// TODO: wire new DagService implementation
function createProviders(
  definitions: Record<string, { ctor: new (...args: any[]) => Provider; params: { name: string; type: string }[] }> | undefined,
  config: Record<string, any>,
): Record<string, Provider> {
  if (!definitions) return {};

  const providers: Record<string, Provider> = {};
  const port = process.env.PORT || process.env.SERVICES_PORT || "3000";
  const host = config.servicesBaseUrl
    || process.env.SERVICES_BASE
    || `http://localhost:${port}/services`;

  for (const [name, def] of Object.entries(definitions)) {
    const args = def.params.map((p) => {
      if (p.name === "host") return host;
      return config[p.name];
    });
    providers[name] = Reflect.construct(def.ctor, args);
  }

  return providers;
}

export default (config: any) => {
  const wf = config.workflows ?? {};
  createProviders(wf.PROVIDER_DEFINITIONS, config);

  const serviceImpl = {} as any;
  const metadata = {} as any;
  return createHttpBackend({ metadata, serviceImpl })(config);
};
