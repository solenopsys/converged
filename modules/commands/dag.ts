import { createDagServiceClient, type DagServiceClient } from "g-dag/browser";
import {
	createRuntimeDagServiceClient,
	type RuntimeDagServiceClient,
} from "g-rt-dag/browser";
import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
	printJson,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";

type DagCommandClient = {
	dag: DagServiceClient;
	runtime: RuntimeDagServiceClient;
};

type WorkflowRunConfig = {
	scriptPath: string;
	params?: Record<string, unknown>;
};

const runHandler: Handler = async (
	client: DagCommandClient,
	_splitter: string,
	param?: string,
) => {
	if (!param) {
		console.error("Usage: dag run <path-to-json>");
		console.error("JSON: { scriptPath: string, params?: {} }");
		return;
	}

	const file = Bun.file(param);
	if (!(await file.exists())) {
		console.error(`File not found: ${param}`);
		return;
	}

	const config = (await file.json()) as WorkflowRunConfig;
	if (!config.scriptPath?.trim()) {
		console.error("JSON must contain: scriptPath");
		return;
	}

	const result = await client.runtime.runWorkflow(
		config.scriptPath,
		config.params ?? {},
	);
	printJson(result);
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
	printJson(await client.dag.statusExecution(param));
};

const listHandler: Handler = async (
	client: DagCommandClient,
	_splitter: string,
	param?: string,
) => {
	const limit = Number.parseInt(param ?? "10", 10);
	printJson(
		await client.dag.listExecutions({
			offset: 0,
			limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
		}),
	);
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
	const [executionId, limitText] = param.split(" ");
	const limit = Number.parseInt(limitText ?? "20", 10);
	printJson(
		await client.dag.listTasks(executionId, {
			offset: 0,
			limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
		}),
	);
};

const statsHandler: Handler = async (client: DagCommandClient) => {
	printJson(await client.dag.stats());
};

class DagProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"run",
				{ handler: runHandler, description: "Run a workflow in Centimanus" },
			],
			[
				"status",
				{ handler: statusHandler, description: "Show stored execution status" },
			],
			["list", { handler: listHandler, description: "List stored executions" }],
			[
				"tasks",
				{ handler: tasksHandler, description: "List stored execution tasks" },
			],
			[
				"stats",
				{
					handler: statsHandler,
					description: "Show DAG persistence statistics",
				},
			],
		]);
	}
}

export default () => {
	const client: DagCommandClient = {
		dag: createDagServiceClient(createCliNrpcClientConfig()),
		runtime: createRuntimeDagServiceClient(
			createCliNrpcClientConfig({
				target: "centimanus",
				deadlineMs: 120_000,
			}),
		),
	};
	return new DagProcessor(client);
};
