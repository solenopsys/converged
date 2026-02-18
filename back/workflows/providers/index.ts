import type { Provider } from "../dag-api";

import OpenAiProvider from "./openai";
import LogsProvider from "./logs";
import OpenScadConvertorProvider from "./openscadconvertor";

export type ProviderParam = { name: string; type: string };

export type ProviderDefinition = {
  ctor: new (...args: any[]) => Provider;
  params: ProviderParam[];
};

export interface ProviderStore {
  getProvider(
    name: string,
  ): Promise<{ codeName: string; config: Record<string, any> }>;
}

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  openai: {
    ctor: OpenAiProvider,
    params: [
      { name: "token", type: "string" },
      { name: "model", type: "string" },
    ],
  },

  logs: {
    ctor: LogsProvider,
    params: [{ name: "host", type: "string" }],
  },

  openscadconvertor: {
    ctor: OpenScadConvertorProvider,
    params: [{ name: "host", type: "string" }],
  },
};

export function getProviderDefinition(
  name: string,
): ProviderDefinition | undefined {
  return PROVIDER_DEFINITIONS[name];
}

class ProvidersPool {
  private providers = new Map<string, Provider>();

  constructor(private store: ProviderStore) {}

  async getOrCreate(name: string): Promise<Provider> {
    if (this.providers.has(name)) {
      return this.providers.get(name)!;
    }

    const data = await this.store.getProvider(name);
    const providerName = data.codeName ?? name;
    const definition = getProviderDefinition(providerName);

    if (!definition) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const args = definition.params.length
      ? definition.params.map((param) => data.config?.[param.name])
      : Object.values(data.config ?? {});

    const provider: Provider = Reflect.construct(definition.ctor, args);
    await provider.start();
    this.providers.set(name, provider);
    return provider;
  }

  async remove(name: string) {
    const provider = this.providers.get(name);
    if (provider) {
      await provider.stop();
      this.providers.delete(name);
    }
  }

  async shutdownAll() {
    for (const provider of this.providers.values()) {
      await provider.stop();
    }
    this.providers.clear();
  }
}

let PROVIDERS_POOL: ProvidersPool | undefined;

export function initProvidersPool(store: ProviderStore) {
  PROVIDERS_POOL = new ProvidersPool(store);
}

export function getProvidersPool(): ProvidersPool {
  if (!PROVIDERS_POOL) {
    throw new Error("ProvidersPool is not initialized");
  }
  return PROVIDERS_POOL;
}
