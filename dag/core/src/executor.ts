
import { type INode } from "dag-api";
import { StoreService } from "./store/sheme.store";
import { HashString } from "../../types/interface";
import fs from "fs";
import { ModuleController } from "dag-api";

export class Executor{
  modules=new Map<string,any>();

  moduleController:ModuleController;

  constructor(private tempDir:string){
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
    
  }

  async runNode(nodeHash: string, data: any) {
    console.log("run",nodeHash,data);
    const node = StoreService.getInstance().getNode(nodeHash);

    const nodeCode:{code_hash:string}=StoreService.getInstance().getNodeCode(node.codeName,node.codeVersion);
    
    const codeHash=nodeCode.code_hash;
    const codeBody=StoreService.getInstance().getCode(codeHash);
    
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