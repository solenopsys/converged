import { StoreController } from "../controller";
import { getNodeDefinition } from "../nodes";

export class LambdaExecutor {
  private nodeInstance: any;
  private controller!: StoreController;

  constructor(
    private nodeHash: string,
    tempDir: string,
  ) {
  }

  public async initializeNode() {
    this.controller = await StoreController.getInstance();
    const nodeConfig = this.controller.registry.getNodeConfig(this.nodeHash);
    const definition = getNodeDefinition(nodeConfig.codeName);
    if (!definition) {
      throw new Error(`Node not found: ${nodeConfig.codeName}`);
    }

    const NodeClass = definition.ctor;

    const params = nodeConfig.config;

    // Используем порядок параметров из определения узла
    const paramKeys =
      definition.params?.length > 0
        ? definition.params.map((param) => param.name)
        : Object.keys(params ?? {});

    // Обрабатываем параметры, сохраняя порядок
    const processedValues = paramKeys.map((key) => {
      let value = params?.[key];

      // Обрабатываем параметры со ссылками
      if (value && typeof value === "string" && value.startsWith("$")) {
        value = this.controller.registry.getParam(value.slice(1));
      }

      return value;
    });

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
  const controller = await StoreController.getInstance();
  const nodeHash = controller.registry.getNode(name);

  const executor = new LambdaExecutor(nodeHash, tempDir);
  await executor.initializeNode();
  return await executor.execute(data);
}

export async function createLambdaByNodeKey(nodeKey: string, tempDir: string) {
  const controller = await StoreController.getInstance();
  const nodeHash = controller.registry.getNodeByKey(nodeKey);
  console.log("nodeHash", nodeHash);
  const executor = new LambdaExecutor(nodeHash, tempDir);
  await executor.initializeNode();
  return executor;
}
