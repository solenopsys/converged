import { BaseCommandProcessor, type Handler, type CommandEntry, printJson } from "../cli/src/base";
import { createDagServiceClient, type DagServiceClient } from "g-dag";

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
