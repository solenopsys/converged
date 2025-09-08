
import { AspectBase, AspectType, ExecutionContext, Worker } from "../abstract";


export class CopyResultAspect extends AspectBase {
 
    
    constructor(private targetPath: string  ) {

        super(AspectType.after, 999);
        
    }
    
    private getWorkerName(): string {
        return 'current'; // будет заменено на актуальное имя воркера
    }
    
    execute(worker: Worker, context: ExecutionContext): void {
        // Собираем результаты всех executions
        const results = worker.state.executions.map(lambda => (lambda as any)._lastResult);
        
        // Если одна Lambda - копируем результат напрямую
        // Если несколько - копируем как массив
        const finalResult = results.length === 1 ? results[0] : results;
        
        const actualPath = this.targetPath.replace('current', worker.name);
        context.setToPath(actualPath, finalResult);
    }
}