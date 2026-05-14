import type { ExecutableTool } from "assistant-state";
import { addMessage, createChatStore } from "assistant-state";
import { $files, openFilePicker, uploadCompleted } from "files-state";
import {
	chatAttachRequested,
	chatInitRequested,
	chatSendRequested,
	registry,
	setCenterView,
} from "front-core";
import type {
	RequestModel,
	RequestProcessType,
	RequestRequirementProfile,
} from "g-requests";
import { v4 as uuidv4 } from "uuid";
import { MessageType } from "../../../../../tools/integration/types/services/communications/threads";
import {
	assistantClient,
	chatClient,
	dagClient,
	requestsClient,
	threadsClient,
} from "./services";

// AI-доступные команды (только меню и навигация)
const AI_COMMANDS: Record<string, string> = {
	// Requests
	"requests.show": "Открыть панель заявок",
	// Threads
	"threads.show": "Открыть диалоги/треды",
	// Layouts
	"dashboard.mount": "Открыть дашборд",
	// Logs
	"logs.show": "Показать горячие логи",
	"logs.show.cold": "Показать холодные логи",
	// Telemetry
	"telemetry.show": "Показать горячую телеметрию",
	"telemetry.show.cold": "Показать холодную телеметрию",
	// Dumps
	"dumps.list.show": "Показать список дампов",
	"dumps.storages.show": "Показать статистику хранилищ",
	// DAG
	show_workflows_list: "Показать список воркфлоу",
	show_workflows_statistic: "Показать статистику воркфлоу",
	show_nodes_list: "Показать список нод",
	show_providers_list: "Показать список провайдеров",
	show_code_source_list: "Показать список источников кода",
	// AI Chats
	"chats.show_list": "Показать список чатов",
	"chats.show_contexts_list": "Показать список контекстов",
	"chats.show_commands_list": "Показать список команд",
};

const chatStore = createChatStore(chatClient, threadsClient, assistantClient);
const chatThreadId = uuidv4();

// Флаг для ленивой инициализации
let isInitialized = false;
let isRegistered = false;
let activeRequestId: string | undefined;
let pendingInitialRequestPromise: Promise<void> | null = null;

type RequestDraftArgs = {
	status?: string;
	processType?: RequestProcessType;
	title?: string;
	summary?: string;
	fields?: Record<string, any>;
	parameters?: Array<Record<string, any>>;
	fieldDefinitions?: Array<Record<string, any>>;
	files?: Record<string, string>;
	comment?: string;
	forceNew?: boolean;
};

const registerThread = () => {
	if (isRegistered) return;
	isRegistered = true;
	void assistantClient
		.registerChat(chatThreadId, `Chat ${chatThreadId.slice(0, 8)}`)
		.catch((error) => {
			isRegistered = false;
			console.warn(
				"[Chat] Failed to register chat in assistant service",
				error,
			);
		});
};

const ensureInitialized = (contextName?: string) => {
	const currentContextName = chatStore.$chat.getState().contextName;
	const shouldSwitchContext =
		contextName !== undefined && currentContextName !== contextName;
	if (!isInitialized || shouldSwitchContext) {
		console.log("[Chat] Initializing chat session on first use", {
			contextName,
		});
		registerThread();
		chatStore.init(chatThreadId, undefined, undefined, contextName);
		isInitialized = true;
	}
};

// Подписываемся на событие инициализации из front-core
chatInitRequested.watch((payload) => {
	console.log("[Chat] Chat initialization requested via event");
	ensureInitialized(
		payload && typeof payload === "object" ? payload.contextName : undefined,
	);
});

// Экспортируем функцию для явной инициализации
export const initializeChat = (contextName?: string) => {
	ensureInitialized(contextName);
};

const weatherTool: ExecutableTool = {
	name: "weather",
	description: "Get the current weather",
	parameters: {
		type: "object",
		properties: {
			city: {
				type: "string",
				description: "The city to get the weather for",
			},
		},
		required: ["city"],
	},
	execute: async (args: { city: string }) => {
		const city = args.city;
		return { city, temperature: 29, pressure: 1013, windSpeed: 5 };
	},
};

const parseToolArgs = <T extends Record<string, any>>(
	args: T | string | undefined,
): T => {
	if (!args) return {} as T;
	if (typeof args !== "string") return args;

	try {
		return JSON.parse(args) as T;
	} catch {
		return {} as T;
	}
};

const normalizeRecord = (value: unknown): Record<string, any> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, any>;
};

const normalizeParameters = (value: unknown): Array<Record<string, any>> => {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is Record<string, any> =>
			Boolean(item) && typeof item === "object" && !Array.isArray(item),
	);
};

const hasPatchPayload = (args: RequestDraftArgs) =>
	Boolean(
		args.status !== undefined ||
			args.processType !== undefined ||
			args.title !== undefined ||
			args.summary !== undefined ||
			Object.keys(normalizeRecord(args.fields)).length > 0 ||
			normalizeParameters(args.parameters).length > 0 ||
			normalizeParameters(args.fieldDefinitions).length > 0 ||
			Object.keys(normalizeRecord(args.files)).length > 0,
	);

const requestFieldsSnapshot = (model?: Partial<RequestModel>) => {
	if (!model?.fields) return {};
	return Object.fromEntries(
		Object.entries(model.fields).map(([key, field]) => [key, field.value]),
	);
};

const requestModelSummary = (model?: Partial<RequestModel>) => {
	if (!model) return undefined;
	return {
		id: model.id,
		status: model.status,
		processType: model.processType,
		revision: model.revision,
		title: model.title,
		fields: requestFieldsSnapshot(model),
		remainingRequired: model.remainingRequired ?? model.missingRequired,
		completion: model.completion,
		updatedAt: model.updatedAt,
	};
};

const requestArgsSummary = (args: RequestDraftArgs) => ({
	status: args.status,
	processType: args.processType,
	title: args.title,
	summary: args.summary,
	fields: normalizeRecord(args.fields),
	parameters: normalizeParameters(args.parameters).map((parameter) => ({
		key: parameter.key,
		value: parameter.value,
		label: parameter.label,
	})),
	fieldDefinitions: normalizeParameters(args.fieldDefinitions).map(
		(definition) => ({
			key: definition.key,
			label: definition.label,
			required: definition.required,
		}),
	),
	files: normalizeRecord(args.files),
	forceNew: args.forceNew,
});

const logRequestFlow = (step: string, payload?: Record<string, any>) => {
	console.info(`[request-flow] ${step}`, payload ?? {});
};

const openRequestPage = (model: { id: string }) => {
	if (typeof window === "undefined" || !model.id) return;

	const nextPath = `/request/${model.id}`;
	const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;

	logRequestFlow("ui.open.start", {
		nextUrl,
		model: requestModelSummary(model as RequestModel),
	});
	setCenterView(null);
	const event = new CustomEvent("request:open", {
		cancelable: true,
		detail: { requestId: model.id, model, path: nextUrl },
	});
	const handledBySsrShell = !window.dispatchEvent(event);
	logRequestFlow("ui.request-open.dispatched", {
		requestId: model.id,
		handledBySsrShell,
		currentPath: window.location.pathname,
	});

	if (!handledBySsrShell && window.location.pathname !== nextPath) {
		window.history.pushState({ requestId: model.id }, "", nextUrl);
		window.dispatchEvent(new PopStateEvent("popstate"));
	}
	logRequestFlow("ui.model-updated.dispatch", {
		model: requestModelSummary(model as RequestModel),
	});
	window.dispatchEvent(
		new CustomEvent("request:model-updated", { detail: model }),
	);
};

const requestModelToolPayload = (model: RequestModel) => {
	const collectedFields = Object.fromEntries(
		Object.entries(model.fields)
			.filter(([, field]) => field.value !== undefined)
			.map(([key, field]) => [key, field.value]),
	);

	return {
		model,
		collectedFields,
		remainingRequired: model.remainingRequired ?? model.missingRequired ?? [],
		remainingDelta: model.remainingDelta ?? [],
		completion: model.completion,
	};
};

const inferInitialRequestDraft = (message: string): RequestDraftArgs | null => {
	const text = message.trim();
	if (text.length < 4) return null;

	return {
		status: "draft",
		title: "Производственная заявка",
		summary: text,
		fields: {},
		comment: "created from initial chat message",
	};
};

const createOrUpdateRequestDraft = async (
	args: RequestDraftArgs,
	options: { preferExisting?: boolean } = {},
) => {
	const fields = normalizeRecord(args.fields);
	const parameters = normalizeParameters(args.parameters);
	const files = Object.fromEntries(
		Object.entries(normalizeRecord(args.files)).filter(
			([, value]) => typeof value === "string",
		),
	) as Record<string, string>;
	const preferExisting = options.preferExisting ?? !args.forceNew;

	if (preferExisting && activeRequestId) {
		logRequestFlow("ms-requests.patch.start", {
			requestId: activeRequestId,
			args: requestArgsSummary(args),
		});
		const model = await requestsClient.applyRequestUpdate(
			activeRequestId,
			{
				status: args.status,
				processType: args.processType,
				title: args.title,
				summary: args.summary,
				fields,
				parameters: parameters as any,
				fieldDefinitions: normalizeParameters(args.fieldDefinitions) as any,
				files,
			},
			"assistant",
			args.comment || "updated by assistant",
		);
		activeRequestId = model.id;
		logRequestFlow("ms-requests.patch.done", {
			reusedActiveRequest: true,
			model: requestModelSummary(model),
		});
		openRequestPage(model);
		return { model, reusedActiveRequest: true };
	}

	logRequestFlow("ms-requests.create.start", {
		args: requestArgsSummary(args),
	});
	const model = await requestsClient.createRequestModel({
		source: "assistant:request",
		status: args.status || "draft",
		processType: args.processType,
		title: args.title,
		summary: args.summary,
		fields,
		parameters: parameters as any,
		fieldDefinitions: normalizeParameters(args.fieldDefinitions) as any,
		files,
	});
	activeRequestId = model.id;
	logRequestFlow("ms-requests.create.done", {
		reusedActiveRequest: false,
		model: requestModelSummary(model),
	});
	openRequestPage(model);
	return { model, reusedActiveRequest: false };
};

const ensureInitialRequestDraft = async (message: string): Promise<boolean> => {
	const isRequestContext = chatStore.$chat.getState().contextName === "request";
	if (!isRequestContext || activeRequestId) {
		logRequestFlow("auto-create.skip", {
			reason: !isRequestContext
				? "not_request_context"
				: "active_request_exists",
			activeRequestId,
		});
		return false;
	}

	const draft = inferInitialRequestDraft(message);
	if (!draft) {
		logRequestFlow("auto-create.skip", {
			reason: "no_manufacturing_draft_inferred",
			message,
		});
		return false;
	}
	logRequestFlow("auto-create.inferred", {
		message,
		args: requestArgsSummary(draft),
	});

	let created = false;
	if (!pendingInitialRequestPromise) {
		pendingInitialRequestPromise = (async () => {
			const { model } = await createOrUpdateRequestDraft(draft, {
				preferExisting: false,
			});
			created = true;
			console.info("[Chat] Auto-created request draft from first message", {
				requestId: model.id,
				processType: model.processType,
			});
		})()
			.catch((error) => {
				console.warn("[Chat] Failed to auto-create request draft", error);
			})
			.finally(() => {
				pendingInitialRequestPromise = null;
			});
	}

	await pendingInitialRequestPromise;
	return created;
};

const getUploadedChatFilesTool: ExecutableTool = {
	name: "getUploadedChatFiles",
	description:
		"Get files uploaded in the current chat with their storage file IDs",
	parameters: {
		type: "object",
		properties: {},
		required: [],
	},
	execute: async () => {
		const files = Array.from($files.getState().entries()).map(
			([fileId, file]) => ({
				fileId,
				fileName: file.fileName,
				fileSize: file.fileSize,
				fileType: file.fileType,
				status: file.status,
			}),
		);

		return { files };
	},
};

const getCncRequestRequirementsTool: ExecutableTool = {
	name: "getCncRequestRequirements",
	description:
		"Inspect request requirement profiles from ms-requests JSON store. Do not use before createCncRequest for an ordinary user job description; createCncRequest can infer and normalize fields.",
	parameters: {
		type: "object",
		properties: {
			processType: {
				type: "string",
				description:
					"Optional process profile: cnc_machining, 3d_printing, laser_cutting, plastic_cutting or generic",
			},
		},
		required: [],
	},
	execute: async (
		rawArgs:
			| {
					processType?: RequestProcessType;
			  }
			| string
			| undefined,
	) => {
		const args = parseToolArgs(rawArgs);
		if (args.processType) {
			const profile = await requestsClient.getRequestRequirementProfile(
				args.processType,
			);
			return { ok: true, profile };
		}

		const profiles = (await requestsClient.listRequestRequirementProfiles()) as
			| RequestRequirementProfile[]
			| undefined;
		return { ok: true, profiles: profiles ?? [] };
	},
};

const createCncRequestTool: ExecutableTool = {
	name: "createCncRequest",
	description:
		"Create the manufacturing request draft as the first tool call for a real user job description. Send collected values as fields map; aliases are normalized by ms-requests. If a draft is already active, enrich that draft instead of duplicating it.",
	parameters: {
		type: "object",
		properties: {
			status: {
				type: "string",
				description:
					"Initial request status, usually new or needs_clarification",
			},
			fields: {
				type: "object",
				description:
					"Flat map of collected values. Prefer canonical keys such as part_description, material, quantity, dimensions, tolerances, color, infill; raw aliases are accepted and normalized by ms-requests.",
			},
			parameters: {
				type: "array",
				description:
					"Alternative dynamic parameter list. Use when you have named fields with metadata such as label, type, unit, required or confidence.",
				items: {
					type: "object",
					properties: {
						key: { type: "string" },
						value: {},
						label: { type: "string" },
						type: { type: "string" },
						required: { type: "boolean" },
						group: { type: "string" },
						unit: { type: "string" },
						confidence: { type: "number" },
					},
					required: ["key", "value"],
				},
			},
			fieldDefinitions: {
				type: "array",
				description:
					"Optional dynamic field definitions for corporate-specific requirements.",
				items: {
					type: "object",
				},
			},
			processType: {
				type: "string",
				description:
					"Request process profile. Use 3d_printing for 3D/FDM/SLA/STL/ABS print requests, cnc_machining for milling/turning/CNC, laser_cutting/plastic_cutting for cutting, or generic when unclear.",
			},
			title: {
				type: "string",
				description: "Short human readable request title",
			},
			summary: {
				type: "string",
				description: "Compact request summary visible on the request page",
			},
			files: {
				type: "object",
				description: "Map of semantic file labels to ms-files file IDs",
			},
			comment: {
				type: "string",
				description: "Short note explaining why the request was created",
			},
			forceNew: {
				type: "boolean",
				description:
					"Set true only when the user explicitly wants a separate new request instead of enriching the active draft.",
			},
		},
		required: ["fields"],
	},
	execute: async (rawArgs: RequestDraftArgs | string) => {
		const args = parseToolArgs(rawArgs);
		logRequestFlow("tool.createCncRequest.received", {
			activeRequestId,
			hasPayload: hasPatchPayload(args),
			args: requestArgsSummary(args),
		});
		if (activeRequestId && !hasPatchPayload(args)) {
			const model = await requestsClient.getRequestModel(activeRequestId);
			logRequestFlow("tool.createCncRequest.noop", {
				requestId: activeRequestId,
				reason: "empty_payload_for_active_request",
				model: requestModelSummary(model),
			});
			return {
				ok: false,
				requestId: activeRequestId,
				error:
					"createCncRequest was called with an active request but no fields provided. Do not call createCncRequest or patchCncRequest again with empty arguments. Call patchCncRequest only if you have concrete fields/files/status/title/summary to apply; otherwise answer the user and ask only for truly unknown fields.",
				hint: "Stop calling request tools with empty arguments. Respond to the user unless you can provide a non-empty patch payload.",
				...(model ? requestModelToolPayload(model) : {}),
			};
		}
		const { model, reusedActiveRequest } =
			await createOrUpdateRequestDraft(args);
		logRequestFlow("tool.createCncRequest.result", {
			ok: true,
			requestId: model.id,
			reusedActiveRequest,
			appliedFields: normalizeRecord(args.fields),
			model: requestModelSummary(model),
		});

		return {
			ok: true,
			requestId: model.id,
			status: model.status,
			reusedActiveRequest,
			appliedFields: normalizeRecord(args.fields),
			...requestModelToolPayload(model),
			comment: args.comment,
		};
	},
};

const patchCncRequestTool: ExecutableTool = {
	name: "patchCncRequest",
	description:
		"Patch an existing manufacturing request with a fields map, files, status or request-specific field definitions. Returns enriched model and remaining delta.",
	parameters: {
		type: "object",
		properties: {
			requestId: {
				type: "string",
				description:
					"Existing request ID. May be omitted when patching the active request created in this chat.",
			},
			status: {
				type: "string",
				description: "New request status if it changed",
			},
			fields: {
				type: "object",
				description:
					"Flat map of newly collected values keyed by canonical request requirement keys",
			},
			parameters: {
				type: "array",
				description:
					"Named dynamic parameters to merge into the server-side request model",
				items: { type: "object" },
			},
			fieldDefinitions: {
				type: "array",
				description:
					"Dynamic field definitions to add or update for this request",
				items: { type: "object" },
			},
			processType: {
				type: "string",
				description: "Optional process profile override",
			},
			title: {
				type: "string",
				description: "Optional request title",
			},
			summary: {
				type: "string",
				description: "Optional request summary",
			},
			files: {
				type: "object",
				description: "File labels to merge into the existing request files map",
			},
			comment: {
				type: "string",
				description: "Short processing history comment",
			},
		},
		required: [],
	},
	execute: async (
		rawArgs:
			| {
					requestId?: string;
					status?: string;
					processType?: any;
					title?: string;
					summary?: string;
					fields?: Record<string, any>;
					parameters?: Array<Record<string, any>>;
					fieldDefinitions?: Array<Record<string, any>>;
					files?: Record<string, string>;
					comment?: string;
			  }
			| string,
	) => {
		const args = parseToolArgs(rawArgs);
		const requestId = args.requestId || activeRequestId;
		logRequestFlow("tool.patchCncRequest.received", {
			requestId,
			activeRequestId,
			hasPayload: hasPatchPayload(args),
			args: requestArgsSummary(args),
		});
		if (!requestId) {
			logRequestFlow("tool.patchCncRequest.noop", {
				reason: "missing_request_id",
				args: requestArgsSummary(args),
			});
			return {
				ok: false,
				error: "requestId is required because no active request exists",
			};
		}
		if (!hasPatchPayload(args)) {
			const model = await requestsClient.getRequestModel(requestId);
			logRequestFlow("tool.patchCncRequest.noop", {
				requestId,
				reason: "empty_payload",
				model: requestModelSummary(model),
			});
			return {
				ok: false,
				requestId,
				error:
					"patchCncRequest received no fields/files/status/title/summary to apply. Do not call patchCncRequest again with empty arguments; respond to the user or ask for the missing information.",
				hint: "Stop calling patchCncRequest until you have a non-empty patch payload.",
				...(model ? requestModelToolPayload(model) : {}),
			};
		}

		const files = Object.fromEntries(
			Object.entries(normalizeRecord(args.files)).filter(
				([, value]) => typeof value === "string",
			),
		) as Record<string, string>;

		const model = await requestsClient.applyRequestUpdate(
			requestId,
			{
				status: args.status,
				processType: args.processType,
				title: args.title,
				summary: args.summary,
				fields: normalizeRecord(args.fields),
				parameters: normalizeParameters(args.parameters) as any,
				fieldDefinitions: normalizeParameters(args.fieldDefinitions) as any,
				files,
			},
			"assistant",
			args.comment || "updated by assistant",
		);
		activeRequestId = model.id;
		openRequestPage(model);
		logRequestFlow("tool.patchCncRequest.result", {
			ok: true,
			requestId,
			appliedFields: normalizeRecord(args.fields),
			model: requestModelSummary(model),
		});

		return {
			ok: true,
			requestId,
			appliedFields: normalizeRecord(args.fields),
			...requestModelToolPayload(model),
		};
	},
};

const getCncRequestTool: ExecutableTool = {
	name: "getCncRequest",
	description: "Get a CNC request by ID from ms-requests",
	parameters: {
		type: "object",
		properties: {
			requestId: {
				type: "string",
				description: "Request ID",
			},
		},
		required: ["requestId"],
	},
	execute: async (rawArgs: { requestId?: string } | string) => {
		const args = parseToolArgs(rawArgs);
		if (!args.requestId) {
			if (!activeRequestId) {
				return { ok: false, error: "requestId is required" };
			}
			args.requestId = activeRequestId;
		}

		const model = await requestsClient.getRequestModel(args.requestId);
		if (model) {
			activeRequestId = model.id;
			openRequestPage(model);
		}
		return model
			? { ok: true, request: model, ...requestModelToolPayload(model) }
			: { ok: true, request: model };
	},
};

const startFileAnalysisTool: ExecutableTool = {
	name: "startFileAnalysis",
	description:
		"Run the pure file-analysis workflow for uploaded ms-files file IDs and return produced metadata/artifacts",
	parameters: {
		type: "object",
		properties: {
			fileIds: {
				type: "array",
				description: "List of ms-files file IDs to analyze",
				items: {
					type: "string",
					description: "ms-files file ID",
				},
			},
			target: {
				type: "string",
				description: "Analysis target",
				enum: ["cnc", "print", "generic"],
			},
			convertPreview: {
				type: "boolean",
				description:
					"Whether the workflow should try to create preview model artifacts",
			},
			includeGcode: {
				type: "boolean",
				description: "Whether extractors may return generated G-code artifacts",
			},
			maxArchiveDepth: {
				type: "number",
				description: "Maximum archive recursion depth",
			},
		},
		required: ["fileIds"],
	},
	execute: async (
		rawArgs:
			| {
					fileIds?: string[];
					target?: "cnc" | "print" | "generic";
					convertPreview?: boolean;
					includeGcode?: boolean;
					maxArchiveDepth?: number;
			  }
			| string,
	) => {
		const args = parseToolArgs(rawArgs);
		const fileIds = Array.isArray(args.fileIds)
			? args.fileIds.filter(
					(fileId): fileId is string =>
						typeof fileId === "string" && fileId.length > 0,
				)
			: [];

		if (fileIds.length === 0) {
			return { ok: false, error: "fileIds must contain at least one file ID" };
		}

		let executionId: string | undefined;
		let result: any = null;

		for await (const event of dagClient.startExecution("file-analysis", {
			fileIds,
			options: {
				target: args.target || "cnc",
				convertPreview: args.convertPreview ?? true,
				includeGcode: args.includeGcode ?? false,
				maxArchiveDepth: args.maxArchiveDepth ?? 2,
			},
		})) {
			executionId = event.executionId;
			if (
				event.type === "task_update" &&
				event.task?.nodeId === "final-result" &&
				event.task.result
			) {
				result = event.task.result;
			}
			if (event.type === "failed") {
				return { ok: false, executionId, error: event.error };
			}
		}

		// Автоматически прикрепляем файлы к активной заявке
		if (result && activeRequestId) {
			const files: Record<string, string> = {};

			// Входные файлы
			for (const f of result.inputs ?? []) {
				if (f.fileId && f.name) files[f.name] = f.fileId;
			}
			// Извлечённые из архива
			for (const f of result.extracted ?? []) {
				if (f.fileId && f.name) files[f.name] = f.fileId;
			}
			// Конвертированные превью (GLB и т.д.)
			for (const f of result.converted ?? []) {
				if (f.fileId && f.name) files[f.name] = f.fileId;
			}

			if (Object.keys(files).length > 0) {
				try {
					const updated = await requestsClient.applyRequestUpdate(
						activeRequestId,
						{ files, status: "file_analysis_done" },
						"assistant",
						"files attached after analysis",
					);
					openRequestPage(updated);
					result = { ...result, attachedFiles: Object.keys(files).length };
				} catch (e: any) {
					console.warn("[FileAnalysis] Failed to attach files to request", e);
				}
			}
		}

		return { ok: true, executionId, result };
	},
};

// Tool для получения списка доступных команд (только AI-доступные)
const getCommandsTool: ExecutableTool = {
	name: "getCommands",
	description: "Get available UI navigation commands",
	parameters: {
		type: "object",
		properties: {},
		required: [],
	},
	execute: async () => {
		return Object.entries(AI_COMMANDS).map(([id, desc]) => ({ id, desc }));
	},
};

// Tool для выполнения команды (только из AI_COMMANDS whitelist)
const execCommandTool: ExecutableTool = {
	name: "execCommand",
	description: "Execute UI navigation command by id",
	parameters: {
		type: "object",
		properties: {
			id: {
				type: "string",
				description: "Command id from getCommands",
			},
		},
		required: ["id"],
	},
	execute: async (args: { id: string } | string) => {
		console.log("[execCommand] Raw args:", args, typeof args);

		// Парсим аргументы - могут прийти как объект или как строка JSON
		let commandId: string | undefined;
		if (typeof args === "string") {
			try {
				const parsed = JSON.parse(args);
				commandId = parsed.id;
			} catch {
				commandId = args;
			}
		} else {
			commandId = args?.id;
		}

		console.log("[execCommand] Parsed commandId:", commandId);
		console.log("[execCommand] Registered commands:", registry.getAllIds());

		// Проверяем что команда указана
		if (!commandId) {
			addMessage({
				id: `cmd_err_${Date.now()}`,
				type: "assistant",
				content: `⚠️ Не указан id команды`,
				timestamp: Date.now(),
			});
			return { ok: false, error: "Command id not provided" };
		}

		// Проверяем что команда в whitelist
		if (!AI_COMMANDS[commandId]) {
			addMessage({
				id: `cmd_err_${Date.now()}`,
				type: "assistant",
				content: `⚠️ Команда \`${commandId}\` недоступна`,
				timestamp: Date.now(),
			});
			return { ok: false, error: "Command not allowed" };
		}

		const cmd = registry.get(commandId);
		if (!cmd) {
			console.log("[execCommand] Command not found in registry:", commandId);
			addMessage({
				id: `cmd_err_${Date.now()}`,
				type: "assistant",
				content: `⚠️ Команда \`${commandId}\` не зарегистрирована`,
				timestamp: Date.now(),
			});
			return { ok: false, error: "Command not registered" };
		}

		try {
			registry.run(commandId, {});
			addMessage({
				id: `cmd_${Date.now()}`,
				type: "assistant",
				content: `✅ ${AI_COMMANDS[commandId]}`,
				timestamp: Date.now(),
			});
			return { ok: true };
		} catch (e) {
			addMessage({
				id: `cmd_err_${Date.now()}`,
				type: "assistant",
				content: `❌ Ошибка: ${AI_COMMANDS[commandId]}`,
				timestamp: Date.now(),
			});
			return { ok: false, error: e instanceof Error ? e.message : "Error" };
		}
	},
};

chatStore.registerFunction("weather", weatherTool);
chatStore.registerFunction("getUploadedChatFiles", getUploadedChatFilesTool);
chatStore.registerFunction("createCncRequest", createCncRequestTool);
chatStore.registerFunction(
	"getCncRequestRequirements",
	getCncRequestRequirementsTool,
);
chatStore.registerFunction("patchCncRequest", patchCncRequestTool);
chatStore.registerFunction("getCncRequest", getCncRequestTool);
chatStore.registerFunction("startFileAnalysis", startFileAnalysisTool);
chatStore.registerFunction("getCommands", getCommandsTool);
chatStore.registerFunction("execCommand", execCommandTool);

chatSendRequested.watch((message) => {
	void (async () => {
		ensureInitialized(); // Инициализируем чат только при первой отправке сообщения
		logRequestFlow("message.received", {
			contextName: chatStore.$chat.getState().contextName,
			activeRequestId,
			message,
		});
		const created = await ensureInitialRequestDraft(message);
		logRequestFlow("message.forward-to-llm", {
			activeRequestId,
			createdDraftBeforeSend: created,
			note: "field extraction is delegated to LLM tool calls and ms-requests requirements",
		});
		chatStore.send(message);
	})();
});

chatAttachRequested.watch(() => {
	ensureInitialized();
	openFilePicker();
});

uploadCompleted.watch((fileId) => {
	const fileState = $files.getState().get(fileId);
	if (!fileState) return;

	const chatMessage = {
		id: `file_${fileId}`,
		type: "user" as const,
		content: `Файл загружен: ${fileState.fileName}`,
		timestamp: Date.now(),
		fileData: {
			fileId,
			fileName: fileState.fileName,
			fileSize: fileState.fileSize,
			fileType: fileState.fileType,
		},
	};

	addMessage(chatMessage);

	void (async () => {
		const rows = await threadsClient.readThread(chatThreadId).catch(() => []);
		const parent = [...rows].sort(
			(left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0),
		)[0];

		await threadsClient.saveMessage({
			threadId: chatThreadId,
			id: chatMessage.id,
			beforeId: parent?.id,
			user: "user",
			type: MessageType.link,
			data: JSON.stringify({
				kind: "file",
				target: "store:file",
				label: fileState.fileName,
				fileId,
				fileName: fileState.fileName,
				fileSize: fileState.fileSize,
				fileType: fileState.fileType,
			}),
		});

		await assistantClient.recordChatFile(chatThreadId, fileState.fileSize);

		chatStore.send(
			`[FILE] id=${fileId} name="${fileState.fileName}" size=${fileState.fileSize} type="${fileState.fileType}" — запусти анализ файла`,
		);
	})().catch((error) => {
		console.warn("[Chat] Failed to save file message", error);
	});
});

export { chatStore, chatThreadId };
