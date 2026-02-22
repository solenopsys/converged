import { BaseCommandProcessor, type Handler, type CommandEntry, printJson } from "../cli/src/base";
import { createDagServiceClient, type DagServiceClient } from "g-dag";

const STATE_ICONS: Record<string, string> = {
  queued: "⏳",
  processing: "⚙️ ",
  done: "✅",
  failed: "❌",
};

const startHandler: Handler = async (
  client: DagServiceClient,
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

  const renderNode = (nodeId: string, state: string) => {
    const icon = STATE_ICONS[state] ?? "·";
    const line = `  ${icon} [${state.padEnd(10)}] ${nodeId}`;

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

  for await (const event of client.startExecution(workflowName, params)) {
    if (event.type === "started") {
      console.log(`▶ Started  execution: ${event.executionId}`);
    } else if (event.type === "task_update" && event.task) {
      renderNode(event.task.nodeId, event.task.state);
    } else if (event.type === "completed") {
      console.log(`✔ Completed execution: ${event.executionId}`);
    } else if (event.type === "failed") {
      console.error(`✖ Failed   execution: ${event.executionId}${event.error ? ` — ${event.error}` : ""}`);
    }
  }
};

const createHandler: Handler = async (
  client: DagServiceClient,
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

  const { id } = await client.createExecution(workflowName, params);
  console.log(id);
};

const statusHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag status <executionId>");
    return;
  }
  const result = await client.statusExecution(param);
  printJson(result);
};

const listHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  const limit = param ? parseInt(param, 10) : 10;
  const result = await client.listExecutions({ offset: 0, limit });
  printJson(result);
};

const tasksHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag tasks <executionId> [limit]");
    return;
  }
  const [executionId, limitStr] = param.split(" ");
  const limit = limitStr ? parseInt(limitStr, 10) : 20;
  const result = await client.listTasks(executionId, { offset: 0, limit });
  printJson(result);
};

const statsHandler: Handler = async (client: DagServiceClient) => {
  const result = await client.stats();
  printJson(result);
};

const workflowsHandler: Handler = async (client: DagServiceClient) => {
  const result = await client.listWorkflows();
  printJson(result);
};

class DagProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["start", { handler: startHandler, description: "Start execution and stream task events" }],
      ["create", { handler: createHandler, description: "Create a new execution from JSON file" }],
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
  const client: DagServiceClient = createDagServiceClient({ baseUrl });
  return new DagProcessor(client);
};
