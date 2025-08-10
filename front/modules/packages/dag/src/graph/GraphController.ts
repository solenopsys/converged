import dagre from 'dagre';
import { GraphRenderer } from './GraphRenderer';
import { WorkflowData, NodeData, EdgeData, RenderConfig, DagreConfig } from '../types';

export class GraphController {
  private renderer: GraphRenderer;
  private nodePositions: Map<string, { x: number; y: number }> = new Map();
  private dagreConfig: DagreConfig;

  constructor(renderer: GraphRenderer) {
    this.renderer = renderer;
    
    // Настройки по умолчанию для Dagre
    this.dagreConfig = {
      rankdir: 'LR',              // Слева направо
      align: 'UL',                // Выравнивание по левому верхнему углу
      nodesep: 80,                // Расстояние между узлами в ранге
      ranksep: 120,               // Расстояние между рангами
      marginx: 20,                // Отступ по X
      marginy: 20,                // Отступ по Y
      acyclicer: 'greedy',        // Алгоритм удаления циклов
      ranker: 'network-simplex'   // Алгоритм ранжирования
    };
  }

  loadFromJSON(graphData: WorkflowData): void {
    console.log('Loading workflow data:', graphData);
    this.renderer.clear();
    
    const { nodes = {}, connections = {} } = graphData;
    
    // Создаем узлы
    Object.entries(nodes).forEach(([nodeId, nodeConfig]) => {
      const nodeData: NodeData = {
        id: nodeId,
        label: this.generateNodeLabel(nodeId, nodeConfig),
        type: nodeConfig.type,
        params: nodeConfig.params || {},
      };
      this.renderer.addNode(nodeData);
    });
    
    // Создаем рёбра
    Object.entries(connections).forEach(([fromId, toIds]) => {
      if (Array.isArray(toIds)) {
        toIds.forEach(toId => {
          this.renderer.addEdge({ from: fromId, to: toId });
        });
      }
    });
    
    // Применяем layout
    setTimeout(() => {
      this.applyLayout();
    }, 50);
  }

  async loadFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const workflowData: WorkflowData = JSON.parse(content);
          this.loadFromJSON(workflowData);
          resolve();
        } catch (error) {
          reject(new Error(`Ошибка парсинга JSON: ${error}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Ошибка чтения файла'));
      };
      
      reader.readAsText(file);
    });
  }

  addNode(nodeData: NodeData): void {
    this.renderer.addNode(nodeData);
  }

  addEdge(fromId: string, toId: string, edgeData?: EdgeData): void {
    const edge = edgeData || { from: fromId, to: toId };
    this.renderer.addEdge(edge);
  }

  removeNode(nodeId: string): void {
    this.renderer.removeNode(nodeId);
    this.nodePositions.delete(nodeId);
  }

  removeEdge(edgeId: string): void {
    this.renderer.removeEdge(edgeId);
  }

  applyLayout(): void {
    const nodeIds = this.renderer.getAllNodeIds();
    const edgeIds = this.renderer.getAllEdgeIds();
    
    if (nodeIds.length === 0) {
      console.log('No nodes to layout');
      return;
    }

    console.log('Applying layout to', nodeIds.length, 'nodes and', edgeIds.length, 'edges');
    console.log('Layout config:', this.dagreConfig);

    const g = new dagre.graphlib.Graph();
    g.setGraph(this.dagreConfig);
    g.setDefaultEdgeLabel(() => ({}));

    // Добавляем узлы в граф dagre
    nodeIds.forEach(nodeId => {
      g.setNode(nodeId, {
        width: 120,
        height: 120
      });
    });

    // Добавляем рёбра в граф dagre
    edgeIds.forEach(edgeId => {
      const [fromId, toId] = edgeId.split('-');
      g.setEdge(fromId, toId);
    });

    // Применяем layout
    dagre.layout(g);

    // Обновляем позиции узлов
    nodeIds.forEach(nodeId => {
      const dagreNode = g.node(nodeId);
      if (dagreNode) {
        console.log(`Setting node ${nodeId} position to:`, dagreNode.x, dagreNode.y);
        this.renderer.setNodePosition(nodeId, dagreNode.x, dagreNode.y);
        this.nodePositions.set(nodeId, { x: dagreNode.x, y: dagreNode.y });
      }
    });

    console.log('Layout applied successfully');
  }

  clear(): void {
    this.renderer.clear();
    this.nodePositions.clear();
  }

  exportToJSON(): WorkflowData {
    const nodes: Record<string, any> = {};
    const connections: Record<string, string[]> = {};

    // Восстанавливаем данные из рендерера
    // Это упрощённая версия - в реальности нужно хранить исходные данные
    return { nodes, connections };
  }

  exportToFile(filename = 'workflow.json'): void {
    const data = this.exportToJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  updateRenderConfig(config: Partial<RenderConfig>): void {
    this.renderer.updateConfig(config);
  }

  updateLayoutConfig(config: Partial<DagreConfig>): void {
    this.dagreConfig = { ...this.dagreConfig, ...config };
    console.log('Layout config updated:', this.dagreConfig);
    // Автоматически применяем новый layout
    this.applyLayout();
  }

  private generateNodeLabel(nodeId: string, nodeConfig: any): string {
    const typeLabels: Record<string, string> = {
      'StartNode': '▶️ Старт',
      'EndNode': '⏹️ Конец',
      'SQLQueryNode': '🗃️ SQL',
      'PrintNode': '🖨️ Печать',
      'AiRequest': '🤖 AI',
      'TemplateInjectorNode': '📝 Шаблон',
      'RandomStringNode': '🎲 Рандом',
      'MarkNode': '📄 Конверт'
    };

    const typeLabel = typeLabels[nodeConfig.type] || nodeConfig.type;
    const shortId = nodeId.length > 12 ? nodeId.substring(0, 9) + '...' : nodeId;
    
    return `${typeLabel}\n${shortId}`;
  }
}