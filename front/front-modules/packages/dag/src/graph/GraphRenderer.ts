import * as PIXI from 'pixi.js';
import { RenderConfig, NodeData, EdgeData } from '../types';

// Внутренние типы PIXI (не экспортируются)
interface NodeContainer extends PIXI.Container {
  nodeData: NodeData;
  nodeSize: number;
}

interface EdgeGraphics extends PIXI.Graphics {
  fromNode: NodeContainer;
  toNode: NodeContainer;
  edgeData: EdgeData;
  updateEdge: () => void;
}

export class GraphRenderer {
  private app: PIXI.Application | null = null;
  private config: Required<RenderConfig>;
  private nodes: Map<string, NodeContainer> = new Map();
  private edges: Map<string, EdgeGraphics> = new Map();
  private nodesLayer: PIXI.Container;
  private edgesLayer: PIXI.Container;
  private viewport: PIXI.Container; // Контейнер для масштабирования
  private isUpdating: boolean = false;
  private canvasElement: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, config: RenderConfig = {}) {
    this.canvasElement = canvas;
    this.config = {
      nodeSize: 120,
      nodeShape: 'rounded',
      bgColor: '#ffffff',
      borderColor: '#4ecdc4',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 12,
      fontColor: '#333333',
      fontWeight: 'normal',
      shadowIntensity: 0.2,
      ...config
    };

    this.viewport = new PIXI.Container();
    this.nodesLayer = new PIXI.Container();
    this.edgesLayer = new PIXI.Container();
    
    // Добавляем слои в viewport
    this.viewport.addChild(this.edgesLayer);
    this.viewport.addChild(this.nodesLayer);
  }

  async init(width: number, height: number, backgroundColor: number): Promise<void> {
    try {
      this.app = new PIXI.Application();
      
      await this.app.init({
        canvas: this.canvasElement,
        width,
        height,
        backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });

      // Добавляем viewport в главную сцену
      this.app.stage.addChild(this.viewport);
      
      // Настраиваем масштабирование
      this.setupZoom();

      console.log('PIXI Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PIXI:', error);
      throw error;
    }
  }

  resize(width: number, height: number): void {
    if (this.app) {
      this.app.renderer.resize(width, height);
    }
  }

  setBackgroundColor(color: number): void {
    if (this.app) {
      this.app.renderer.background.color = color;
    }
  }

  updateConfig(newConfig: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.refreshAll();
  }

  addNode(nodeData: NodeData): void {
    if (!this.app) {
      console.warn('Renderer not initialized');
      return;
    }

    if (this.nodes.has(nodeData.id)) {
      console.warn(`Node ${nodeData.id} already exists`);
      return;
    }

    const container = this.createNodeContainer(nodeData);
    this.nodes.set(nodeData.id, container);
    this.nodesLayer.addChild(container);
    
    console.log(`Node ${nodeData.id} added successfully`);
  }

  addEdge(edgeData: EdgeData): void {
    if (!this.app) {
      console.warn('Renderer not initialized');
      return;
    }

    const edgeId = `${edgeData.from}-${edgeData.to}`;
    if (this.edges.has(edgeId)) {
      console.warn(`Edge ${edgeId} already exists`);
      return;
    }

    const fromNode = this.nodes.get(edgeData.from);
    const toNode = this.nodes.get(edgeData.to);

    if (!fromNode || !toNode) {
      console.warn(`Cannot create edge: missing nodes ${edgeData.from} or ${edgeData.to}`);
      return;
    }

    const edge = this.createEdgeGraphics(fromNode, toNode, edgeData);
    this.edges.set(edgeId, edge);
    this.edgesLayer.addChild(edge);
    
    console.log(`Edge ${edgeId} added successfully`);
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

    this.nodesLayer.removeChild(node);
    node.destroy();
    this.nodes.delete(nodeId);
  }

  removeEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;

    this.edgesLayer.removeChild(edge);
    edge.destroy();
    this.edges.delete(edgeId);
  }

  setNodePosition(nodeId: string, x: number, y: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.position.set(x, y);
      // Принудительно обновляем все рёбра после изменения позиции
      this.updateEdges();
    }
  }

  getNodePosition(nodeId: string): { x: number; y: number } | null {
    const node = this.nodes.get(nodeId);
    return node ? { x: node.x, y: node.y } : null;
  }

  getAllNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  getAllEdgeIds(): string[] {
    return Array.from(this.edges.keys());
  }

  clear(): void {
    this.nodes.forEach(node => {
      this.nodesLayer.removeChild(node);
      node.destroy();
    });
    
    this.edges.forEach(edge => {
      this.edgesLayer.removeChild(edge);
      edge.destroy();
    });
    
    this.nodes.clear();
    this.edges.clear();
  }

  destroy(): void {
    this.clear();
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }

  // Установка обработчиков событий
  onNodeClick(callback: (nodeData: NodeData) => void): void {
    this.nodes.forEach(node => {
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.on('pointerdown', () => callback(node.nodeData));
    });
  }

  onEdgeClick(callback: (edgeData: EdgeData) => void): void {
    this.edges.forEach(edge => {
      edge.eventMode = 'static';
      edge.cursor = 'pointer';
      edge.on('pointerdown', () => callback(edge.edgeData));
    });
  }

  // Настройка масштабирования колесом мыши
  private setupZoom(): void {
    if (!this.app) return;

    let isDragging = false;
    let dragStart = { x: 0, y: 0 };

    // Масштабирование колесом мыши
    this.canvasElement.addEventListener('wheel', (event) => {
      event.preventDefault();

      const rect = this.canvasElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Получаем текущий масштаб
      const currentScale = this.viewport.scale.x;
      
      // Рассчитываем новый масштаб
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(3.0, currentScale * scaleFactor));

      // Рассчитываем позицию мыши в координатах viewport'а до масштабирования
      const worldPosBeforeZoom = {
        x: (mouseX - this.viewport.x) / currentScale,
        y: (mouseY - this.viewport.y) / currentScale
      };

      // Применяем новый масштаб
      this.viewport.scale.set(newScale);

      // Корректируем позицию, чтобы масштабирование происходило относительно курсора
      this.viewport.x = mouseX - worldPosBeforeZoom.x * newScale;
      this.viewport.y = mouseY - worldPosBeforeZoom.y * newScale;
    });

    // Перетаскивание правой кнопкой мыши или с зажатым Ctrl
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on('pointerdown', (event) => {
      if (event.button === 2 || event.ctrlKey) { // Правая кнопка или Ctrl
        isDragging = true;
        dragStart.x = event.globalX - this.viewport.x;
        dragStart.y = event.globalY - this.viewport.y;
        this.canvasElement.style.cursor = 'grabbing';
        event.stopPropagation();
      }
    });

    this.app.stage.on('pointermove', (event) => {
      if (isDragging) {
        this.viewport.x = event.globalX - dragStart.x;
        this.viewport.y = event.globalY - dragStart.y;
        event.stopPropagation();
      }
    });

    this.app.stage.on('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        this.canvasElement.style.cursor = 'default';
      }
    });

    this.app.stage.on('pointerupoutside', () => {
      if (isDragging) {
        isDragging = false;
        this.canvasElement.style.cursor = 'default';
      }
    });

    // Отключаем контекстное меню для правой кнопки мыши
    this.canvasElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  private createNodeContainer(nodeData: NodeData): NodeContainer {
    const container = new PIXI.Container() as NodeContainer;
    const nodeSize = this.getNodeSizeByType(nodeData.type);
    const nodeColor = this.getNodeColorByType(nodeData.type);

    // Создаем графику для узла с правильным API v8
    const graphics = new PIXI.Graphics();
    
    // Устанавливаем стиль заливки и границы
    if (this.config.nodeShape === 'rounded') {
      graphics
        .roundRect(-nodeSize/2, -nodeSize/2, nodeSize, nodeSize, this.config.borderRadius)
        .fill(this.hexToNumber(nodeColor))
        .stroke({ width: this.config.borderWidth, color: this.hexToNumber(this.config.borderColor) });
    } else {
      graphics
        .rect(-nodeSize/2, -nodeSize/2, nodeSize, nodeSize)
        .fill(this.hexToNumber(nodeColor))
        .stroke({ width: this.config.borderWidth, color: this.hexToNumber(this.config.borderColor) });
    }
    
    container.addChild(graphics);

    // Добавляем текст с правильным API v8
    const text = new PIXI.Text({
      text: nodeData.label || nodeData.id,
      style: {
        fontFamily: 'Arial',
        fontSize: this.config.fontSize,
        fill: this.config.fontColor,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: nodeSize - 20
      }
    });
    text.anchor.set(0.5);
    container.addChild(text);

    container.nodeData = nodeData;
    container.nodeSize = nodeSize;

    // Интерактивность для перетаскивания
    this.setupNodeDragging(container);

    return container;
  }

  private createEdgeGraphics(fromNode: NodeContainer, toNode: NodeContainer, edgeData: EdgeData): EdgeGraphics {
    const graphics = new PIXI.Graphics() as EdgeGraphics;
    
    graphics.updateEdge = () => {
      const fromPos = fromNode.position;
      const toPos = toNode.position;
      
      // Используем одинаковый размер для всех узлов
      const nodeSize = this.config.nodeSize;
      const halfSize = nodeSize / 2;
      
      // Точки подключения - справа от исходного узла, слева от целевого
      const from = { 
        x: fromPos.x + halfSize, 
        y: fromPos.y 
      };
      const to = { 
        x: toPos.x - halfSize, 
        y: toPos.y 
      };

      graphics.clear();
      
      // Рисуем кривую Безье
      const controlOffset = Math.max(50, Math.abs(to.x - from.x) * 0.3);
      
      graphics
        .moveTo(from.x, from.y)
        .bezierCurveTo(
          from.x + controlOffset, from.y,  // первая контрольная точка
          to.x - controlOffset, to.y,      // вторая контрольная точка  
          to.x, to.y                       // конечная точка
        )
        .stroke({ width: 3, color: this.hexToNumber(this.config.borderColor), alpha: 1 });
      
      // Рисуем стрелку - всегда горизонтально влево (перпендикулярно к узлу)
      const arrowSize = 10;
      
      graphics
        .moveTo(to.x, to.y)
        .lineTo(to.x - arrowSize, to.y - arrowSize/2)  // верхняя часть стрелки
        .moveTo(to.x, to.y)
        .lineTo(to.x - arrowSize, to.y + arrowSize/2)  // нижняя часть стрелки
        .stroke({ width: 2, color: this.hexToNumber(this.config.borderColor), alpha: 1 });
    };

    graphics.fromNode = fromNode;
    graphics.toNode = toNode;
    graphics.edgeData = edgeData;
    graphics.updateEdge();

    return graphics;
  }

  private setupNodeDragging(node: NodeContainer): void {
    let dragging = false;
    let dragOffset = { x: 0, y: 0 };
    let pointerId: number | null = null;
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 16; // ~60 FPS

    node.eventMode = 'static';
    node.cursor = 'pointer';

    node.on('pointerdown', (event) => {
      if (event.button === 0 && !event.ctrlKey) {
        dragging = true;
        pointerId = event.pointerId;
        node.alpha = 0.8;
        
        // Запоминаем смещение
        const localClickPosition = event.getLocalPosition(this.viewport);
        dragOffset.x = node.x - localClickPosition.x;
        dragOffset.y = node.y - localClickPosition.y;
        
        // Устанавливаем глобальные обработчики для надежного отслеживания
        const onGlobalMove = (globalEvent: PIXI.FederatedPointerEvent) => {
          if (dragging && globalEvent.pointerId === pointerId) {
            // Всегда обновляем позицию узла для плавности
            const localMousePosition = globalEvent.getLocalPosition(this.viewport);
            node.position.set(
              localMousePosition.x + dragOffset.x,
              localMousePosition.y + dragOffset.y
            );

            // Throttling только для обновления рёбер
            const now = performance.now();
            if (now - lastUpdateTime >= UPDATE_THROTTLE) {
              this.updateEdgesForNode(node.nodeData.id);
              lastUpdateTime = now;
            }
          }
        };

        const onGlobalUp = (globalEvent: PIXI.FederatedPointerEvent) => {
          if (globalEvent.pointerId === pointerId) {
            dragging = false;
            pointerId = null;
            node.alpha = 1;
            
            // Финальное обновление всех рёбер
            this.updateEdgesForNode(node.nodeData.id);
            
            // Удаляем глобальные обработчики
            this.app!.stage.off('pointermove', onGlobalMove);
            this.app!.stage.off('pointerup', onGlobalUp);
            this.app!.stage.off('pointerupoutside', onGlobalUp);
          }
        };

        // Добавляем глобальные обработчики
        this.app!.stage.on('pointermove', onGlobalMove);
        this.app!.stage.on('pointerup', onGlobalUp);
        this.app!.stage.on('pointerupoutside', onGlobalUp);
        
        event.stopPropagation();
      }
    });
  }

  private updateEdgesForNode(nodeId: string): void {
    if (this.isUpdating) return;
    this.isUpdating = true;

    // Обновляем только рёбра, связанные с конкретным узлом
    this.edges.forEach((edge, edgeId) => {
      if (edgeId.includes(nodeId)) {
        edge.updateEdge();
      }
    });

    this.isUpdating = false;
  }

  private updateEdges(): void {
    if (this.isUpdating) return;
    this.isUpdating = true;

    // Обновляем все рёбра
    this.edges.forEach(edge => {
      edge.updateEdge();
    });

    this.isUpdating = false;
  }

  private refreshAll(): void {
    // Пересоздаём все узлы с новой конфигурацией
    const nodeData = Array.from(this.nodes.values()).map(n => n.nodeData);
    const edgeData = Array.from(this.edges.values()).map(e => e.edgeData);
    
    this.clear();
    
    nodeData.forEach(data => this.addNode(data));
    edgeData.forEach(data => this.addEdge(data));
  }

  private getNodeSizeByType(nodeType: string): number {
    // Все узлы одинакового размера
    return this.config.nodeSize;
  }

  private getNodeColorByType(nodeType: string): string {
    const colors: Record<string, string> = {
      'StartNode': '#2ecc71',
      'EndNode': '#e74c3c',
      'PrintNode': '#e74c3c',
      'SQLQueryNode': '#3498db',
      'AiRequest': '#9b59b6',
      'TemplateInjectorNode': '#f39c12',
      'RandomStringNode': '#e67e22',
      'MarkNode': '#1abc9c'
    };
    return colors[nodeType] || '#95a5a6';
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }
}