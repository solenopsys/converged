export const V2_GRID_SIZE = 10;

export type V2SymbolKind =
  | "smartphone"
  | "gateway"
  | "processor"
  | "recipient"
  | "storage"
  | "stream"
  | "message"
  | "channel";

export interface V2GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface V2Symbol {
  id: string;
  kind: V2SymbolKind;
  title: string;
  icon?: string;
  subtitle?: string;
  rect: V2GridRect;
  tone?: "default" | "accent" | "warning" | "muted";
  rows?: string[];
}

export type V2Anchor = "top" | "right" | "bottom" | "left" | "center";

export interface V2Point {
  x: number;
  y: number;
}

export interface V2Connection {
  id: string;
  from: string;
  to: string;
  fromAnchor: V2Anchor;
  toAnchor: V2Anchor;
  fromOffset?: number;
  toOffset?: number;
  via?: V2Point[];
  bidirectional?: boolean;
  tone?: "default" | "accent" | "warning" | "muted";
  label?: string;
  message?: {
    title: string;
    reply?: string;
  };
}

export interface V2SelectStep {
  event: "select";
  duration: number;
  stream: string;
}

export interface V2SendStep {
  event: "send";
  duration: number;
  connections: string[];
  reverse?: boolean;

  stagger?: number;
}

export interface V2ProcessStep {
  event: "process";
  duration: number;
  node: string;
}

export interface V2IdleStep {
  event: "idle";
  duration: number;
}

export type V2MachineStep = V2SelectStep | V2SendStep | V2ProcessStep | V2IdleStep;

export interface V2Machine {
  rowHeight: number;
  steps: V2MachineStep[];
}

export interface V2DiagramData {
  id: string;
  title: string;
  width: number;
  height: number;
  symbols: V2Symbol[];
  connections: V2Connection[];
  machine?: V2Machine;
}

export interface V2SymbolDefinition {
  kind: V2SymbolKind;
  title: string;
  description: string;
  icon: string;
  sample: V2Symbol;
}
