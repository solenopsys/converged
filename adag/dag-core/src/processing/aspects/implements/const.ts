

import { AspectBase, AspectType, type ExecutionContext, type Worker } from "../abstract";


export class ConstAspect extends AspectBase {

    constructor(private constants: { [key: string]: any }) {
        super(AspectType.before, 20);
    }

    execute(worker: Worker, context: ExecutionContext): void {
        worker.state.input = { ...worker.state.input, ...this.constants };
    }
}