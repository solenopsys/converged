import * as PIXI from 'pixi.js';
import { RenderConfig, NodeData, NodeContainer, EdgeGraphics } from './types';

export class GraphRenderer {
  public config: Required<RenderConfig>;

  constructor(config: RenderConfig = {}) {
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
  }

  createNode(data: NodeData): NodeContainer {
    const container = new PIXI.Container() as NodeContainer;
    const graphics = new PIXI.Graphics();

    const nodeSize = this.getNodeSizeByType(data.type);
    const halfSize = nodeSize / 2;

    // Тень
    if (this.config.shadowIntensity > 0) {
      graphics.beginFill(0x000000, this.config.shadowIntensity);
      this.drawShape(graphics, 4, 4, nodeSize);
    }

    // Основная форма
    graphics.beginFill(this.hexToNumber(this.config.bgColor));
    graphics.lineStyle(this.config.borderWidth, this.hexToNumber(this.config.borderColor));
    this.drawShape(graphics, 0, 0, nodeSize);
    graphics.endFill();

    // Текст с переносами строк
    const text = this.createMultilineText(data.label || data.id);
    text.position.set(0, 0);

    // Точки подключения
    if (!this.isStartNode(data.type)) {
      const inputPoint = this.createConnectionPoint(-halfSize, 0, 0x666666);
      container.addChild(inputPoint);
      container.inputPoint = inputPoint;
    }

    if (!this.isEndNode(data.type)) {
      const outputPoint = this.createConnectionPoint(halfSize, 0, this.hexToNumber(this.config.borderColor));
      container.addChild(outputPoint);
      container.outputPoint = outputPoint;
    }

    container.addChild(graphics);
    container.addChild(text);

    // Метаданные
    container.nodeData = data;
    container.nodeSize = nodeSize;

    return container;
  }

  createEdge(fromNode: NodeContainer, toNode: NodeContainer): EdgeGraphics {
    const graphics = new PIXI.Graphics() as EdgeGraphics;
    
    graphics.updateEdge = (): void => {
      const fromPos = fromNode.getGlobalPosition();
      const toPos = toNode.getGlobalPosition();
      
      const fromSize = fromNode.nodeSize || this.config.nodeSize;
      const toSize = toNode.nodeSize || this.config.nodeSize;
      
      const from = { 
        x: fromPos.x + fromSize / 2, 
        y: fromPos.y 
      };
      const to = { 
        x: toPos.x - toSize / 2, 
        y: toPos.y 
      };

      graphics.clear();
      graphics.lineStyle(2, this.hexToNumber(this.config.borderColor), 0.8);

      // Кривая Безье
      const controlOffset = Math.max(50, Math.abs(to.x - from.x) * 0.5);
      graphics.moveTo(from.x, from.y);
      graphics.bezierCurveTo(
        from.x + controlOffset, from.y,
        to.x - controlOffset, to.y,
        to.x, to.y
      );

      // Стрелка
      graphics.beginFill(this.hexToNumber(this.config.borderColor));
      graphics.drawPolygon([
        to.x, to.y,
        to.x - 8, to.y - 4,
        to.x - 8, to.y + 4
      ]);
      graphics.endFill();
    };

    graphics.fromNode = fromNode;
    graphics.toNode = toNode;
    
    return graphics;
  }

  updateConfig(newConfig: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private createMultilineText(labelText: string): PIXI.Container {
    const lines = labelText.split('\n');
    const textContainer = new PIXI.Container();
    
    lines.forEach((line, index) => {
      const text = new PIXI.Text(line.trim(), {
        fontFamily: 'Arial, sans-serif',
        fontSize: this.config.fontSize,
        fill: this.config.fontColor,
        fontWeight: this.config.fontWeight,
        align: 'center'
      });
      
      text.anchor.set(0.5);
      text.position.set(0, (index - (lines.length - 1) / 2) * (this.config.fontSize + 2));
      textContainer.addChild(text);
    });
    
    return textContainer;
  }

  private getNodeSizeByType(nodeType: string): number {
    const typeSizes: Record<string, number> = {
      'StartNode': 100,
      'EndNode': 100,
      'SQLQueryNode': 140,
      'AiRequest': 120,
      'TemplateInjectorNode': 130,
      'PrintNode': 110,
      'RandomStringNode': 110,
      'MarkNode': 120
    };
    
    return typeSizes[nodeType] || this.config.nodeSize;
  }

  private isStartNode(nodeType: string): boolean {
    return nodeType.toLowerCase().includes('start');
  }

  private isEndNode(nodeType: string): boolean {
    return nodeType.toLowerCase().includes('end') || 
           nodeType.toLowerCase().includes('print');
  }

  private drawShape(graphics: PIXI.Graphics, offsetX = 0, offsetY = 0, customSize?: number): void {
    const size = customSize || this.config.nodeSize;
    const halfSize = size / 2;
    const x = offsetX;
    const y = offsetY;

    switch (this.config.nodeShape) {
      case 'circle':
        graphics.drawCircle(x, y, halfSize);
        break;
      case 'rounded':
        graphics.drawRoundedRect(x - halfSize, y - halfSize, size, size, this.config.borderRadius);
        break;
      case 'hexagon':
        this.drawPolygon(graphics, x, y, halfSize, 6);
        break;
      case 'diamond':
        this.drawPolygon(graphics, x, y, halfSize, 4, Math.PI / 4);
        break;
      default:
        graphics.drawRect(x - halfSize, y - halfSize, size, size);
    }
  }

  private drawPolygon(graphics: PIXI.Graphics, centerX: number, centerY: number, radius: number, sides: number, rotation = 0): void {
    const points: number[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rotation;
      points.push(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      );
    }
    graphics.drawPolygon(points);
  }

  private createConnectionPoint(x: number, y: number, color: number): PIXI.Graphics {
    const point = new PIXI.Graphics();
    point.beginFill(color);
    point.drawCircle(x, y, 4);
    point.endFill();
    return point;
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }
}