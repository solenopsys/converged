import type {
	AvailableWorkflow,
	CachedNodeResult,
	DagService,
	Execution,
	PaginatedResult,
	PaginationParams,
	ResumableExecution,
	Task,
	TaskTicket,
} from "g-dag";
import { StoresController } from "./store";

export default class DagServiceImpl implements DagService {
	private stores: StoresController;
	private readonly storesReady: Promise<void>;

	constructor(_config?: any) {
		this.stores = new StoresController("dag-ms");
		this.storesReady = this.stores.init().catch((error) => {
			console.error("[dag-ms] store init error", error);
			throw error;
		});
	}

	private async ensureStoresReady(): Promise<void> {
		await this.storesReady;
	}

	async listAvailableWorkflows(): Promise<{ items: AvailableWorkflow[] }> {
		const raw = process.env.WORKFLOWS ?? "[]";
		const endpoints = parseStringMap(process.env.WORKFLOW_ENDPOINTS);
		const digests = parseStringMap(process.env.WORKFLOW_DIGESTS);
		const proxy = process.env.MODULE_PROXY?.replace(/\/+$/, "");
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new Error("[ms-dag] WORKFLOWS must be valid JSON");
		}
		if (!Array.isArray(parsed))
			throw new Error("[ms-dag] WORKFLOWS must be an array");
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

	async listResumableExecutions(
		limit = 200,
	): Promise<{ items: ResumableExecution[] }> {
		await this.ensureStoresReady();

		const safeLimit =
			Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200;
		const stats = this.stores.statsStoreService;
		const kv = this.stores.processingStoreService;
		const running = await stats.listProcesses({
			offset: 0,
			limit: safeLimit,
			status: "running",
		} as any);
		const items: ResumableExecution[] = [];

		for (const process of running.items) {
			const executionId = process.id;
			const workflowName = process.workflowId ?? "";

			if (!workflowName) {
				await stats.updateProcess(executionId, {
					status: "failed",
					updated_at: Date.now(),
				} as any);
				continue;
			}

			const context = kv.getExecutionContext(workflowName, executionId);
			const params =
				context && context.meta && typeof context.meta === "object"
					? (context.meta as any).params
					: undefined;

			if (!params || typeof params !== "object") {
				await stats.updateProcess(executionId, {
					status: "failed",
					updated_at: Date.now(),
				} as any);
				console.warn(
					`[dag-ms] skip resume execution=${executionId} workflow=${workflowName}: missing params in execution context`,
				);
				continue;
			}

			items.push({
				id: executionId,
				workflowName,
				params: params as Record<string, any>,
			});
		}

		return { items };
	}

	async getCachedNodeResult(
		executionId: string,
		nodeId: string,
	): Promise<CachedNodeResult> {
		await this.ensureStoresReady();
		const kv = this.stores.processingStoreService;
		const cachedRecordId = kv.getStep(executionId, nodeId);
		if (cachedRecordId === undefined) {
			return { hit: false };
		}

		const cached = kv.getRecord(cachedRecordId);
		if (cached === undefined) {
			return { hit: false };
		}

		return { hit: true, result: cached.result };
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

	async setTaskProcessing(taskId: number, startedAt: number): Promise<void> {
		await this.ensureStoresReady();
		await this.stores.statsStoreService.updateNode(taskId, {
			state: "processing",
			started_at: startedAt,
		} as any);
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

	async setVar(key: string, value: any): Promise<void> {
		await this.ensureStoresReady();
		this.stores.processingStoreService.set(key, value);
	}

	async deleteVar(key: string): Promise<void> {
		await this.ensureStoresReady();
		this.stores.processingStoreService.delete(key);
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
