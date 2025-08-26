// Базовые типы без привязки к PIXI.js

export interface RenderConfig {
  nodeSize?: number;
  nodeShape?: 'rounded' | 'rectangle';
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  shadowIntensity?: number;
}

export interface NodeData {
  id: string;
  label?: string;
  type: string;
  params?: Record<string, any>;
}

export interface EdgeData {
  from: string;
  to: string;
}

export interface WorkflowData {
  nodes: Record<string, {
    type: string;
    params?: Record<string, any>;
  }>;
  connections: Record<string, string[]>;
}

export interface GraphComponentProps {
  width?: number;
  height?: number;
  backgroundColor?: number;
  renderConfig?: Partial<RenderConfig>;
  onNodeClick?: (nodeData: NodeData) => void;
  onEdgeClick?: (edgeData: EdgeData) => void;
  className?: string;
}

export interface GraphComponentRef {
  loadData: (graphData: WorkflowData) => void;
  loadFromFile: (file: File) => Promise<void>;
  addNode: (nodeData: NodeData) => void;
  addEdge: (fromId: string, toId: string, edgeData?: EdgeData) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  applyLayout: () => void;
  clear: () => void;
  exportData: () => WorkflowData | null;
  exportToFile: (filename?: string) => void;
  updateRenderConfig: (config: Partial<RenderConfig>) => void;
  updateLayoutConfig: (config: Partial<DagreConfig>) => void;
  isReady: () => boolean;
}

// Конфигурация Dagre layout
export interface DagreConfig {
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';  // Направление: Top-Bottom, Bottom-Top, Left-Right, Right-Left
  align?: 'UL' | 'UR' | 'DL' | 'DR';   // Выравнивание: UpLeft, UpRight, DownLeft, DownRight
  nodesep: number;                      // Расстояние между узлами в одном ранге (px)
  ranksep: number;                      // Расстояние между рангами (px)  
  marginx: number;                      // Отступ по X (px)
  marginy: number;                      // Отступ по Y (px)
  acyclicer?: 'greedy';                 // Алгоритм удаления циклов
  ranker?: 'network-simplex' | 'tight-tree' | 'longest-path';  // Алгоритм ранжирования
}