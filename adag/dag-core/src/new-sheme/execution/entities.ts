import { KVDB, PrefixKey, KeyKV, SimpleKey, HashString } from "../../../../../back/back-core/src/abstract/types";
import { BaseRepositoryKV, PrefixedRepositoryKV } from "../../../../../back/back-core/src/abstract/types";
import { generateULID } from "back-core";

// ============= EXECUTION =============
const EXECUTION_PREFIX = "execution";

class ExecutionKey extends PrefixKey implements KeyKV {
    readonly prefix = EXECUTION_PREFIX;
    
    constructor(
        private nodeHash: HashString, 
        private ulid: string, 
        private operation: string
    ) {
        super();
    }
    
    build(): string[] {
        return [this.prefix, this.nodeHash, this.ulid, this.operation];
    }
}

type ExecutionValue = any;

class ExecutionRepository extends BaseRepositoryKV<ExecutionKey, ExecutionValue> {}

export { EXECUTION_PREFIX, ExecutionKey, ExecutionValue, ExecutionRepository };

// ============= CONTEXT =============
const CONTEXT_PREFIX = "context";

class ContextKey extends PrefixKey implements KeyKV {
    readonly prefix = CONTEXT_PREFIX;
    
    constructor(
        private workflowHash: HashString, 
        private ulid: string, 
        private subkey?: string
    ) {
        super();
    }
    
    build(): string[] {
        const base = [this.prefix, this.workflowHash, this.ulid];
        return this.subkey ? [...base, this.subkey] : base;
    }
}

type ContextValue = {
    created_at: Date;
    meta?: any;
};

class ContextRepository extends PrefixedRepositoryKV<ContextKey, any> {
    getPrefix(): string[] {
        return [CONTEXT_PREFIX];
    }
}

export { CONTEXT_PREFIX, ContextKey, ContextValue, ContextRepository };

