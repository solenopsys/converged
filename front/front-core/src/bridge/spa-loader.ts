import type { SpaModuleRegistry, SpaModuleStatus } from './types';

type ModuleEntry = {
  status: SpaModuleStatus;
  promise?: Promise<unknown>;
  value?: unknown;
  error?: unknown;
};

export function createSpaModuleLoader(registry: SpaModuleRegistry = {}) {
  const entries = new Map<string, ModuleEntry>();

  function getStatus(name: string): SpaModuleStatus {
    return entries.get(name)?.status ?? 'idle';
  }

  function get(name: string): unknown {
    return entries.get(name)?.value;
  }

  async function load(name: string): Promise<unknown> {
    const factory = registry[name];
    if (!factory) {
      throw new Error(`Unknown SPA module "${name}"`);
    }

    const current = entries.get(name);
    if (current?.status === 'ready') return current.value;
    if (current?.status === 'loading' && current.promise) return current.promise;

    const promise = (async () => {
      try {
        const value = await factory();
        entries.set(name, { status: 'ready', value });
        return value;
      } catch (error) {
        entries.set(name, { status: 'error', error });
        throw error;
      }
    })();

    entries.set(name, { status: 'loading', promise });
    return promise;
  }

  async function preload(names: string[]): Promise<void> {
    await Promise.allSettled(names.map((name) => load(name)));
  }

  function reset(name?: string): void {
    if (name) {
      entries.delete(name);
      return;
    }
    entries.clear();
  }

  function snapshot(): Record<string, SpaModuleStatus> {
    const result: Record<string, SpaModuleStatus> = {};
    for (const [name, entry] of entries.entries()) {
      result[name] = entry.status;
    }
    return result;
  }

  return {
    load,
    preload,
    reset,
    get,
    getStatus,
    snapshot,
  };
}
