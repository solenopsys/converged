import { BaseCommandProcessor, type Handler, type CommandEntry } from "../cli/src/base";
import { createDagServiceClient, type DagServiceClient } from "g-dag";

const statusHandler: Handler = async (client: DagServiceClient) => {
  const result = await client.status();
  console.log(JSON.stringify(result, null, 2));
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

  const { contextId } = await client.createContext(workflowName, params);
  console.log(contextId);
};

const contextHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag context <contextId>");
    return;
  }
  const result = await client.getContext(param);
  console.log(JSON.stringify(result, null, 2));
};

const emitHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag emit <contextId>:<event>");
    return;
  }

  const [contextId, event] = param.split(":");
  if (!contextId || !event) {
    console.error("Usage: dag emit <contextId>:<event>");
    return;
  }

  await client.emit(contextId, event);
  console.log("Done");
};

const execHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag exec <path-to-json>");
    console.error(
      "JSON: { context: { workflowName, params? }, event: string }",
    );
    return;
  }

  const file = Bun.file(param);
  if (!(await file.exists())) {
    console.error(`File not found: ${param}`);
    return;
  }

  const config = await file.json();
  const { context, event } = config;

  if (!context?.workflowName || !event) {
    console.error("JSON must contain: context.workflowName, event");
    return;
  }

  const { contextId } = await client.createContext(
    context.workflowName,
    context.params || {},
  );
  console.log(`Context: ${contextId}`);

  await client.emit(contextId, event);
  console.log("Done");
};

const listHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  const limit = param ? parseInt(param, 10) : 10;
  const result = await client.listContexts({ offset: 0, limit });
  console.log(JSON.stringify(result, null, 2));
};

const statHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag stat <workflowName>");
    return;
  }
  const result = await client.getStats(param);
  console.log(JSON.stringify(result, null, 2));
};

const getHandler: Handler = async (
  client: DagServiceClient,
  _splitter: string,
  param?: string,
) => {
  if (!param) {
    console.error("Usage: dag get <contextId>");
    return;
  }
  const result = await client.getContext(param);
  console.log(JSON.stringify(result, null, 2));
};

class DagProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["status", { handler: statusHandler, description: "Show DAG service status" }],
      ["create", { handler: createHandler, description: "Create a new workflow context from JSON file" }],
      ["context", { handler: contextHandler, description: "Get context details by ID" }],
      ["emit", { handler: emitHandler, description: "Emit an event to a context (contextId:event)" }],
      ["exec", { handler: execHandler, description: "Create context and emit event from JSON file" }],
      ["list", { handler: listHandler, description: "List workflow contexts (default limit: 10)" }],
      ["stat", { handler: statHandler, description: "Get execution statistics for a workflow" }],
      ["get", { handler: getHandler, description: "Get full context JSON by ID" }],
    ]);
  }
}

export default () => {
  const baseUrl = process.env.SERVICES_URL;
  const client: DagServiceClient = createDagServiceClient({ baseUrl });
  return new DagProcessor(client);
};
