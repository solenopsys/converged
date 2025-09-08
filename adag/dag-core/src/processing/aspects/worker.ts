import { timeVersion } from "@/store/utils/utils";
import { Aspect, AspectType, Exec, ExecutionContext, AspectWorker, WorkerState } from "./abstract";
import { Semaphore } from "./utils";


export class WorkerImpl implements AspectWorker {
    readonly name: string;
    readonly state: WorkerState;
    readonly aspects: Aspect[];

    private _originalExec?: Exec;
    private _context!: ExecutionContext;
    private endNode: (cascade: boolean) => void;

    constructor(name: string, aspects: Aspect[] = []) {
        this.name = name;
        this.state = {
            workerId: `worker-${name}-${Date.now()}`,
            retry: false,
            input: {},
            executions: [],
            concurrencyLimit: 1
        };
        this.aspects = [...aspects];
    }

    addAspect(aspect: Aspect): AspectWorker {
        return new WorkerImpl(this.name, [...this.aspects, aspect]);
    }

    async init(context: ExecutionContext, exec: Exec): Promise<{ result: string, cascade: boolean }> {
        this._originalExec = exec;
        this._context = context;


        return new Promise((resolve, reject) => {
            this.endNode = (cascade: boolean) => { resolve({ result: "ok", cascade:cascade }) }
        });
    }

    async activate(cascade: boolean) {
        try {
            do {
                this.state.retry = false;

                // Сортируем аспекты по типу и приоритету
                const sortedAspects = [...this.aspects].sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type - b.type; // before < after < control
                    }
                    return a.priority - b.priority;
                });

                // Выполняем аспекты по типам
                await this.executeAspectsByType(sortedAspects, AspectType.before, this._context);
                await this.executeAspectsByType(sortedAspects, AspectType.control, this._context);

                // Выполняем Lambda
                await this.executeLambdas();


                await this.executeAspectsByType(sortedAspects, AspectType.after, this._context);
                this.endNode(cascade)

            } while (this.state.retry);



        } catch (error) {
            console.error(`Worker ${this.name} failed:`, error);

        }
    }



    private async executeAspectsByType(
        sortedAspects: Aspect[],
        type: AspectType,
        context: ExecutionContext
    ): Promise<void> {
        const aspectsOfType = sortedAspects.filter(a => a.type === type);

        for (const aspect of aspectsOfType) {
            await aspect.execute(this, context);
        }
    }

    private async executeLambdas(): Promise<void> {
        if (this.state.executions.length === 0) return;

        // Выполняем с учетом concurrencyLimit
        const semaphore = new Semaphore(this.state.concurrencyLimit);

        const promises = this.state.executions.map(async (lambda) => {
            await semaphore.acquire();
            try {
                const result = await lambda.startOrJoin();
                (lambda as any)._lastResult = result;
                return result;
            } finally {
                semaphore.release();
            }
        });

        await Promise.all(promises);
    }

}

