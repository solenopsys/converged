import { Base64, type DagService, type Workflow } from "../../dag-types/interface";
import { Hash, HashString, CodeSource } from "../../dag-types/interface";
import { StoreController } from "./store/controller";
import { toHex } from "./tools";
import { Executor } from "./executor";
import { genHash } from "./tools";
import { preciseStringfy } from "./tools";
import { initProvidersPool } from "dag-api";

export default class DagServiceImpl implements DagService {

    private executor = new Executor("./temp/nodes");
    private store = StoreController.getInstance();

    constructor() {
        initProvidersPool(this.store.scheme.provider, "./temp/providers")
    }

    async status(): Promise<{ status: string }> {
        const statistic = this.store.scheme.stats();
        return Promise.resolve({ status: "ok", db: statistic.root });
    }

    async setCodeSource(name: string, code: string): Promise<{ name: string, version: number, hash: HashString, fields: { name: string, type: string }[] }> {
        const hash = await this.store.scheme.code.saveCode(code)
        const nodeType = await this.store.scheme.code.createCodeSource(name, hash);
        return Promise.resolve({ name, version: nodeType.version, hash, fields: nodeType.fields })
    }

    async getCodeSourceVersions(name: string): Promise<{ versions: CodeSource[] }> {
        return this.store.scheme.code.getCodeSourceVersions(name);
    }

    async createNodeConfig(codeSourceName: string, config: any): Promise<{ hash: HashString }> {
        return this.store.scheme.node.createNodeConfig(codeSourceName, config);
    }

    async createNode(nodeName: string, config: any): Promise<{ key: string }> {
        return {key:this.store.scheme.node.createNode(nodeName, config)};
    }

    async createProvider(name: string, codeSourceName: string, config: any): Promise<{ hash: HashString }> {
        return this.store.scheme.provider.createProvider(name, codeSourceName, config);
    }


    async setParam(name: string, value: any): Promise<{ replaced: boolean }> {
        return this.store.scheme.param.setParam(name, value);
    }

    async getParam(name: string): Promise<{ value: string }> {
        return this.store.scheme.param.getParam(name);
    }

    async paramsList(): Promise<{ params: { [name: string]: string } }> {
        return Promise.resolve({ params: this.store.scheme.param.listParams() })
    }

    async codeSourceList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.scheme.code.listCodeSoruce() })
    }

    async getWorkflowVersions(name: string): Promise<{ versions: string[] }> {
        return Promise.resolve({ versions: this.store.scheme.workflow.getWorkflowVersions(name) });
    }

    async getNode(hash: HashString): Promise<{ config: any }> {
        return this.store.scheme.node.getNode(hash);
    }

    run(pid: string, workflow: HashString, command: string, params?: any): AsyncIterable<{ result: any }> {
        return this.executor.run(pid, workflow, command, params)
    }

    async getWorkflowConfig(hash: HashString): Promise<Workflow> {
        return this.store.scheme.workflow.getWorkflowConfig(hash);
    }
    async getWorkflowConfigByName(name: string, version: string): Promise<Workflow> {
        const hash = this.store.scheme.workflow.getWorkflowHash(name, version)
        return this.store.scheme.workflow.getWorkflowConfig(hash);
    }

    async workflowList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.scheme.workflow.listWorkflow() })
    }

    async nodeList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.scheme.node.listNodes() })
    }

    async providerList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.scheme.provider.listProvider() })
    }

    async runCode(nodeHash: HashString, params: any): Promise<{ result: any }> {
        this.store.process
        this.store.index
        return this.executor.runNodeConfig(nodeHash, params)
    }

    async runLambda(name: string, params: any): Promise<{ result: any }> {
        console.log("runLambda",name,params);
        return this.executor.runLambda(name, params)
    }

    async startProcess(workflowId?: string, meta?: any): Promise<{ processId: string }> {
        const processId = this.generateProcessId();

        // Создаем процесс в LMDB
        this.store.process.createProcess(processId, workflowId, meta);

        // Создаем событие запуска
        this.store.process.storeEvent(processId, 'process_started', undefined, { workflowId, meta });

        // Индексируем для быстрого поиска
        await this.store.index.indexProcess(processId, workflowId, 'running', meta ? JSON.stringify(meta) : undefined);

        return Promise.resolve({ processId });
    }

    async createWorkflow(name: string, workflow: Workflow): Promise<{ hash: HashString }> {

        const configString = preciseStringfy(workflow);
        const hash = genHash(configString);

        // Сохраняем конфигурацию workflow
        this.store.scheme.createWorkflowConfig(hash, workflow);

        // Создаем версию workflow
        const version = new Date().getTime().toString();
        this.store.scheme.createWorkflow(name, version, hash);

        return Promise.resolve({ hash });
    }

    async createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<{ version: number }> {
        const version = new Date().getTime();

        // Сохраняем webhook в DAG
        this.store.scheme.createWebhook(name, version.toString(), url, method, workflowId, options);

        return Promise.resolve({ version });
    }

    private generateProcessId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}