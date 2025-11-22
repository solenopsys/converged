import {
  Base64,
  type DagService,
  type Workflow,
} from "../../dag-types/interface";
import { Hash, HashString, CodeSource } from "../../dag-types/interface";
import { StoreController } from "./store/controller";
import { toHex } from "./tools";
import { LambdaExecutor, runLambda } from "./processing/lambda-executor";
import { genHash } from "./tools";
import { preciseStringfy } from "./tools";
import { initProvidersPool } from "dag-api";
import { WorkflowReactor } from "./processing/workflow-reactor";

export default class DagServiceImpl implements DagService {
  tempDir = "./temp/nodes";
  private store: StoreController;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    this.store = await StoreController.getInstance();
    initProvidersPool(this.store.scheme.provider, "./temp/providers");
  }

  private async ensureInit() {
    await this.initPromise;
  }

  async status(): Promise<{ status: string }> {
    await this.ensureInit();
    const statistic = this.store.scheme.stats();
    return Promise.resolve({ status: "ok", db: statistic.root });
  }

  async setCodeSource(
    name: string,
    code: string,
  ): Promise<{
    name: string;
    version: number;
    hash: HashString;
    fields: { name: string; type: string }[];
  }> {
    await this.ensureInit();
    const hash = await this.store.scheme.code.saveCode(code);
    const nodeType = await this.store.scheme.code.createCodeSource(name, hash);
    return Promise.resolve({
      name,
      version: nodeType.version,
      hash,
      fields: nodeType.fields,
    });
  }

  async getCodeSourceVersions(
    name: string,
  ): Promise<{ versions: CodeSource[] }> {
    await this.ensureInit();
    return this.store.scheme.code.getCodeSourceVersions(name);
  }

  async createNodeConfig(
    codeSourceName: string,
    config: any,
  ): Promise<{ hash: HashString }> {
    await this.ensureInit();
    return this.store.scheme.node.createNodeConfig(codeSourceName, config);
  }

  async createNode(nodeName: string, config: any): Promise<{ key: string }> {
    await this.ensureInit();
    return { key: this.store.scheme.node.createNode(nodeName, config) };
  }

  async createProvider(
    name: string,
    codeSourceName: string,
    config: any,
  ): Promise<{ hash: HashString }> {
    await this.ensureInit();
    return this.store.scheme.provider.createProvider(
      name,
      codeSourceName,
      config,
    );
  }

  async createContext(
    workflowHash: HashString,
    initState?: any,
  ): Promise<{ contextKey: string; startNode: string; endNode: string }> {
    await this.ensureInit();
    const contextKey =
      this.store.processing.contexts.createContext(workflowHash);
    this.store.processing.contexts.addDataToContext(
      contextKey,
      "input",
      initState,
    );

    // todo start and end
    return { contextKey: contextKey, startNode: "", endNode: "" };
  }

  async workflowEvent(
    contextKey: string,
    event: string,
    cascade: boolean,
  ): AsyncIterable<{ result: any }> {
    await this.ensureInit();
    console.log("workflowEvent", contextKey, event, cascade);
    const reactor = new WorkflowReactor(contextKey);
    await reactor.init();
    const res = await reactor.action(event, cascade);
    return [];
    //return this.store.processing.executions.workflowEvent(contextKey, event, cascade);
    //   return [];
  }

  async setParam(name: string, value: any): Promise<{ replaced: boolean }> {
    await this.ensureInit();
    return this.store.scheme.param.setParam(name, value);
  }

  async getParam(name: string): Promise<{ value: string }> {
    await this.ensureInit();
    return this.store.scheme.param.getParam(name);
  }

  async paramsList(): Promise<{ params: { [name: string]: string } }> {
    await this.ensureInit();
    return Promise.resolve({ params: this.store.scheme.param.listParams() });
  }

  async codeSourceList(): Promise<{ names: string[] }> {
    await this.ensureInit();
    return Promise.resolve({ names: this.store.scheme.code.listCodeSoruce() });
  }

  async getWorkflowVersions(name: string): Promise<{ versions: string[] }> {
    await this.ensureInit();
    return Promise.resolve({
      versions: this.store.scheme.workflow.getWorkflowVersions(name),
    });
  }

  async getNode(name: string): Promise<{ config: any }> {
    await this.ensureInit();
    console.log("getNode", name);
    const hash = this.store.scheme.node.getNode(name);
    console.log("hash", hash);
    const config = this.store.scheme.node.getNodeConfig(hash);
    console.log("config", config);
    return { config };
  }

  run(
    pid: string,
    workflow: HashString,
    command: string,
    params?: any,
  ): AsyncIterable<{ result: any }> {
    return this.executor.run(pid, workflow, command, params);
  }

  async getWorkflowConfig(hash: HashString): Promise<Workflow> {
    await this.ensureInit();
    return this.store.scheme.workflow.getWorkflowConfig(hash);
  }
  async getWorkflowConfigByName(
    name: string,
    version: string,
  ): Promise<Workflow> {
    await this.ensureInit();
    const hash = this.store.scheme.workflow.getWorkflowHash(name, version);
    return this.store.scheme.workflow.getWorkflowConfig(hash);
  }

  async workflowList(): Promise<{ names: string[] }> {
    await this.ensureInit();
    return Promise.resolve({
      names: this.store.scheme.workflow.listWorkflow(),
    });
  }

  async nodeList(): Promise<{ names: string[] }> {
    await this.ensureInit();
    return Promise.resolve({ names: this.store.scheme.node.listNodes() });
  }

  async providerList(): Promise<{ names: string[] }> {
    await this.ensureInit();
    return Promise.resolve({
      names: this.store.scheme.provider.listProvider(),
    });
  }

  async runCode(nodeHash: HashString, params: any): Promise<{ result: any }> {
    await this.ensureInit();
    const executor = new LambdaExecutor(nodeHash, this.tempDir);
    return executor.execute(params);
  }

  async runLambda(name: string, params: any): Promise<{ result: any }> {
    await this.ensureInit();
    console.log("runLambda", name, params);
    return runLambda(name, params, this.tempDir);
  }

  async startProcess(
    workflowId?: string,
    meta?: any,
  ): Promise<{ processId: string }> {
    const processId = this.generateProcessId();

    // // Создаем процесс в LMDB
    // this.store.process.createProcess(processId, workflowId, meta);

    // // Создаем событие запуска
    // this.store.process.storeEvent(processId, 'process_started', undefined, { workflowId, meta });

    // // Индексируем для быстрого поиска
    // await this.store.index.indexProcess(processId, workflowId, 'running', meta ? JSON.stringify(meta) : undefined);

    return Promise.resolve({ processId });
  }

  async getContext(contextKey: string): Promise<{ state: any }> {
    await this.ensureInit();
    return this.store.processing.contexts.getContext(contextKey);
  }

  async createWorkflow(
    name: string,
    workflow: Workflow,
  ): Promise<{ hash: HashString }> {
    await this.ensureInit();
    const configString = preciseStringfy(workflow);
    const hash = genHash(configString);

    // Сохраняем конфигурацию workflow
    this.store.scheme.workflow.createWorkflowConfig(hash, workflow);

    // Создаем версию workflow
    const version = new Date().getTime().toString();
    this.store.scheme.workflow.createWorkflow(name, version, hash);

    return Promise.resolve({ hash });
  }

  async createWebhook(
    name: string,
    url: string,
    method: string,
    workflowId: string,
    options?: any,
  ): Promise<{ version: number }> {
    const version = new Date().getTime();

    // Сохраняем webhook в DAG
    //   this.store.scheme.createWebhook(name, version.toString(), url, method, workflowId, options);

    return Promise.resolve({ version });
  }

  private generateProcessId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}
