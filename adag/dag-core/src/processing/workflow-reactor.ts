

import { StoreController } from "../store/controller";
import { WorkerImpl } from "./aspects/worker";
import { AspectsMapping } from "./aspects/maping";
import { AspectWorker, AspectBase } from "./aspects/abstract";
import { createLambdaByNodeKey } from "./lambda-executor";
import { JsonPathExecutionContext } from "./aspects/utils";


const defaultAspects = ["init", "output"]

export class WorflowReactor {
    workers: { [event: string]: AspectWorker } = {}
    links: { [event: string]: string | string[] } = {}


    constructor(contextKey: string) {
        this.init(contextKey)
    }

     createAspectInstance(key: string, config?: any): AspectBase | null {
        const AspectClass = AspectsMapping[key];
        if (!AspectClass) {
            console.warn(`Aspect with key "${key}" not found in AspectsMapping`);
            return null;
        }
        
        try {
            return config !== undefined ? new AspectClass(config) : new AspectClass();
        } catch (error) {
            console.error(`Failed to create aspect "${key}":`, error);
            return null;
        }
     }

     createAspectForNode(workflow: {[node: string]: any}, nodeName: string): AspectBase[] {
        const nodeAspectsConfigs: { [node: string]: any } = workflow.aspects ?? {};
        const aspects: AspectBase[] = [];
        const aspectsConfig: { [key: string]: any } = nodeAspectsConfigs[nodeName] ?? {}; // Add null coalescing here

        if (!aspectsConfig){
               return [];
        }          
        // Добавляем аспекты по умолчанию (которых нет в конфигурации)
        defaultAspects.forEach(key => {                        
            const aspect = this.createAspectInstance(key);
            if (aspect) {
                aspects.push(aspect);
            }
        });
                 
        // Добавляем настроенные аспекты
        Object.keys(aspectsConfig).forEach(key => {
            const aspect = this.createAspectInstance(key, aspectsConfig[key]);
            if (aspect) {
                aspects.push(aspect);
            }
        });
        return aspects;
    }

     createWorker(workflow:{[node: string]: any},nodeName:string,nodePath:string,ctx:JsonPathExecutionContext):AspectWorker{
        const aspects=this.createAspectForNode(workflow,nodeName)
        const worker=new WorkerImpl(nodeName,aspects)
        const context={};

        const lambda=createLambdaByNodeKey(nodePath,"./temp/nodes");
   
        worker.init(ctx,async ()=>await lambda.execute(context))
        return worker
     }
     
     async init(contextKey: string) {
        const ctx=new  JsonPathExecutionContext({});
        console.log("WORKFLOW", contextKey)
        const store = StoreController.getInstance()
        const workflowHash = contextKey.split(":")[1]
        const workflow = await store.scheme.workflow.getWorkflowConfig(workflowHash)
        //@ts-ignore
        this.links=workflow.links;
        console.log(workflow)
        const nodes=Object.keys(workflow.nodes);
        nodes.forEach(nodeName => {
            this.workers[nodeName] = this.createWorker(workflow,nodeName,workflow.nodes[nodeName],ctx)
        })
        
     
 
    
       
    }

    processResult(event: string, result: ResultType) {
        if (result == ResultType.ok) {

            this.react(event)
        }
    }

    react(event: string) {
        const workersNames: string | string[] = this.links[event];
        if (workersNames is array){

        }

        workersNames.forEach(name => {
           const worker: AspectWorker= workers[name];
            this.processResult(worker.name, await worker.run())
        });
        
 
    }
}