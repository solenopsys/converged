import { KVStore } from "back-core";
import {
    CodeRepository,
    WorkflowRepository,
    ProviderRepository,
    NodeRepository,
    ParamRepository,
    WebhookRepository,
} from "./repositories";

export class SchemeStore {
    public readonly code: CodeRepository;
    public readonly workflow: WorkflowRepository;
    public readonly provider: ProviderRepository;
    public readonly node: NodeRepository;
    public readonly param: ParamRepository;
    public readonly webhook: WebhookRepository;

    constructor(private kvStore: KVStore) {
        this.code = new CodeRepository(kvStore);
        this.workflow = new WorkflowRepository(kvStore);
        this.provider = new ProviderRepository(kvStore, this.code);
        this.node = new NodeRepository(kvStore, this.code);
        this.param = new ParamRepository(kvStore);
        this.webhook = new WebhookRepository(kvStore);
    }

    stats(): any {
        return this.kvStore.getStats();
    }

    async close() {
        await this.kvStore.close();
    }
}
