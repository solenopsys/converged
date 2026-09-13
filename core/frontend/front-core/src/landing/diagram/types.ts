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

export type V2Tone = "default" | "accent" | "warning" | "muted";

export interface V2Symbol {
  id: string;
  kind: V2SymbolKind;
  icon?: string;
  rect: V2GridRect;
  tone?: V2Tone;
}

export interface V2Group {
  id: string;
  rect: V2GridRect;
  tone?: V2Tone;
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
  tone?: V2Tone;
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

/**
 * A diagram's geometry and animation — the half that is the same in every
 * language. Configs live outside the locale tree in `struct` (`diagrams/<set>/`)
 * and are stored one file per diagram; the strings that go on top of them come
 * from a locale document and are merged in by `mergeDiagram`.
 */
export interface V2DiagramConfig {
  id: string;
  width: number;
  height: number;
  symbols: V2Symbol[];
  connections: V2Connection[];
  groups?: V2Group[];
  machine?: V2Machine;
}

/** Manifest that names the diagrams in one `diagrams/<set>` directory. */
export interface V2DiagramSetIndex {
  id: string;
  entries: string[];
}

export interface V2NodeTexts {
  title?: string;
  subtitle?: string;
  rows?: string[];
}

export interface V2ConnectionTexts {
  label?: string;
  /** Rides the edge from source to target. */
  title?: string;
  /** Shown instead of `title` while a step replays the edge in reverse. */
  reply?: string;
}

/** Everything a single diagram says, keyed by the ids used in its config. */
export interface V2DiagramTexts {
  title?: string;
  symbols?: Record<string, V2NodeTexts>;
  groups?: Record<string, V2NodeTexts>;
  connections?: Record<string, V2ConnectionTexts>;
}

export type V2DiagramConfigs = Record<string, V2DiagramConfig>;
export type V2DiagramTextsByDiagram = Record<string, V2DiagramTexts>;

export interface V2RenderedSymbol extends V2Symbol {
  title: string;
  subtitle?: string;
  rows?: string[];
}

export interface V2RenderedGroup extends V2Group {
  title: string;
  subtitle?: string;
}

export interface V2RenderedConnection extends V2Connection {
  label?: string;
  message?: {
    title: string;
    reply?: string;
  };
}

/** A config with its locale applied: what the renderer and the runtime read. */
export interface V2DiagramData {
  id: string;
  title: string;
  width: number;
  height: number;
  symbols: V2RenderedSymbol[];
  connections: V2RenderedConnection[];
  groups?: V2RenderedGroup[];
  machine?: V2Machine;
}

