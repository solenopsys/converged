
import { AspectBase, AspectType, ExecutionContext, Worker } from "../abstract";


export class CopyResultAspect extends AspectBase {
 
    
    constructor(private targetPath: string  ) {

        super(AspectType.after, 999);
        
    }
    
 
    execute(worker: Worker, context: ExecutionContext): void {
        // Собираем результаты всех executions
        const results = worker.state.executions.map(lambda => (lambda as any)._lastResult);
        
     
        const finalResult = results.length === 1 ? results[0] : results;
         
        console.log("COPY RESULT", worker.name, finalResult);
        context.setToPath(worker.name, finalResult);
    }
}