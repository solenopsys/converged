import { createJsonFilterAdapter } from "back-core";
import type {
	AvailableWorkflow,
	DagService,
	DagVariable,
	Execution,
	FilterObject,
	PaginatedResult,
	PaginationParams,
	SelectionDescriptor,
	SelectionStats,
	Task,
	TaskTicket,
} from "g-dag";
import { Access } from "nrpc";
import { StoresController } from "./store";

const workflowFilters = createJsonFilterAdapter<AvailableWorkflow>({
	id: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	name: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	script: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
});

const variableFilters = createJsonFilterAdapter<DagVariable>({
	key: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
});

export default class DagServiceImpl implements DagService {
	private stores: StoresController;
	private readonly storesReady: Promise<void>;

	constructor(_config?: any) {
		this.stores = new StoresController("rp-dag");
		this.storesReady = this.stores.init().catch((error) => {
			console.error("[rp-dag] store init error", error);
			throw error;
		});
	}

	private async ensureStoresReady(): Promise<void> {
		await this.storesReady;
	}

	@Access("public")
	async listAvailableWorkflows(): Promise<{ items: AvailableWorkflow[] }> {
		const raw = process.env.WORKFLOWS ?? "[]";
		const endpoints = parseStringMap(process.env.WORKFLOW_ENDPOINTS);
		const digests = parseStringMap(process.env.WORKFLOW_DIGESTS);
		const proxy = process.env.MODULE_PROXY?.replace(/\/+$/, "");
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new Error("[rp-dag] WORKFLOWS must be valid JSON");
		}
		if (!Array.isArray(parsed))
			throw new Error("[rp-dag] WORKFLOWS must be an array");
		return {
			items: parsed.flatMap((value): AvailableWorkflow[] => {
				if (!value || typeof value !== "object") return [];
				const workflow = value as Record<string, unknown>;
				if (
					typeof workflow.name !== "string" ||
					typeof workflow.script !== "string"
				)
					return [];
				const sourceUrl =
					endpoints[workflow.script] ??
					(proxy && digests[workflow.script]
						? `${proxy}/${digests[workflow.script]}`
						: undefined);
				const parameters = asParameters(workflow.parameters);
				return [
					{
						id: typeof workflow.id === "string" ? workflow.id : workflow.name,
						name: workflow.name,
						script: workflow.script,
						...(typeof workflow.brief === "string"
							? { brief: workflow.brief }
							: {}),
						...(typeof workflow.description === "string"
							? { description: workflow.description }
							: {}),
						...(parameters ? { parameters } : {}),
						...(sourceUrl ? { sourceUrl } : {}),
					},
				];
			}),
		};
	}

	async listWorkflows(
		params: PaginationParams,
	): Promise<PaginatedResult<AvailableWorkflow>> {
		const workflows = (await this.listAvailableWorkflows()).items.filter(
			workflowFilters.predicate(params.filter),
		);
		const offset = params.offset ?? 0;
		const limit = params.limit ?? 50;
		return {
			items: workflows.slice(offset, offset + limit),
			totalCount: workflows.length,
		};
	}

	async openExecution(
		id: string,
		workflowName: string,
		params: Record<string, any>,
	): Promise<void> {
		await this.ensureStoresReady();
		await this.stores.statsStoreService.ensureProcess({
			id,
			workflowId: workflowName,
			status: "running",
		});
		this.stores.processingStoreService.saveExecutionContext(workflowName, id, {
			workflowName,
			params,
		});
		this.stores.processingStoreService.setStatus(id, "running");
	}

	async setExecutionStatus(
		id: string,
		status: "running" | "done" | "failed",
	): Promise<void> {
		await this.ensureStoresReady();
		await this.stores.statsStoreService.updateProcess(id, {
			status: status as any,
			updated_at: Date.now(),
		} as any);
		this.stores.processingStoreService.setStatus(id, status);
	}

	async createTask(executionId: string, nodeId: string): Promise<TaskTicket> {
		await this.ensureStoresReady();
		const row = await this.stores.statsStoreService.createNode({
			processId: executionId,
			nodeId,
			state: "queued",
			startedAt: null,
		});

		return {
			id: row.id,
			createdAt: (row as any).created_at ?? Date.now(),
		};
	}

	async setTaskDone(
		taskId: number,
		executionId: string,
		nodeId: string,
		completedAt: number,
		result: any,
	): Promise<void> {
		await this.ensureStoresReady();
		const kv = this.stores.processingStoreService;
		const recordId = `${executionId}:${nodeId}`;
		kv.setRecord(recordId, { data: null, result });
		kv.setStep(executionId, nodeId, recordId);
		await this.stores.statsStoreService.updateNode(taskId, {
			state: "done",
			completed_at: completedAt,
			record_id: recordId,
		} as any);
	}

	async setTaskFailed(
		taskId: number,
		completedAt: number,
		errorMessage: string,
	): Promise<void> {
		await this.ensureStoresReady();
		await this.stores.statsStoreService.updateNode(taskId, {
			state: "failed",
			error_message: errorMessage,
			completed_at: completedAt,
		} as any);
	}

	async statusExecution(
		id: string,
	): Promise<{ execution: Execution; tasks: Task[] }> {
		await this.ensureStoresReady();
		const process = await this.stores.statsStoreService.getProcess(id);
		if (!process) {
			throw Object.assign(new Error("Execution not found"), {
				statusCode: 404,
			});
		}

		const kv = this.stores.processingStoreService;
		const tasksResult = await this.stores.statsStoreService.listNodes({
			offset: 0,
			limit: 100,
			processId: id,
		} as any);

		return {
			execution: {
				id: process.id,
				workflowName:
					(process as any).workflow_id ?? (process as any).workflowId ?? "",
				status: process.status as any,
				startedAt:
					(process as any).started_at ?? (process as any).startedAt ?? 0,
				updatedAt:
					(process as any).updated_at ?? (process as any).updatedAt ?? 0,
				createdAt:
					(process as any).created_at ?? (process as any).createdAt ?? 0,
			},
			tasks: tasksResult.items.map((task) => {
				const record = task.recordId ? kv.getRecord(task.recordId) : undefined;
				return {
					id: task.id,
					executionId: task.processId,
					nodeId: task.nodeId,
					state: task.state as any,
					startedAt: task.startedAt ?? null,
					completedAt: task.completedAt ?? null,
					errorMessage: task.errorMessage ?? null,
					retryCount: task.retryCount,
					createdAt: task.createdAt ?? 0,
					data: record?.data,
					result: record?.result,
				};
			}),
		};
	}

	async listExecutions(
		params: PaginationParams,
	): Promise<PaginatedResult<Execution>> {
		await this.ensureStoresReady();
		const result = await this.stores.statsStoreService.listProcesses(
			params as any,
		);
		return {
			items: result.items.map((process) => ({
				id: process.id,
				workflowName: process.workflowId ?? "",
				status: process.status as any,
				startedAt: process.startedAt ?? 0,
				updatedAt: process.updatedAt ?? 0,
				createdAt: process.createdAt ?? 0,
			})),
			totalCount: result.totalCount,
		};
	}

	async listTasks(
		executionId: string | null,
		params: PaginationParams,
	): Promise<PaginatedResult<Task>> {
		await this.ensureStoresReady();
		const filter = executionId ? { ...params, processId: executionId } : params;
		const result = await this.stores.statsStoreService.listNodes(filter as any);
		return {
			items: result.items.map((task) => ({
				id: task.id,
				executionId: task.processId,
				nodeId: task.nodeId,
				state: task.state as any,
				startedAt: task.startedAt ?? null,
				completedAt: task.completedAt ?? null,
				errorMessage: task.errorMessage ?? null,
				retryCount: task.retryCount,
				createdAt: task.createdAt ?? 0,
			})),
			totalCount: result.totalCount,
		};
	}

	async stats() {
		await this.ensureStoresReady();
		const [executions, tasks, executionsDaily, executionsTypes, nodesDaily] =
			await Promise.all([
				this.stores.statsStoreService.getProcessStats(),
				this.stores.statsStoreService.getNodeStats(),
				this.stores.statsStoreService.getProcessDailyStats({ days: 30 }),
				this.stores.statsStoreService.getProcessTypeStats(),
				this.stores.statsStoreService.getNodeDailyStats({ days: 30 }),
			]);
		return { executions, tasks, executionsDaily, executionsTypes, nodesDaily };
	}

	async listVars(): Promise<{ items: { key: string; value: any }[] }> {
		await this.ensureStoresReady();
		const items = this.stores.processingStoreService.listVars();
		return { items };
	}

	async listVariables(
		params: PaginationParams,
	): Promise<PaginatedResult<DagVariable>> {
		await this.ensureStoresReady();
		const items = this.stores.processingStoreService
			.listVars()
			.filter(variableFilters.predicate(params.filter));
		const offset = params.offset ?? 0;
		const limit = params.limit ?? 50;
		return {
			items: items.slice(offset, offset + limit),
			totalCount: items.length,
		};
	}

	async setVar(key: string, value: any): Promise<void> {
		await this.ensureStoresReady();
		this.stores.processingStoreService.set(key, value);
	}

	async deleteVar(key: string): Promise<void> {
		await this.ensureStoresReady();
		this.stores.processingStoreService.delete(key);
	}

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		const fields = {
			"dag.workflow": [
				{
					id: "name",
					label: "Workflow",
					valueType: "string" as const,
					operators: ["eq", "in", "contains", "startsWith"],
				},
				{
					id: "script",
					label: "Script",
					valueType: "string" as const,
					operators: ["eq", "in", "contains", "startsWith"],
				},
			],
			"dag.execution": [
				{
					id: "workflowName",
					label: "Workflow",
					valueType: "string" as const,
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "status",
					label: "Status",
					valueType: "enum" as const,
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "updatedAt",
					label: "Updated",
					valueType: "number" as const,
					operators: ["gt", "gte", "lt", "lte", "between"],
				},
			],
			"dag.task": [
				{
					id: "executionId",
					label: "Execution",
					valueType: "string" as const,
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "nodeId",
					label: "Node",
					valueType: "string" as const,
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "state",
					label: "State",
					valueType: "enum" as const,
					operators: ["eq", "in", "notEq", "notIn"],
				},
			],
			"dag.variable": [
				{
					id: "key",
					label: "Key",
					valueType: "string" as const,
					operators: ["eq", "in", "contains", "startsWith"],
				},
			],
		}[objectType];
		if (!fields)
			throw new Error(`Unsupported DAG selection object: ${objectType}`);
		return {
			objectType,
			title: objectType.replace("dag.", "DAG "),
			fields,
			revision: "dag-v1",
		};
	}

	async inspectSelection(
		objectType: string,
		filter?: FilterObject,
	): Promise<SelectionStats> {
		if (objectType === "dag.workflow") {
			return {
				totalCount:
					(await this.listWorkflows({ offset: 0, limit: 0, filter }))
						.totalCount ?? 0,
			};
		}
		if (objectType === "dag.execution") {
			return {
				totalCount:
					(await this.listExecutions({ offset: 0, limit: 0, filter }))
						.totalCount ?? 0,
			};
		}
		if (objectType === "dag.task") {
			return {
				totalCount:
					(await this.listTasks(null, { offset: 0, limit: 0, filter }))
						.totalCount ?? 0,
			};
		}
		if (objectType === "dag.variable") {
			return {
				totalCount:
					(await this.listVariables({ offset: 0, limit: 0, filter }))
						.totalCount ?? 0,
			};
		}
		throw new Error(`Unsupported DAG selection object: ${objectType}`);
	}
}

function asParameters(
	value: unknown,
): AvailableWorkflow["parameters"] | undefined {
	if (!value || typeof value !== "object") return undefined;
	const parameters = value as Record<string, unknown>;
	if (
		parameters.type !== "object" ||
		!parameters.properties ||
		typeof parameters.properties !== "object"
	)
		return undefined;
	if (
		parameters.required !== undefined &&
		(!Array.isArray(parameters.required) ||
			parameters.required.some((item) => typeof item !== "string"))
	)
		return undefined;
	return {
		type: "object",
		properties: parameters.properties as Record<string, unknown>,
		...(parameters.required
			? { required: parameters.required as string[] }
			: {}),
	};
}

function parseStringMap(raw: string | undefined): Record<string, string> {
	if (!raw) return {};
	try {
		const value = JSON.parse(raw);
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string",
			),
		);
	} catch {
		return {};
	}
}
