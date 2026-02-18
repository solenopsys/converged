// Локальные типы для workflows (дублирование из ms-dag)

export interface INode {
  name: string;
  execute(data: any): Promise<any>;
}

export interface ContextAccessor {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
}

export function processTemplate(
  template: string,
  data: Record<string, any>,
  params?: Record<string, any>,
): string {
  let result = template;
  const allData = params ? { ...data, ...params } : data;
  for (const [key, value] of Object.entries(allData)) {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    result = result.replace(regex, String(value ?? ""));
  }
  return result;
}

export interface Provider {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export enum ProviderState {
  STOPPED = "stopped",
  STARTING = "starting",
  READY = "ready",
  RUNNING = "running",
  STOPPING = "stopping",
  ERROR = "error",
}

export type AspectDefinition =
  | { type: "inputs"; inputs?: Record<string, string>; consts?: Record<string, any> }
  | { type: "filter"; when: string; source?: "context" | "data" }
  | { type: "transform"; map: Record<string, string>; source?: "context" | "data" }
  | { type: "map"; path: string; concurrency?: number };

export type NodeCallDefinition = {
  nodeType: string;
  nodeName: string;
  config: Record<string, any>;
  aspects?: AspectDefinition[];
  outputKey?: string;
  emitEvent?: string;
  emitOnError?: string;
  emitIfNotEmpty?: boolean;
  emitWhenPath?: string;
};

export type WorkflowAction =
  | { type: "node"; call: NodeCallDefinition }
  | { type: "emit"; event: string; payload?: any }
  | { type: "subworkflow"; workflow: string; event: string; payload?: any };

export type WorkflowHandler = (
  ctx: any,
  message: any,
  runtime: any,
) => Promise<WorkflowAction[]>;

export type WorkflowDefinition = {
  name: string;
  handlers: Record<string, WorkflowHandler>;
};
