import {
    BaseRepositoryKV,
    VersionsRepository,
    KVStore,
    timeVersion,
    extractCommentParam,
    genHash,
    preciseStringfy,
} from "back-core";
import type { HashString, Workflow, CodeSource } from "../../../dag-types/interface";
import type { ProvidersStore } from "dag-api";
import {
    CodeHashKey,
    CodeSourceKey,
    NodeConfigKey,
    NodeKey,
    ProviderKey,
    WorkflowConfigKey,
    WorkflowKey,
    ParamKey,
    WebhookKey,
} from "./keys";
import type {
    CodeEntity,
    NodeConfigEntity,
    ProviderEntity,
    WorkflowConfigEntity,
    WorkflowRefEntity,
    WebhookEntity,
} from "./entities";

// ==================== CODE SOURCE REPOSITORY ====================

export class CodeRepository extends VersionsRepository<CodeSourceKey, CodeEntity> {
    getPrefix(): string[] {
        return ["code_source"];
    }

    saveCode(body: string): HashString {
        const hashString = genHash(body);
        this.db.put(new CodeHashKey(hashString).build(), body);
        return hashString;
    }

    getCode(hashString: string): string {
        return this.db.get(new CodeHashKey(hashString).build());
    }

    listCodeSource(): string[] {
        return this.listKeys();
    }

    listCodeSourceReach(): { id: string; name: string }[] {
        return this.listKeys().map((name) => ({ id: name, name }));
    }

    getCodeSource(name: string, version: string): { code_hash: string } {
        return this.get(new CodeSourceKey(name, version));
    }

    createCodeSource(
        name: string,
        hash: HashString,
    ): { version: string; fields: { name: string; type: string }[] } {
        const code = this.getCode(hash);
        if (code === undefined) {
            throw new Error("Code not found");
        }

        const version = timeVersion();
        const constructorParams = extractCommentParam(code);
        const struct: CodeEntity = {
            code_hash: hash,
            params: constructorParams,
            extractKey: () => ({ name, version }),
        };

        this.save(new CodeSourceKey(name, version), struct);
        return { version, fields: constructorParams };
    }

    getCodeSourceVersions(name: string): { versions: CodeSource[] } {
        const versions: CodeSource[] = this.getVersions(name).map((entity) => {
            const key = entity.extractKey();
            return {
                name: key.name,
                version: key.version,
                hash: entity.code_hash,
                fields: entity.params,
            };
        });
        return { versions };
    }
}

// ==================== WORKFLOW REPOSITORY ====================

export class WorkflowRepository extends VersionsRepository<
    WorkflowKey,
    WorkflowRefEntity
> {
    getPrefix(): string[] {
        return ["workflow"];
    }

    listWorkflowReach(): { id: string; name: string }[] {
        return this.listKeys().map((name) => ({ id: name, name }));
    }

    listWorkflow(): string[] {
        return this.listKeys();
    }

    getWorkflowVersions(name: string): string[] {
        return this.getVersionsKeys(name).map((key) => key.split(":")[2]);
    }

    createWorkflowConfig(hash: string, workflow: Workflow): void {
        const entity: WorkflowConfigEntity = {
            workflow,
            extractKey: () => hash,
        };
        this.db.put(new WorkflowConfigKey(hash).build(), entity);
    }

    getWorkflowConfig(hash: string): Workflow {
        const entity = this.db.get(new WorkflowConfigKey(hash).build()) as WorkflowConfigEntity;
        return entity.workflow;
    }

    createWorkflow(name: string, version: string, workflowVersionHash: string): void {
        const entity: WorkflowRefEntity = {
            workflow_version_hash: workflowVersionHash,
            extractKey: () => ({ name, version }),
        };
        this.save(new WorkflowKey(name, version), entity);
    }

    getWorkflowHash(name: string, version: string): HashString {
        const entity = this.get(new WorkflowKey(name, version));
        return entity.workflow_version_hash;
    }
}

// ==================== PROVIDER REPOSITORY ====================

export class ProviderRepository
    extends BaseRepositoryKV<ProviderKey, ProviderEntity>
    implements ProvidersStore
{
    constructor(db: KVStore, private codeRepo: CodeRepository) {
        super(db);
    }

    createProvider(
        name: string,
        providerCodeName: string,
        config: any,
    ): { name: string } {
        const providerCodeVersion = this.codeRepo.getLastVersion(providerCodeName);
        const entity: ProviderEntity = {
            config,
            codeName: providerCodeName,
            codeVersion: providerCodeVersion,
            extractKey: () => name,
        };

        this.save(new ProviderKey(name), entity);
        return { name };
    }

    listProvider(): string[] {
        return this.store.listKeys(["provider"]);
    }

    getProvider(name: string): { hash: string; code: string; config: any } {
        const data = this.get(new ProviderKey(name));
        const { code_hash } = this.codeRepo.getCodeSource(data.codeName, data.codeVersion);
        const code = this.codeRepo.getCode(code_hash);
        return { hash: code_hash, code, config: data.config };
    }

    providerExists(name: string): boolean {
        const exists = this.get(new ProviderKey(name));
        return exists !== undefined;
    }
}

// ==================== NODE REPOSITORY ====================

export class NodeRepository extends VersionsRepository<NodeKey, string> {
    constructor(db: KVStore, private codeRepo: CodeRepository) {
        super(db);
    }

    getPrefix(): string[] {
        return ["node"];
    }

    getNodeConfig(hashString: string): NodeConfigEntity {
        return this.db.get(new NodeConfigKey(hashString).build()) as NodeConfigEntity;
    }

    getNode(nodeName: string): string {
        const lastVersion = this.getLastVersion(nodeName);
        return this.get(new NodeKey(nodeName, lastVersion));
    }

    getNodeByKey(key: string): string {
        return this.db.getDirect(key);
    }

    listNodes(): string[] {
        return this.listKeys();
    }

    createNodeConfig(nodeCodeName: string, config: any): { hash: HashString } {
        const nodeCodeVersion = this.codeRepo.getLastVersion(nodeCodeName);
        const struct: NodeConfigEntity = {
            config,
            codeName: nodeCodeName,
            codeVersion: nodeCodeVersion,
            extractKey: () => "",
        };
        const configString = preciseStringfy(struct);
        const hashString = genHash(configString) as HashString;

        this.db.put(new NodeConfigKey(hashString).build(), struct);
        return { hash: hashString };
    }

    createNode(nodeName: string, nodeConfigHash: any): string {
        const version = timeVersion();
        return this.store.put(new NodeKey(nodeName, version).build(), nodeConfigHash);
    }
}

// ==================== PARAM REPOSITORY ====================

export class ParamRepository extends BaseRepositoryKV<ParamKey, string> {
    setParam(name: string, value: string): { replaced: boolean } {
        const exists = this.get(new ParamKey(name));
        this.save(new ParamKey(name), value);
        return { replaced: exists !== undefined };
    }

    getParam(name: string): { value: string } {
        return this.get(new ParamKey(name));
    }

    listParams(): { [name: string]: string } {
        return this.db.getVeluesRangeAsObjectWithPrefix("param");
    }
}

// ==================== WEBHOOK REPOSITORY ====================

export class WebhookRepository extends VersionsRepository<WebhookKey, WebhookEntity> {
    getPrefix(): string[] {
        return ["webhook"];
    }

    createWebhook(
        name: string,
        version: string,
        url: string,
        method: string,
        workflowId: string,
        options?: any,
    ): void {
        const entity: WebhookEntity = {
            url,
            method,
            workflow_id: workflowId,
            options,
            extractKey: () => ({ name, version }),
        };
        this.save(new WebhookKey(name, version), entity);
    }

    getWebhook(name: string, version: string): WebhookEntity {
        return this.get(new WebhookKey(name, version));
    }
}
