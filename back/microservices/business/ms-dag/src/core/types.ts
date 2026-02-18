import type { AspectDefinition } from "./aspects";

// Node definition in workflow graph
export type WorkflowNode = {
  type: string;
  config?: Record<string, any>;
  aspects?: AspectDefinition[];
};

// Edge between nodes
export type WorkflowEdge = {
  from: string;
  to: string;
};

// Declarative workflow definition
export type WorkflowDefinition = {
  name: string;
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
};

// Special node names
export const NODE_START = "START";
export const NODE_END = "END";
