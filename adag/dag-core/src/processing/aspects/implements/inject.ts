
import { AspectBase, AspectType, ExecutionContext, Worker } from "../abstract";

export class InjectAspect extends AspectBase {
    
    constructor(private mappings: { [targetKey: string]: string }) {
        super(AspectType.before, 10);
    }
    
    execute(worker: Worker, context: ExecutionContext): void {
        const injected = { ...worker.state.input };
        
        for (const [targetKey, sourcePath] of Object.entries(this.mappings)) {
            const value = context.getFromPath(sourcePath);
            injected[targetKey] = value;
        }
        console.log("INJECTED", injected);
        worker.state.input = injected;
    }
}