
import { type INode } from "../types/interface";
import { StoreService } from "./store/store";
import fs from "fs";

export class Executor{
  modules=new Map<string,any>();

  constructor(private tempDir:string){
   }

  async loadModule(hash:string,path:string){ 
   
   this.modules.set(hash,await import(path))
  }

  runModule(hash:string){
    const module=this.modules.get(hash)
    if (!module) {
      throw new Error("Module not found");
    }
    return module
  }

  async run(nodeHash: string, params: any) {
    const node = StoreService.getInstance().getNode(nodeHash);
    const codeHash=node.codeHash;
    const codeBody=StoreService.getInstance().getCode(codeHash);

    console.log("node" ,node)
    const path=this.tempDir+"/"+codeHash+".ts";
    const absolutePath=process.cwd()+"/"+path;
    fs.writeFileSync(absolutePath,codeBody);


    // Загружаем модуль если он еще не загружен
    await this.loadModule(codeHash,absolutePath);
    
    // Получаем загруженный модуль
    const module = this.runModule(codeHash);
    
    // Создаем экземпляр класса из default export
    const NodeClass = module.default;
    if (!NodeClass) {
      throw new Error(`Module ${codeHash} does not have a default export`);
    }
    
    // Создаем экземпляр с именем узла (можно передать hash или другое имя)
    const nodeInstance: INode = new NodeClass(...node.config);
    
    // Выполняем метод execute
    return await nodeInstance.execute(params);
  }
}