import { BaseCommandProcessor, type Handler, type CommandEntry, printJson } from "../cli/src/base";
import {
  createDagServiceClient,
  type DagServiceClient,
  type ExecutionEvent,
  type Task,
} from "g-dag";
import {
  createRuntimeServiceClient,
  type RuntimeServiceClient,
} from "../integration/generated/g-runtime/src";

const STATE_ICONS: Record<string, string> = {
  queued: "⏳",
  processing: "⚙️ ",
  done: "✅",
  failed: "❌",
};

type DagCommandClient = {
  dag: DagServiceClient;
  runtime: RuntimeServiceClient;
};

type LegacyDagRunApi = {
  startExecution?: (
    workflowName: string,
    params: Record<string, any>,
  ) => AsyncIterable<ExecutionEvent>;
  createExecution?: (
    workflowName: string,
    params: Record<string, any>,
  ) => Promise<{ id: string }>;
};

function resolveStartExecution(
  client: DagCommandClient,
): (workflowName: string, params: Record<string, any>) => AsyncIterable<ExecutionEvent> {
  if (typeof client.runtime.startExecution === "function") {
    return client.runtime.startExecution.bind(client.runtime);
  }

  const legacy = client.dag as DagServiceClient & LegacyDagRunApi;
  if (typeof legacy.startExecution === "function") {
    return legacy.startExecution.bind(legacy);
  }

  throw new Error("Neither runtime nor dag service exposes startExecution");
}

function resolveCreateExecution(
  client: DagCommandClient,
): (workflowName: string, params: Record<string, any>) => Promise<{ id: string }> {
  if (typeof client.runtime.createExecution === "function") {
    return client.runtime.createExecution.bind(client.runtime);
  }

  const legacy = client.dag as DagServiceClient & LegacyDagRunApi;
  if (typeof legacy.createExecution === "function") {
    return legacy.createExecution.bind(legacy);
  }

  throw new Error("Neither runtime nor dag service exposes createExecution");
}

const startHandler: Handler = async (
  client: DagCommandClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag start <path-to-json>");
    console.error("JSON: { workflowName: string, params?: {} }");
    return;
  }

  const file = Bun.file(param);
  if (!(await file.exists())) {
    console.error(`File not found: ${param}`);
    return;
  }

  const config = await file.json();
  const { workflowName, params = {} } = config;

  if (!workflowName) {
    console.error("JSON must contain: workflowName");
    return;
  }

  // nodeId -> line number (1-based) relative to current cursor
  const nodeLines = new Map<string, number>();
  let linesWritten = 0;

  const compactJson = (value: any, maxLen = 120): string => {
    const s = JSON.stringify(value);
    return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
  };

  const renderNode = (nodeId: string, state: string, task?: Task) => {
    const icon = STATE_ICONS[state] ?? "·";
    let detail = "";
    if (state === "failed" && task?.errorMessage) {
      detail = `  — ${task.errorMessage}`;
    } else if (state === "done" && task?.result != null) {
      detail = `  → ${compactJson(task.result)}`;
    }
    const line = `  ${icon} [${state.padEnd(10)}] ${nodeId}${detail}`;

    if (nodeLines.has(nodeId)) {
      // Move cursor up to the node's line and overwrite
      const linesUp = linesWritten - nodeLines.get(nodeId)!;
      process.stdout.write(`\x1b[${linesUp}A\r${line}\x1b[K\n`);
      // Restore cursor to bottom
      if (linesUp > 1) process.stdout.write(`\x1b[${linesUp - 1}B`);
    } else {
      nodeLines.set(nodeId, ++linesWritten);
      process.stdout.write(line + "\n");
    }
  };

  const startExecution = resolveStartExecution(client);

  for await (const event of startExecution(workflowName, params)) {
    if (event.type === "started") {
      console.log(`▶ Started  execution: ${event.executionId}`);
    } else if (event.type === "task_update" && event.task) {
      renderNode(event.task.nodeId, event.task.state, event.task);
    } else if (event.type === "completed") {
      console.log(`✔ Completed execution: ${event.executionId}`);
    } else if (event.type === "failed") {
      console.error(`✖ Failed   execution: ${event.executionId}${event.error ? ` — ${event.error}` : ""}`);
    }
  }
};

const createHandler: Handler = async (
  client: DagCommandClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag create <path-to-json>");
    console.error("JSON: { workflowName: string, params?: {} }");
    return;
  }

  const file = Bun.file(param);
  if (!(await file.exists())) {
    console.error(`File not found: ${param}`);
    return;
  }

  const config = await file.json();
  const { workflowName, params = {} } = config;

  if (!workflowName) {
    console.error("JSON must contain: workflowName");
    return;
  }

  const createExecution = resolveCreateExecution(client);
  const { id } = await createExecution(workflowName, params);
  console.log(id);
};

const statusHandler: Handler = async (
  client: DagCommandClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag status <executionId>");
    return;
  }
  const result = await client.dag.statusExecution(param);
  printJson(result);
};

const listHandler: Handler = async (
  client: DagCommandClient,
  _splitter: string,
  param?: string,
) => {
  const limit = param ? parseInt(param, 10) : 10;
  const result = await client.dag.listExecutions({ offset: 0, limit });
  printJson(result);
};

const tasksHandler: Handler = async (
  client: DagCommandClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag tasks <executionId> [limit]");
    return;
  }
  const [executionId, limitStr] = param.split(" ");
  const limit = limitStr ? parseInt(limitStr, 10) : 20;
  const result = await client.dag.listTasks(executionId, { offset: 0, limit });
  printJson(result);
};

const statsHandler: Handler = async (client: DagCommandClient) => {
  const result = await client.dag.stats();
  printJson(result);
};

const workflowsHandler: Handler = async (client: DagCommandClient) => {
  const listWorkflows = (client.runtime as any).listWorkflows;
  if (typeof listWorkflows !== "function") {
    throw new Error("runtime service does not expose listWorkflows");
  }
  const result = await listWorkflows.call(client.runtime);
  printJson(result);
};

const resumeHandler: Handler = async (
  client: DagCommandClient,
  _splitter: string,
  param?: string,
) => {
  const resume = (client.runtime as any).resumeActiveExecutions;
  if (typeof resume !== "function") {
    throw new Error("runtime service does not expose resumeActiveExecutions");
  }

  const limit = param ? parseInt(param, 10) : 200;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 200;
  const result = await resume.call(client.runtime, safeLimit);
  printJson(result);
};

class DagProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["start", { handler: startHandler, description: "Start execution and stream task events" }],
      ["create", { handler: createHandler, description: "Create a new execution from JSON file" }],
      ["resume", { handler: resumeHandler, description: "Resume active executions (optional: limit)" }],
      ["status", { handler: statusHandler, description: "Show execution status with tasks by ID" }],
      ["list", { handler: listHandler, description: "List executions (default limit: 10)" }],
      ["tasks", { handler: tasksHandler, description: "List tasks for execution (executionId [limit])" }],
      ["stats", { handler: statsHandler, description: "Show executions and tasks statistics" }],
      ["workflows", { handler: workflowsHandler, description: "List available workflows" }],
    ]);
  }
}

export default () => {
  const baseUrl = process.env.SERVICES_URL;
  const client: DagCommandClient = {
    dag: createDagServiceClient({ baseUrl }),
    runtime: createRuntimeServiceClient({ baseUrl }),
  };
  return new DagProcessor(client);
};
