import { Base64, type DagService, type Workflow } from "../../types/interface";
import { Hash, HashString, CodeSource } from "../../types/interface";
import { StoreService } from "./store/sheme.store";
import { toHex } from "./tools";
import { Executor } from "./executor";
import { genHash } from "./tools";
import { preciseStringfy } from "./tools";
import { initProvidersPool } from "dag-api";

export default class DagServiceImpl implements DagService {

    private executor = new Executor("./temp/nodes");
    private store = StoreService.getInstance();

    constructor() {
        initProvidersPool(this.store, "./temp/providers")
    }

    async status(): Promise<{ status: string }> {
        const statistic = this.store.stats();
        return Promise.resolve({ status: "ok", db: statistic.root });
    }

    async setCodeSource(name: string, code: string): Promise<{ name: string, version: number, hash: HashString, fields: { name: string, type: string }[] }> {
        const hash = this.store.saveCode(code)
        const nodeType = await this.store.createCodeSource(name, hash);
        return Promise.resolve({ name, version: nodeType.version, hash, fields: nodeType.fields })
    }

    async getCodeSourceVersions(name: string): Promise<{ versions: CodeSource[] }> {
        return this.store.getCodeSourceVersions(name);
    }

    async createNode(codeSourceName: string, config: any): Promise<{ hash: HashString }> {
        return this.store.createNode(codeSourceName, config);
    }

    async createProvider(name: string, codeSourceName: string, config: any): Promise<{ hash: HashString }> {
        return this.store.createProvider(name, codeSourceName, config);
    }


    async setParam(name: string, value: any): Promise<{ replaced: boolean }> {
        return this.store.setParam(name, value);
    }

    async getParam(name: string): Promise<{ value: string }> {
        return this.store.getParam(name);
    }

    async codeSourceList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.listCodeSoruce() })
    }

    async getWorkflowVersions(name: string): Promise<{ versions: string[] }> {
        return Promise.resolve({ versions: this.store.getWorkflowVersions(name) });
    }

    async getNode(hash: HashString): Promise<{ config: any }> {
        return this.store.getNode(hash);
    }

    run(pid: string, workflow: HashString, command: string, params?: any): AsyncIterable<{ result: any }> {
        return this.executor.run(pid, workflow, command, params)
    }

    async getWorkflowConfig(hash: HashString): Promise<Workflow> {
        return this.store.getWorkflowConfig(hash);
    }
    async getWorkflowConfigByName(name: string, version: string): Promise<Workflow> {
        const hash = this.store.getWorkflowHash(name, version)
        return this.store.getWorkflowConfig(hash);
    }

    async workflowList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.listWorkflow() })
    }




    async providerList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.listProvider() })
    }


    runCode(nodeHash: HashString, params: any): Promise<{ result: any }> {
        return this.executor.runNode(nodeHash, params)
    }

    async startProcess(workflowId?: string, meta?: any): Promise<{ processId: string }> {
        const processId = this.generateProcessId();

        // Создаем процесс в LMDB
        this.store.createProcess(processId, workflowId, meta);

        // Создаем событие запуска
        this.store.storeEvent(processId, 'process_started', undefined, { workflowId, meta });

        // Индексируем для быстрого поиска
        await this.store.indexProcess(processId, workflowId, 'running', meta ? JSON.stringify(meta) : undefined);

        return Promise.resolve({ processId });
    }

    async createWorkflow(name: string, workflow: Workflow): Promise<{ hash: HashString }> {

        const configString = preciseStringfy(workflow);
        const hash = genHash(configString);

        // Сохраняем конфигурацию workflow
        this.store.createWorkflowConfig(hash, workflow);

        // Создаем версию workflow
        const version = new Date().getTime().toString();
        this.store.createWorkflow(name, version, hash);

        return Promise.resolve({ hash });
    }

    async createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<{ version: number }> {
        const version = new Date().getTime();

        // Сохраняем webhook в DAG
        this.store.createWebhook(name, version.toString(), url, method, workflowId, options);

        return Promise.resolve({ version });
    }

    private generateProcessId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}