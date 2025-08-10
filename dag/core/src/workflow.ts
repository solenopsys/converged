import { StoreService } from './store/store';
import { HashString } from '../../types/interface';
import { Executor } from './executor';

// Сервис для работы с графом workflow
class WorkflowGraphService {
  constructor(private store: StoreService) {}

  getStartNodes(workflowConfig: any): string[] {
    const hasIncoming = new Set(workflowConfig.links.map(link => link.to));
    return workflowConfig.nodes.filter(node => !hasIncoming.has(node));
  }

  getNextNodes(workflowConfig: any, fromNode: string): string[] {
    return workflowConfig.links
      .filter(link => link.from === fromNode)
      .map(link => link.to);
  }

  getNodeDependencies(workflowConfig: any, nodeHash: string): string[] {
    return workflowConfig.links
      .filter(link => link.to === nodeHash)
      .map(link => link.from);
  }

  isNodeReady(processId: string, nodeHash: string, workflowConfig: any): boolean {
    const dependencies = this.getNodeDependencies(workflowConfig, nodeHash);
    if (dependencies.length === 0) return true;

    const events = this.store.getProcessEvents(processId);
    const completedNodes = new Set(
      events
        .filter(e => e.type === 'node_completed')
        .map(e => e.node_id)
    );

    return dependencies.every(dep => completedNodes.has(dep));
  }

  isProcessComplete(processId: string, workflowConfig: any): boolean {
    const events = this.store.getProcessEvents(processId);
    const completedNodes = new Set(
      events
        .filter(e => e.type === 'node_completed')
        .map(e => e.node_id)
    );

    return workflowConfig.nodes.every(node => completedNodes.has(node));
  }
}

// Базовый интерфейс для всех обработчиков
interface EventHandler {
  handle(event: any): Promise<void>;
}

// Обработчик запуска процесса
class ProcessStartedHandler implements EventHandler {
  constructor(private store: StoreService, private graphService: WorkflowGraphService) {}

  async handle(event: any): Promise<void> {
    const { processId, workflowHash, initialData } = event;
    
    const workflowConfig = this.store.getWorkflowConfig(workflowHash);
    if (!workflowConfig) {
      this.store.storeEvent(processId, 'process_failed', undefined, { error: 'Workflow not found' });
      return;
    }

    const startNodes = this.graphService.getStartNodes(workflowConfig);
    
    for (const nodeHash of startNodes) {
      this.store.storeEvent(processId, 'node_scheduled', nodeHash, { inputData: initialData });
    }
  }
}

// Обработчик планирования узла
class NodeScheduledHandler implements EventHandler {
  constructor(private store: StoreService, private executor: Executor) {}

  async handle(event: any): Promise<void> {
    const { processId, node_id: nodeHash, payload } = event;
    
    // Запускаем узел асинхронно
    setImmediate(async () => {
      try {
        this.store.storeEvent(processId, 'node_started', nodeHash, payload);
        
        const result = await this.executor.run(nodeHash, payload.inputData);
        
        this.store.storeEvent(processId, 'node_completed', nodeHash, { result: result.result });
      } catch (error) {
        this.store.storeEvent(processId, 'node_failed', nodeHash, { error: error.message });
      }
    });
  }
}

// Обработчик завершения узла
class NodeCompletedHandler implements EventHandler {
  constructor(private store: StoreService, private graphService: WorkflowGraphService) {}

  async handle(event: any): Promise<void> {
    const { processId, node_id: completedNode, payload } = event;
    
    const processData = this.store.getProcess(processId);
    if (!processData?.workflow_id) return;
    
    const workflowConfig = this.store.getWorkflowConfig(processData.workflow_id);
    if (!workflowConfig) return;

    const nextNodes = this.graphService.getNextNodes(workflowConfig, completedNode);

    for (const nextNode of nextNodes) {
      if (this.graphService.isNodeReady(processId, nextNode, workflowConfig)) {
        this.store.storeEvent(processId, 'node_scheduled', nextNode, { 
          inputData: payload.result 
        });
      }
    }

    if (this.graphService.isProcessComplete(processId, workflowConfig)) {
      this.store.storeEvent(processId, 'process_completed', undefined, { 
        result: payload.result 
      });
    }
  }
}

// Обработчик ошибки узла
class NodeFailedHandler implements EventHandler {
  constructor(private store: StoreService) {}

  async handle(event: any): Promise<void> {
    const { processId, node_id, payload } = event;
    this.store.storeEvent(processId, 'process_failed', undefined, {
      error: `Node ${node_id} failed: ${payload.error}`
    });
  }
}

// Диспетчер событий
export class EventDispatcher {
  private handlers = new Map<string, EventHandler>();

  constructor(store: StoreService, executor: Executor) {
    const graphService = new WorkflowGraphService(store);
    
    this.handlers.set('process_started', new ProcessStartedHandler(store, graphService));
    this.handlers.set('node_scheduled', new NodeScheduledHandler(store, executor));
    this.handlers.set('node_completed', new NodeCompletedHandler(store, graphService));
    this.handlers.set('node_failed', new NodeFailedHandler(store));
  }

  async processEvent(event: any): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (handler) {
      await handler.handle(event);
    }
  }
}

// Event Loop
export class EventLoop {
  private dispatcher = new EventDispatcher(
    StoreService.getInstance(),
    new Executor('./temp')
  );

  async start(): Promise<void> {
    console.log('Event loop started');
    // TODO: читать события из LMDB и передавать в dispatcher
  }
}