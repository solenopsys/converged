import * as PIXI from 'pixi.js';

// Тип узла - любая строка
export type NodeType = string;

// Параметры узлов
export interface NodeParams {
  query?: string;
  provider?: string;
  config?: Record<string, any>;
  consts?: Record<string, any>;
  length?: number;
  templatePath?: string;
  mapping?: Record<string, string>;
  convertToHtml?: boolean;
  [key: string]: any;
}

// Конфигурация узла
export interface NodeConfig {
  type: NodeType;
  params?: NodeParams;
}

// Данные узла для рендеринга
export interface NodeData {
  id: string;
  label?: string;
  type: NodeType;
  params?: NodeParams;
  x?: number;
  y?: number;
}

// Данные ребра
export interface EdgeData {
  from: string;
  to: string;
  type?: string;
}

// Формат workflow JSON
export interface WorkflowData {
  nodes: Record<string, NodeConfig>;
  connections: Record<string, string[]>;
}

// Конфигурация рендерера
export interface RenderConfig {
  nodeSize?: number;
  nodeShape?: 'rounded' | 'circle' | 'hexagon' | 'diamond' | 'rectangle';
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  shadowIntensity?: number;
}

// Расширенный PIXI Container с метаданными
export interface NodeContainer extends PIXI.Container {
  nodeData: NodeData;
  nodeSize: number;
  inputPoint?: PIXI.Graphics;
  outputPoint?: PIXI.Graphics;
}

// Расширенный PIXI Graphics для рёбер
export interface EdgeGraphics extends PIXI.Graphics {
  fromNode: NodeContainer;
  toNode: NodeContainer;
  edgeData?: EdgeData;
  updateEdge: () => void;
}

// Конфигурация Dagre
export interface DagreConfig {
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep: number;
  ranksep: number;
  marginx: number;
  marginy: number;
}

// Props для React компонента
export interface GraphComponentProps {
  width?: number;
  height?: number;
  backgroundColor?: number;
  renderConfig?: RenderConfig;
  onNodeClick?: (nodeData: NodeData, event: PIXI.FederatedPointerEvent) => void;
  onEdgeClick?: (edgeData: EdgeData, event: PIXI.FederatedPointerEvent) => void;
  className?: string;
}

// Ref методы для React компонента
export interface GraphComponentRef {
  loadData: (graphData: WorkflowData) => void;
  loadFromFile: (file: File) => Promise<void>;
  addNode: (nodeData: NodeData) => NodeContainer | undefined;
  addEdge: (fromId: string, toId: string, edgeData?: EdgeData) => EdgeGraphics | null;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  applyLayout: () => void;
  clear: () => void;
  exportData: () => WorkflowData | null;
  exportToFile: (filename?: string) => void;
  updateRenderConfig: (config: RenderConfig) => void;
  getNode: (nodeId: string) => NodeContainer | undefined;
  getAllNodes: () => NodeContainer[];
  getAllEdges: () => EdgeGraphics[];