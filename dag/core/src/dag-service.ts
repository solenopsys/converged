import { Base64, type DagService } from "../../types/interface";
import { Hash, HashString } from "../../types/interface";
import { StoreService } from "./store/store";
import { toHex } from "./tools";
import { Executor } from "./executor";
import { genHash } from "./tools";
import { preciseStringfy } from "./tools";

export default class DagServiceImpl implements DagService {

    private executor = new Executor("./temp");
    private store = StoreService.getInstance();

    async status(): Promise<{ status: string }> {
        const statistic = this.store.stats();
        return Promise.resolve({ status: "ok", db: statistic.root });
    }

    async setCode(name: string, code: string): Promise<{ name: string, version: number, hash: HashString, fields: { name: string, type: string }[] }> {
        const hash = this.store.saveCode(code)
        const nodeType = await this.store.createNodeCode(name, hash);
        return Promise.resolve({ name, version: nodeType.version, hash, fields: nodeType.fields })
    }

    async codeList(): Promise<{ names: string[] }> {
        return Promise.resolve({ names: this.store.listNodeCode() })
    }

    async createNode(nodeCode: string, config: any): Promise<{ hash: HashString }> {
        return this.store.createNode(nodeCode, config);
    }

    runCode(nodeHash: HashString, params: any): Promise<{ result: any }> {
        return this.executor.run(nodeHash, params)
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

    async createWorkflow(name: string, nodes: HashString[], links: { from: string, to: string }[], description?: string): Promise<{ hash: HashString }> {
        // Создаем конфигурацию workflow
        const config = {
            nodes,
            links,
            description
        };
        
        const configString = preciseStringfy(config);
        const hash = genHash(configString);
        
        // Сохраняем конфигурацию workflow
        this.store.createWorkflowConfig(hash, nodes, links, description);
        
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