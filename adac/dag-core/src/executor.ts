
 import { StoreController } from "./store/controller";
import { HashString } from "../../dag-types/interface";
import fs from "fs";
import { ModuleController } from "dag-api";

export class Executor{
  modules=new Map<string,any>();
  controller: StoreController;
  moduleController:ModuleController;

  constructor(private tempDir:string){
    this.controller=StoreController.getInstance();
    this.moduleController = new ModuleController(tempDir);
   }

 
  runModule(hash:string){
    const module=this.modules.get(hash)
    if (!module) {
      throw new Error("Module not found");
    }
    return module
  }

  run(pid:string,workflow:HashString,command:string,params?:any){
    const workflowConfig=this.controller.scheme.getWorkflowConfig(workflow);
    
  }

 

  async runNode(nodeHash: string, data: any) {
    console.log("run",nodeHash,data);
   
    const node = this.controller.scheme.getNode(nodeHash);

    const nodeCode:{code_hash:string}=this.controller.scheme.getNodeCode(node.codeName,node.codeVersion);
    
    const codeHash=nodeCode.code_hash;
    const codeBody=this.controller.scheme.getCode(codeHash);
    
    // Получаем загруженный модуль
    const module =   await this.moduleController.loadAndGetModule(codeHash, codeBody);;
    
    // Создаем экземпляр класса из default export
    const NodeClass = module.default;
    if (!NodeClass) {
      throw new Error(`Module ${codeHash} does not have a default export`);
    }

   const nodeInstance:any = Reflect.construct(NodeClass, Object.values(node.config));
   const result=await nodeInstance.execute(data)
    
    // Выполняем метод execute
    return result;
  }
}