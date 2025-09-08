
import { AspectBase, AspectType, ExecutionContext, Worker, Exec } from "../abstract";
import { ImmediateLambda } from "../abstract";

 

export class InitLambdaAspect extends AspectBase {
    constructor() {
        super(AspectType.control, 0);
    }
    execute(worker: Worker, context: ExecutionContext): void {
        if (worker.state.executions.length === 0) {
            // Создаем дефолтную Lambda если executions пуст
            const lambda = new ImmediateLambda(
                `${worker.state.workerId}-default`,
                worker.state.input,
                async (input) => {
                    // Получаем исходный exec из контекста воркера
                    const exec = (worker as any)._originalExec as Exec;
                    return await exec(input);
                }
            );
            worker.state.executions.push(lambda);
        }
    }
}
