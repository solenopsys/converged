import { genHash, preciseStringfy } from "./tools";

const DEFAULT_CODE_VERSION = "code";
const NODE_PREFIX = "node";

export type HashString = string;

export type NodeConfig = {
  codeName: string;
  config: any;
};

export type ProviderConfig = {
  codeName: string;
  config: Record<string, any>;
};

export type WebhookConfig = {
  url: string;
  method: string;
  workflowId: string;
  options?: any;
};

export type NodeDefinition = {
  name: string;
  ctor: new (...args: any[]) => any;
  params: { name: string; type: string }[];
};

export type ProviderDefinition = {
  name: string;
  ctor: new (...args: any[]) => any;
  params: { name: string; type: string }[];
};

export interface Provider {
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export type Workflow = {
  nodes: { [name: string]: HashString };
  links: Record<string, string | string[]>;
  description?: string;
  aspects?: { [name: string]: Record<string, any> };
};

export type CodeSource = {
  name: string;
  version: string;
  fields: { name: string; type: string }[];
};

export class DagRegistry {
  private nodeDefinitions = new Map<string, NodeDefinition>();
  private providerDefinitions = new Map<string, ProviderDefinition>();
  private providerInstances = new Map<string, Provider>();
  private nodeConfigs = new Map<HashString, NodeConfig>();
  private nodeKeys = new Map<string, HashString>();
  private nodeByName = new Map<string, string>();
  private workflows = new Map<HashString, Workflow>();
  private workflowVersions = new Map<string, Map<string, HashString>>();
  private providers = new Map<string, ProviderConfig>();
  private params = new Map<string, any>();
  private webhooks = new Map<string, Map<string, WebhookConfig>>();

  // Регистрация определений из workflows
  registerNodeDefinition(definition: NodeDefinition): void {
    this.nodeDefinitions.set(definition.name, definition);
  }

  registerProviderDefinition(definition: ProviderDefinition): void {
    this.providerDefinitions.set(definition.name, definition);
  }

  getNodeDefinition(name: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(name);
  }

  getProviderDefinition(name: string): ProviderDefinition | undefined {
    return this.providerDefinitions.get(name);
  }

  listCodeSource(): string[] {
    return Array.from(this.nodeDefinitions.keys());
  }

  listProviderCodeSource(): string[] {
    return Array.from(this.providerDefinitions.keys());
  }

  // Провайдеры как объекты
  registerProvider(name: string, provider: Provider): void {
    this.providerInstances.set(name, provider);
  }

  getProviderInstance(name: string): Provider | undefined {
    return this.providerInstances.get(name);
  }

  listProviderInstances(): string[] {
    return Array.from(this.providerInstances.keys());
  }

  ensureCodeSource(name: string): string {
    const definition = this.nodeDefinitions.get(name) ?? this.providerDefinitions.get(name);
    if (!definition) {
      throw new Error(`Code source not found: ${name}`);
    }
    return DEFAULT_CODE_VERSION;
  }

  getCodeSource(name: string, _version: string): { params: { name: string; type: string }[] } {
    const definition = this.nodeDefinitions.get(name) ?? this.providerDefinitions.get(name);
    if (!definition) {
      throw new Error(`Code source not found: ${name}`);
    }
    return { params: definition.params };
  }

  getCodeSourceVersions(name: string): { versions: CodeSource[] } {
    const definition = this.nodeDefinitions.get(name) ?? this.providerDefinitions.get(name);
    if (!definition) {
      throw new Error(`Code source not found: ${name}`);
    }
    return {
      versions: [
        {
          name,
          version: DEFAULT_CODE_VERSION,
          fields: definition.params,
        },
      ],
    };
  }

  createNodeConfig(nodeCodeName: string, config: any): { hash: HashString } {
    const codeVersion = this.ensureCodeSource(nodeCodeName);
    const struct = {
      config,
      codeName: nodeCodeName,
      codeVersion,
    };
    const configString = preciseStringfy(struct);
    const hashString = genHash(configString) as HashString;
    this.nodeConfigs.set(hashString, struct);
    return { hash: hashString };
  }

  getNodeConfig(hashString: HashString): NodeConfig {
    const config = this.nodeConfigs.get(hashString);
    if (!config) {
      throw new Error(`Node config not found: ${hashString}`);
    }
    return config;
  }

  createNode(nodeName: string, nodeConfigHash: HashString): string {
    const version = Date.now().toString();
    const key = `${NODE_PREFIX}:${nodeName}:${version}`;
    this.nodeKeys.set(key, nodeConfigHash);
    this.nodeByName.set(nodeName, key);
    return key;
  }

  getNode(nodeName: string): HashString {
    const key = this.nodeByName.get(nodeName);
    if (!key) {
      throw new Error(`Node not found: ${nodeName}`);
    }
    return this.getNodeByKey(key);
  }

  getNodeByKey(nodeKey: string): HashString {
    if (this.nodeKeys.has(nodeKey)) {
      return this.nodeKeys.get(nodeKey)!;
    }
    if (this.nodeConfigs.has(nodeKey)) {
      return nodeKey;
    }
    throw new Error(`Node key not found: ${nodeKey}`);
  }

  listNodes(): string[] {
    return Array.from(this.nodeByName.keys());
  }

  createProvider(
    name: string,
    providerCodeName: string,
    config: any,
  ): { name: string } {
    this.ensureCodeSource(providerCodeName);
    this.providers.set(name, {
      codeName: providerCodeName,
      config: config ?? {},
    });
    return { name };
  }

  async getProvider(
    name: string,
  ): Promise<{ codeName: string; config: Record<string, any> }> {
    const entry = this.providers.get(name);
    if (!entry) {
      throw new Error(`Provider not found: ${name}`);
    }
    return { codeName: entry.codeName, config: entry.config };
  }

  async providerExists(name: string): Promise<boolean> {
    return this.providers.has(name);
  }

  listProvider(): string[] {
    return Array.from(this.providers.keys());
  }

  setParam(name: string, value: any): { replaced: boolean } {
    const exists = this.params.has(name);
    this.params.set(name, value);
    return { replaced: exists };
  }

  getParam(name: string): any {
    return this.params.get(name);
  }

  listParams(): { [name: string]: string } {
    return Object.fromEntries(this.params.entries());
  }

  createWorkflowConfig(hash: HashString, workflow: Workflow): void {
    this.workflows.set(hash, workflow);
  }

  getWorkflowConfig(hash: HashString): Workflow {
    const workflow = this.workflows.get(hash);
    if (!workflow) {
      throw new Error(`Workflow not found: ${hash}`);
    }
    return workflow;
  }

  createWorkflow(name: string, version: string, workflowVersionHash: HashString): void {
    if (!this.workflowVersions.has(name)) {
      this.workflowVersions.set(name, new Map());
    }
    this.workflowVersions.get(name)!.set(version, workflowVersionHash);
  }

  getWorkflowHash(name: string, version: string): HashString {
    const versions = this.workflowVersions.get(name);
    if (!versions) {
      throw new Error(`Workflow not found: ${name}`);
    }
    const hash = versions.get(version);
    if (!hash) {
      throw new Error(`Workflow version not found: ${name}@${version}`);
    }
    return hash;
  }

  getWorkflowVersions(name: string): string[] {
    const versions = this.workflowVersions.get(name);
    if (!versions) {
      return [];
    }
    return Array.from(versions.keys());
  }

  listWorkflow(): string[] {
    return Array.from(this.workflowVersions.keys());
  }

  createWebhook(
    name: string,
    version: string,
    url: string,
    method: string,
    workflowId: string,
    options?: any,
  ): void {
    if (!this.webhooks.has(name)) {
      this.webhooks.set(name, new Map());
    }
    this.webhooks.get(name)!.set(version, {
      url,
      method,
      workflowId,
      options,
    });
  }

  stats(): any {
    return {
      nodeDefinitions: this.nodeDefinitions.size,
      providerDefinitions: this.providerDefinitions.size,
      nodes: this.nodeConfigs.size,
      nodeNames: this.nodeByName.size,
      workflows: this.workflows.size,
      providers: this.providers.size,
      params: this.params.size,
      webhooks: Array.from(this.webhooks.values()).reduce(
        (sum, versions) => sum + versions.size,
        0,
      ),
    };
  }
}

let REGISTRY_INSTANCE: DagRegistry | undefined;

export function getDagRegistry(): DagRegistry {
  if (!REGISTRY_INSTANCE) {
    REGISTRY_INSTANCE = new DagRegistry();
  }
  return REGISTRY_INSTANCE;
}
