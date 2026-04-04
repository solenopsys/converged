// dfdf Local dag-api types (previously external package)

export interface INode {
  name: string;
  execute(context: ContextAccessor): Promise<any>;
}

export interface Provider {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export enum ProviderState {
  STOPPED = "stopped",
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
  ERROR = "error",
}

export interface ContextAccessor {
  get(key: string): any;
  set(key: string, value: any): void;
  getProvider(name: string): Promise<Provider>;
}

export function processTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    return context[trimmedKey] !== undefined ? String(context[trimmedKey]) : `{{${trimmedKey}}}`;
  });
}

export function evaluateJsonPathString(path: string, data: any): any {
  if (!path.startsWith("$.")) {
    return data[path];
  }

  const parts = path.slice(2).split(".");
  let result = data;

  for (const part of parts) {
    if (result === undefined || result === null) {
      return undefined;
    }
    result = result[part];
  }

  return result;
}
