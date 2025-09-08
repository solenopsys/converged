import { StoreController } from "../store/controller";
import { ModuleController } from "dag-api";

export class LambdaExecutor {
  private nodeInstance: any;
  private controller: StoreController;
  private moduleController: ModuleController;

  constructor(private nodeHash: string,  tempDir: string) {
    this.controller = StoreController.getInstance();
    this.moduleController = new ModuleController(tempDir);
  
  }

  public async initializeNode() {
    const nodeConfig = this.controller.scheme.node.getNodeConfig(this.nodeHash);
    console.log("nodeConfig", nodeConfig);

    const nodeCode: { code_hash: string } = this.controller.scheme.code.getCodeSource(
      nodeConfig.codeName, 
      nodeConfig.codeVersion
    );

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
      
      return value;
    });

    console.log("paramKeys", paramKeys);
    console.log("processedValues", processedValues);

    // Создаем экземпляр с параметрами в правильном порядке
    this.nodeInstance = Reflect.construct(NodeClass, processedValues);
  }

  async execute(data: any) {
    console.log("run", this.nodeHash, data);
    return await this.nodeInstance.execute(data);
  }
}

// Отдельная функция для запуска по имени
export async function runLambda(name: string, data: any, tempDir: string) {
  const controller = StoreController.getInstance();
  const nodeHash = controller.scheme.node.getNode(name);
  
  const executor = new LambdaExecutor(nodeHash, tempDir);
  await executor.initializeNode();
  return await executor.execute(data);
}

export async function createLambdaByNodeKey(nodeKey:string,tempDir:string){
    const controller = StoreController.getInstance();
    const nodeHash = controller.scheme.node.getNodeByKey(nodeKey);
    console.log("nodeHash", nodeHash);
    const executor = new LambdaExecutor(nodeHash, tempDir);
    await executor.initializeNode();
    return executor;
}
