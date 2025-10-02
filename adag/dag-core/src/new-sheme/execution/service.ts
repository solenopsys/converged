import { KVDB, PrefixKey, KeyKV, SimpleKey, HashString } from "../../../../../back/back-core/src/abstract/types";
import { BaseRepositoryKV, PrefixedRepositoryKV } from "../../../../../back/back-core/src/abstract/types";
import { generateULID } from "back-core";
import { ExecutionRepository } from "./entities";
import { ContextRepository } from "./entities";
import { ExecutionKey } from "./entities";
import { ContextKey } from "./entities";
import { EXECUTION_PREFIX, CONTEXT_PREFIX, ContextValue } from "./entities";
import { HashString } from "../../../../../back/back-core/src/abstract/types";

export class ProcessingService {
    public readonly executionRepo: ExecutionRepository;
    public readonly contextRepo: ContextRepository;

    constructor(db: KVDB) {
        this.executionRepo = new ExecutionRepository(db);
        this.contextRepo = new ContextRepository(db);
    }

    startExecution(nodeHash: HashString, data?: any): string {
        const ulid = generateULID();
        const key = new ExecutionKey(nodeHash, ulid, "start");
        return this.executionRepo.save(key, data);
     }

    endExecution(node: string, ulid: string, data?: any): string {
        const key = new ExecutionKey(node, ulid, "end");
        return this.executionRepo.save(key, data);
    }

    errorExecution(node: string, ulid: string, error: { code: number; message: string }): string {
        const key = new ExecutionKey(node, ulid, "error");
        return this.executionRepo.save(key, error);
    }

    createContext(workflowHash: HashString, meta?: any): string {
        const ulid = generateULID();
        const key = new ContextKey(workflowHash, ulid);
        const value: ContextValue = {
            created_at: new Date(),
            meta
        };
        return this.contextRepo.save(key, value);
    }

    addDataToContext(contextKeyStr: string, dataKey: string, value: any): string {
        const parts = contextKeyStr.split(':');
        const key = new ContextKey(parts[1], parts[2], dataKey);
        return this.contextRepo.save(key, value);
    }

    getContext(contextKeyStr: string): any {
        const parts = contextKeyStr.split(':');
        const key = new ContextKey(parts[1], parts[2]);
        return this.contextRepo.get(key);
    }

    listContexts(): string[] {
        return this.contextRepo.listKeys();
    }
}