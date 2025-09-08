 interface ExecutionContext {
    getFromPath(path: string): any;
    setToPath(path: string, value: any): void;
}

 type Exec = (input: any) => Promise<any>;

abstract class Lambda {
    protected lambdaId: string;
    protected input: any;
    protected exec: Exec;
    
    constructor(id: string, input: any, exec: Exec) {
        this.lambdaId = id;
        this.input = input;
        this.exec = exec;
    }
    
    abstract startOrJoin(): Promise<any>;
}

enum AspectType {
    before,
    after,   // в конце после завершения обработки
    control  // управление цикличностью и сплитом
}

interface Aspect {
    type: AspectType;
    priority: number;
    execute(worker: Worker, context: ExecutionContext): void | Promise<void>;
}

export abstract class AspectBase implements Aspect {
    type: AspectType;
    priority: number;
   abstract execute(worker: Worker, context: ExecutionContext): void | Promise<void>;

   constructor(type: AspectType, priority: number) {
       this.type = type;
       this.priority = priority;
   }
   
}



interface WorkerState {
    workerId: string;
    retry: boolean;
    input: any; // накопительный инпут который пополняется before аспектами
    executions: Lambda[];
    concurrencyLimit: number; // лимит параллельности
}

interface AspectWorker {
    readonly name: string;
    readonly state: WorkerState;
    readonly aspects: Aspect[];
    
    addAspect(aspect: Aspect): AspectWorker;
    init(context: ExecutionContext, exec: Exec): Promise<string>;
    event(eventName: string): void;
}

// Простая реализация Lambda
class ImmediateLambda extends Lambda {
    async startOrJoin(): Promise<any> {
        return await this.exec(this.input);
    }
}


export {ImmediateLambda,type AspectWorker,type WorkerState,type Aspect, AspectType,type ExecutionContext,type Exec, Lambda}