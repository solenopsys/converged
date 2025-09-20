import { LMWrapper } from "back-core";
import { StringHash } from "dag-api";
import { EntityAcessor } from "back-core";
import { generateULID } from "back-core";

const CONTEXT = "context";
const EXECUTION = "execution";

export class ExecutionAccessor extends EntityAcessor<ProcessingStore> {
    start(nodeHash: StringHash, data?: any): string {
        const key = this.db.put([EXECUTION, nodeHash, generateULID(),"start"], data);
        return key;
    }

    end(key: string, data?: any) {
        return this.db.put([key, "end"], data);
    }

    error(key: string, error: { code: number, message: string }) {
        return this.db.put([key, "error"], error);
    }

}



export class ContextAccessor extends EntityAcessor<ProcessingStore> { // source codes 
    createContext(workflowHash: StringHash, meta?: any): string {
        const key = this.db.put([CONTEXT, workflowHash, generateULID()], {
            created_at: new Date(),
            meta
        });
        return key;
    }

    addDataToContext(contextKey: string, key: string, value: any) {
        this.db.put([contextKey, key], value);
    }

    getContext(contextKey: string): any {
        return this.db.getVeluesRangeAsObjectWithPrefix(contextKey);
    }
}


export class ProcessingStore {
    private db: LMWrapper;
    public readonly executions: ExecutionAccessor;
    public readonly contexts: ContextAccessor;

    private constructor(dataDir: string) {
        this.db = new LMWrapper(dataDir, 'processing');
        this.executions = new ExecutionAccessor(this.db, this);
        this.contexts = new ContextAccessor(this.db, this);
    }

    deinit() {
        this.db.close();
    }

}