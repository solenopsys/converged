import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
	printJson,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import {
	type CentimanusServiceClient,
	createCentimanusServiceClient,
} from "g-centimanus/browser";
import { createDagServiceClient, type DagServiceClient } from "g-dag/browser";

type DagCommandClient = {
	dag: DagServiceClient;
	centimanus: CentimanusServiceClient;
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

	const result = await client.centimanus.runWorkflow(
		config.scriptPath,
		config.params ?? {},
	);
	printJson(result);
};

/** The whole run as a tree: every node, and under a delegating node the nodes
 *  of the run it delegated to. */
const treeHandler: Handler = async (
	client: DagCommandClient,
	_splitter: string,
	param?: string,
) => {
	if (!param) {
		console.error("Usage: dag tree <executionId>");
		return;
	}
	printJson(await client.dag.executionTree(param));
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

const triggersHandler: Handler = async (client: DagCommandClient) => {
	printJson(await client.dag.listTriggers({ offset: 0, limit: 100 }));
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
			["tree", { handler: treeHandler, description: "Show a run's node tree" }],
			["list", { handler: listHandler, description: "List stored executions" }],
			[
				"triggers",
				{ handler: triggersHandler, description: "List configured triggers" },
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
		centimanus: createCentimanusServiceClient(
			createCliNrpcClientConfig({ deadlineMs: 120_000 }),
		),
	};
	return new DagProcessor(client);
};
