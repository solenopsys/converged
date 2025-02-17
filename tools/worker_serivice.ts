
import { externalToConf,externalsLoad } from "./external_tool.ts";
type ImportMap = {
    imports?: Record<string, string>;
    scopes?: Record<string, Record<string, string>>;
  };


type ImportMapConfig = {
    config: Record<string, string>;
    importmap: ImportMap;
};



export default class WorkersService {
   private tasks: Map<string, (result: any) => void>;
   private worker: Worker;
   private timeoutDuration: number;
   public readonly  defaultExternal: Record<string, string> = { };

   constructor(worker: Worker, timeoutDuration: number = 30000) {
       this.tasks = new Map();
       this.worker = worker;
       this.timeoutDuration = timeoutDuration;
       
       this.initializeWorker();
   }

   addDefaultExternal(external: string, version  = "latest") {
       this.defaultExternal[external] = version;
   }

   private initializeWorker(): void {
       this.worker.onerror = (error) => {
           console.error('Worker error:', error);
       };

       this.worker.onmessage = (event) => {
           console.log('Received message from worker:', event.data);
           const { taskId, success, ...result } = event.data;
           const taskResolver = this.tasks.get(taskId);
           
           if (taskResolver) {
               taskResolver({ success, ...result });
               this.tasks.delete(taskId);
           }
       };
   }

   private generateTaskId(): string {
       return Math.random().toString(36).slice(8);
   }


  

   public async runBuildTask(packDir: string, externals:string[]): Promise<any> {
       const taskId = this.generateTaskId();
       console.log('Generated taskId:', taskId);
       
       const taskPromise = new Promise((resolve, reject) => {
           const timeout = setTimeout(() => {
               this.tasks.delete(taskId);
               reject(new Error(`Build task timeout after ${this.timeoutDuration}ms`));
           }, this.timeoutDuration);

           this.tasks.set(taskId, (result) => {
               clearTimeout(timeout);
               resolve(result);
           });
       });

       console.log('Sending message to worker...');

     
       const dirName=packDir.split("/").pop();
   

      
 
     
       this.worker.postMessage({
           taskId,
           name: dirName,
           entryPoint: `${packDir}/src/index.ts`,
           outPutPath: "./cache/temp",
           externals
       });

       try {
           const result = await taskPromise;
           console.log('Task completed successfully');
           return result;
       } catch (error) {
           console.error('Build failed:', error);
           throw error;
       }
   }

   public terminate(): void {
       this.worker.terminate();
   }
}

 