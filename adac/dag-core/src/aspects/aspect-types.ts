

export type AspectResult={
    execute:boolean,
    next:boolean,
    params:any
}

export type ExecutionContext={
    getFromPath(path:string):any
    setToPath(path:string,value:any):void
}

export interface NodeAspect {
    after(ctx: ExecutionContext): AspectResult 
    before(ctx: ExecutionContext): AspectResult 
}

 
export class NodeAspectBase implements NodeAspect {
    after(ctx: ExecutionContext): AspectResult {
        return { execute: true, next: true, params: {} };
    }
    before(ctx: ExecutionContext): AspectResult {
        return { execute: true, next: true, params: {} };
    }
}