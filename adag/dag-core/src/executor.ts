
import { StoreController } from "./store/controller";
import { HashString } from "../../dag-types/interface";
import fs from "fs";
import { ModuleController } from "dag-api";

export class Executor {
  modules = new Map<string, any>();
  controller: StoreController;
  moduleController: ModuleController;

  constructor(private tempDir: string) {
    this.controller = StoreController.getInstance();
    this.moduleController = new ModuleController(tempDir);
  }


  runModule(hash: string) {
    const module = this.modules.get(hash)
    if (!module) {
      throw new Error("Module not found");
    }
    return module
  }

  run(pid: string, workflow: HashString, command: string, params?: any) {
    const workflowConfig = this.controller.scheme.getWorkflowConfig(workflow);


  }

  async runLambda(name: string, data: any) {
    const nodeHash = this.controller.scheme.node.getNode(name);
    return await this.runNodeConfig(nodeHash, data);
  }

  async runNodeConfig(nodeHash: string, data: any) {
    console.log("run", nodeHash, data);
  
    const nodeConfig = this.controller.scheme.node.getNodeConfig(nodeHash);
    console.log("nodeConfig", nodeConfig);
  
    const nodeCode: { code_hash: string } = this.controller.scheme.code.getCodeSource(nodeConfig.codeName, nodeConfig.codeVersion);
  
    const codeHash = nodeCode.code_hash;
    const codeBody = this.controller.scheme.code.getCode(codeHash);
  
    // Получаем загруженный модуль
    const module = await this.moduleController.loadAndGetModule(codeHash, codeBody);
  
    // Создаем экземпляр класса из default export
    const NodeClass = module.default;
    if (!NodeClass) {
      throw new Error(`Module ${codeHash} does not have a default export`);
    }
  
    const params = nodeConfig.config;
  
    // Создаем массив ключей в исходном порядке
    const paramKeys = Object.keys(params);
    
    // Обрабатываем параметры, сохраняя порядок
    const processedValues = paramKeys.map(key => {
      let value = params[key];
      
      // Обрабатываем параметры со ссылками
      if (value && typeof value === 'string' && value.startsWith("$")) {
        value = this.controller.scheme.param.getParam(value.slice(1));
      }
      
      return value; // Возвращаем значение даже если оно null/undefined
    });
  
    console.log("paramKeys", paramKeys);
    console.log("processedValues", processedValues);
  
    // Создаем экземпляр с параметрами в правильном порядке
    const nodeInstance: any = Reflect.construct(NodeClass, processedValues);
    const result = await nodeInstance.execute(data);
  
    return result;
  }
}