import * as PIXI from 'pixi.js';
import dagre from 'dagre';
import { GraphRenderer } from './GraphRenderer';
import { WorkflowData, NodeData, EdgeData, NodeContainer, EdgeGraphics, DagreConfig } from './types';

export class GraphController {
  private app: PIXI.Application;
  private renderer: GraphRenderer;
  private nodes: Map<string, NodeContainer> = new Map();
  private edges: Map<string, EdgeGraphics> = new Map();
  private edgesContainer: PIXI.Container;
  private nodesContainer: PIXI.Container;
  private dagreConfig: DagreConfig;

  constructor(app: PIXI.Application, renderer: GraphRenderer) {
    this.app = app;
    this.renderer = renderer;
    
    this.edgesContainer = new PIXI.Container();
    this.nodesContainer = new PIXI.Container();
    
    this.app.stage.addChild(this.edgesContainer);
    this.app.stage.addChild(this.nodesContainer);

    this.dagreConfig = {
      rankdir: 'LR',
      nodesep: 100,
      ranksep: 150,
      marginx: 50,
      marginy: 50
    };
  }

  loadFromJSON(graphData: WorkflowData): void {
    this.clear();
    
    const { nodes = {}, connections = {} } = graphData;
    
    // Создаем узлы из объекта
    Object.entries(nodes).forEach(([nodeId, nodeConfig]) => {
      const nodeData: NodeData = {
        id: nodeId,
        label: this.generateNodeLabel(nodeId, nodeConfig),
        type: nodeConfig.type,
        params: nodeConfig.params,
      };
      this.addNode(nodeData);
    });
    
    // Создаем рёбра из connections
    Object.entries(connections).forEach(([fromId, toIds]) => {
      if (Array.isArray(toIds)) {
        toIds.forEach(toId => {
          this.addEdge(fromId, toId, { from: fromId, to: toId });
        });
      }
    });
    
    this.applyLayout();
  }

  loadFromFile(file: File): Promise<void> {
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

  addNode(nodeData: NodeData): NodeContainer | undefined {
    try {
      const nodeColor = this.getNodeColorByType(nodeData.type);
      
      const originalBorderColor = this.renderer.config.borderColor;
      this.renderer.config.borderColor = nodeColor;
      
      const nodeContainer = this.renderer.createNode(nodeData);
      
      this.renderer.config.borderColor = originalBorderColor;
      
      this.setupNodeInteractivity(nodeContainer);
      
      this.nodes.set(nodeData.id, nodeContainer);
      this.nodesContainer.addChild(nodeContainer);
      
      return nodeContainer;
    } catch (error) {
      console.error(`Ошибка создания узла ${nodeData.id}:`, error);
      return undefined;
    }
  }

  addEdge(fromId: string, toId: string, edgeData: EdgeData = { from: fromId, to: toId }): EdgeGraphics | null {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    
    if (!fromNode || !toNode) {
      console.warn(`Edge creation failed: node ${fromId} or ${toId} not found`);
      return null;
    }

    const edge = this.renderer.createEdge(fromNode, toNode);
    edge.edgeData = edgeData;
    
    const edgeId = `${fromId}-${toId}`;
    this.edges.set(edgeId, edge);
    this.edgesContainer.addChild(edge);
    
    return edge;
  }

  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Удаляем связанные рёбра
    this.edges.forEach((edge, edgeId) => {
      if (edgeId.includes(nodeId)) {
        this.removeEdge(edgeId);
      }
    });

    this.nodesContainer.removeChild(node);
    node.destroy();
    this.nodes.delete(nodeId);
  }

  removeEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    this.edgesContainer.removeChild(edge);
    edge.destroy();
    this.edges.delete(edgeId);
  }

  applyLayout(): void {
    if (this.nodes.size === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setGraph(this.dagreConfig);
    g.setDefaultEdgeLabel(() => ({}));

    this.nodes.forEach((node, nodeId) => {
      g.setNode(nodeId, {
        width: node.nodeSize,
        height: node.nodeSize
      });
    });

    this.edges.forEach((edge, edgeId) => {
      const [fromId, toId] = edgeId.split('-');
      g.setEdge(fromId, toId);
    });

    dagre.layout(g);

    this.nodes.forEach((node, nodeId) => {
      const dagreNode = g.node(nodeId);
      if (dagreNode) {
        node.position.set(dagreNode.x, dagreNode.y);
      }
    });

    this.updateEdges();
  }

  updateEdges(): void {
    this.edges.forEach(edge => {
      edge.updateEdge();
    });
  }

  clear(): void {
    this.nodes.forEach(node => {
      this.nodesContainer.removeChild(node);
      node.destroy();
    });
    
    this.edges.forEach(edge => {
      this.edgesContainer.removeChild(edge);
      edge.destroy();
    });
    
    this.nodes.clear();
    this.edges.clear();
  }

  exportToJSON(): WorkflowData {
    const nodes: Record<string, any> = {};
    const connections: Record<string, string[]> = {};

    this.nodes.forEach((node, nodeId) => {
      const nodeData = node.nodeData;
      nodes[nodeId] = {
        type: nodeData.type,
        params: nodeData.params || {}
      };
    });

    this.edges.forEach(edge => {
      const fromId = edge.fromNode.nodeData.id;
      const toId = edge.toNode.nodeData.id;
      
      if (!connections[fromId]) {
        connections[fromId] = [];
      }
      connections[fromId].push(toId);
    });

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

  updateRenderConfig(config: Partial<GraphRenderer['config']>): void {
    this.renderer.updateConfig(config);
    const currentData = this.exportToJSON();
    this.loadFromJSON(currentData);
  }

  getNode(nodeId: string): NodeContainer | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): NodeContainer[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): EdgeGraphics[] {
    return Array.from(this.edges.values());
  }

  private generateNodeLabel(nodeId: string, nodeConfig: any): string {
    const typeLabels: Record<string, string> = {
      'StartNode': '▶️ Start',
      'EndNode': '⏹️ End',
      'SQLQueryNode': '🗃️ SQL Query',
      'PrintNode': '🖨️ Print',
      'AiRequest': '🤖 AI Request',
      'TemplateInjectorNode': '📝 Template',
      'RandomStringNode': '🎲 Random',
      'MarkNode': '📄 Convert'
    };

    const typeLabel = typeLabels[nodeConfig.type] || nodeConfig.type;
    const shortId = nodeId.length > 15 ? nodeId.substring(0, 12) + '...' : nodeId;
    
    return `${typeLabel}\n${shortId}`;
  }

  private getNodeColorByType(nodeType: string): string {
    const typeColors: Record<string, string> = {
      'StartNode': '#2ecc71',
      'EndNode': '#e74c3c',
      'SQLQueryNode': '#3498db',
      'AiRequest': '#9b59b6',
      'TemplateInjectorNode': '#f39c12',
      'PrintNode': '#34495e',
      'RandomStringNode': '#e67e22',
      'MarkNode': '#1abc9c'
    };
    
    return typeColors[nodeType] || '#95a5a6';
  }

  private setupNodeInteractivity(nodeContainer: NodeContainer): void {
    nodeContainer.interactive = true;
    nodeContainer.cursor = 'pointer';
    
    let dragging = false;
    let dragData: PIXI.FederatedPointerEvent | null = null;

    nodeContainer.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      dragging = true;
      dragData = event;
      nodeContainer.alpha = 0.8;
      nodeContainer.scale.set(1.05);
    });

    nodeContainer.on('pointerup', () => {
      dragging = false;
      dragData = null;
      nodeContainer.alpha = 1;
      nodeContainer.scale.set(1);
    });

    nodeContainer.on('pointerupoutside', () => {
      dragging = false;
      dragData = null;
      nodeContainer.alpha = 1;
      nodeContainer.scale.set(1);
    });

    nodeContainer.on('pointermove', () => {
      if (dragging && dragData) {
        const newPosition = dragData.getLocalPosition(nodeContainer.parent);
        nodeContainer.position.set(newPosition.x, newPosition.y);
        this.updateEdges();
      }
    });
  }
}