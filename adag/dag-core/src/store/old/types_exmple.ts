export interface WorkflowScope {
  id: number;
  name: string;
  workflow_id: Uint8Array;
  created_at: string;
}

// это фактически scope
export interface Workflow {
  id: Uint8Array;
  scope_id: number;
  before_id: Uint8Array | null;
  created_at: string;
}
// настрокий различныхх сервисао
export interface Provider {
  id: number;
  type: string;
  name: string;
  config: string;
  created_at: string;
}

// узел выполняет обработку
export interface Node {
  id: Uint8Array;
  workflow_id: Uint8Array;
  type: string;
  name: string;
  config: string;
  position_x: number;
  position_y: number;
  created_at: string;
}
// связь между узлами
export interface Link {
  id: Uint8Array;
  workflow_id: Uint8Array;
  source_node_id: Uint8Array;
  target_node_id: Uint8Array;
  created_at: string;
}
// конкретный процесс workflow
export interface Process {
  id: Uint8Array;
  workflow_id: Uint8Array;
  created_at: string;
}
// состояние процесса
export interface ProcessState {
  id: number;
  process_id: Uint8Array;
  status: string;
  data: string;
  created_at: string;
}
// вебхуки
export interface Webhook {
  id: number;
  workflow_id: Uint8Array;
  url: string;
  secret: string | null;
  created_at: string;
  is_active: boolean;
}

export interface DB {
  workflow_scopes: WorkflowScope;
  workflows: Workflow;
  providers: Provider;
  nodes: Node;
  links: Link;
  processes: Process;
  process_states: ProcessState;
  webhooks: Webhook;
}

