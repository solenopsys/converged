import { StoreController } from "../store/controller";
import { WorkerImpl } from "./aspects/worker";
import { AspectsMapping } from "./aspects/maping";
import { AspectWorker, AspectBase } from "./aspects/abstract";
import { createLambdaByNodeKey } from "./lambda-executor";
import { StoreExecutionContext } from "./aspects/utils";
import { ExecutionContext } from "./aspects/abstract";

// Определяем тип для результата
export enum ResultType {
  ok = "ok",
  error = "error",
  pending = "pending",
}

const END = "end";
const START = "start";

export class WorkflowReactor {
  workers: { [event: string]: AspectWorker } = {};
  cascade: { [event: string]: string[] } = {};
  private isInitialized = false;
  private ctx: ExecutionContext; // Сохраняем контекст как поле класса

  private defaultAspects = ["init", "output"]; // todo config

  constructor(private contextKey: string) {
    if (!this.contextKey) {
      throw new Error("Context key is required");
    }
    const store = StoreController.getInstance();
    this.ctx = new StoreExecutionContext(
      store.processing.contexts,
      this.contextKey,
    ); // Инициализируем контекст
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

  createAspectForNode(
    workflow: { [node: string]: any },
    nodeName: string,
  ): AspectBase[] {
    const nodeAspectsConfigs: { [node: string]: any } = workflow.aspects ?? {};
    const aspects: AspectBase[] = [];
    const aspectsConfig: { [key: string]: any } =
      nodeAspectsConfigs[nodeName] ?? {};

    // Добавляем аспекты по умолчанию (которых нет в конфигурации)
    this.defaultAspects.forEach((key) => {
      // Проверяем, что аспект не настроен вручную
      if (!aspectsConfig.hasOwnProperty(key)) {
        const aspect = this.createAspectInstance(key);
        if (aspect) {
          aspects.push(aspect);
        }
      }
    });

    // Добавляем настроенные аспекты
    Object.keys(aspectsConfig).forEach((key) => {
      const aspect = this.createAspectInstance(key, aspectsConfig[key]);
      if (aspect) {
        aspects.push(aspect);
      }
    });

    return aspects;
  }

  async createWorker(
    workflow: { [node: string]: any },
    nodeName: string,
    nodePath: string,
    ctx: ExecutionContext,
  ): Promise<AspectWorker> {
    const aspects = this.createAspectForNode(workflow, nodeName);
    const worker = new WorkerImpl(nodeName, aspects);
    const context = {};

    const lambda = await createLambdaByNodeKey(nodePath, "./temp/nodes");

    const promise = worker.init(
      ctx,
      async (input) => await lambda.execute(input),
    );

    // Обрабатываем промис для генерации события
    promise
      .then((res) => {
        if (res.result == ResultType.ok) {
          if (res.cascade) {
            this.react(nodeName + ":" + END, true);
          }
        } else {
          console.error(`Worker "${nodeName}" failed:`, res);
        }
      })
      .catch((error) => {
        console.error(`Worker "${nodeName}" failed:`, error);
        // this.react(nodeName + ":" + END, ResultType.error, true);
      });

    return worker;
  }

  async init(): Promise<void> {
    try {
      console.log("WORKFLOW", this.contextKey);

      const store = await StoreController.getInstance();
      const workflowHash = this.contextKey.split(":")[1];
      const workflow =
        await store.scheme.workflow.getWorkflowConfig(workflowHash);

      if (!workflow) {
        throw new Error(`Workflow with hash ${workflowHash} not found`);
      }

      // Построение каскадных связей
      for (const eventKey of Object.keys(workflow.links)) {
        const item = workflow.links[eventKey];
        let itemArray: string[] = [];

        if (Array.isArray(item)) {
          itemArray = item.map((i) => i + ":" + START);
        } else {
          itemArray.push(item + ":" + START); // Исправлено: START вместо END
        }

        this.cascade[eventKey + ":" + END] = itemArray;
      }

      console.log("Loaded workflow:", workflow);
      console.log("Cascade structure:", this.cascade);

      const nodes = Object.keys(workflow.nodes || {});

      // Создаем воркеров для каждого узла
      for (const nodeName of nodes) {
        const nodeKey = nodeName + ":" + START;
        try {
          this.workers[nodeKey] = await this.createWorker(
            workflow,
            nodeName,
            workflow.nodes[nodeName],
            this.ctx,
          );
        } catch (error) {
          console.error(
            `Failed to create worker for node "${nodeKey}":`,
            error,
          );
        }
      }

      this.isInitialized = true;
      console.log("WorkflowReactor initialized successfully");
    } catch (error) {
      console.error("Failed to initialize WorkflowReactor:", error);
      throw error;
    }

    console.log("KEYS OBJECT", Object.keys(this.workers));
  }

  react(endedEvent: string, cascade: boolean): void {
    console.log(`Reacting to event "${endedEvent}" with cacade "${cascade}"`);

    console.log("cascade state", this.cascade);
    const events = this.cascade[endedEvent];

    if (!events || events.length === 0) {
      console.log(`No cascade events found for "${endedEvent}"`);
      return;
    }

    console.log(`Cascading to events:`, events);

    for (const event of events) {
      this.action(event, true); // Передаем cascade = true для цепочки
    }
  }

  async action(event: string, cascade: boolean = false): Promise<void> {
    console.log(`Starting action for event: ${event}`);

    if (!this.isInitialized) {
      console.warn("WorkflowReactor is not initialized yet");
      return;
    }

    const worker: AspectWorker = this.workers[event];

    if (!worker) {
      console.error(`Worker "${event}" not found`);
      console.log("Available workers:", Object.keys(this.workers));
      return;
    }

    try {
      console.log(`Running worker: ${event}`);

      worker.activate(cascade);
    } catch (error) {
      console.error(`Error running worker "${event}":`, error);
    }
  }
}
