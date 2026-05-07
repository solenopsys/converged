import type { ExecutableTool } from "assistant-state";
import { addMessage, createChatStore } from "assistant-state";
import { $files, openFilePicker, uploadCompleted } from "files-state";
import {
	chatAttachRequested,
	chatInitRequested,
	chatSendRequested,
	registry,
} from "front-core";
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

const createCncRequestTool: ExecutableTool = {
	name: "createCncRequest",
	description:
		"Create a CNC machining request in ms-requests from collected chat data",
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
					"Structured CNC request fields such as material, quantity, tolerances, deadline and contact",
			},
			files: {
				type: "object",
				description: "Map of semantic file labels to ms-files file IDs",
			},
			comment: {
				type: "string",
				description: "Short note explaining why the request was created",
			},
		},
		required: ["fields"],
	},
	execute: async (
		rawArgs:
			| {
					status?: string;
					fields?: Record<string, any>;
					files?: Record<string, string>;
					comment?: string;
			  }
			| string,
	) => {
		const args = parseToolArgs(rawArgs);
		const fields = normalizeRecord(args.fields);
		const files = Object.fromEntries(
			Object.entries(normalizeRecord(args.files)).filter(
				([, value]) => typeof value === "string",
			),
		) as Record<string, string>;

		const requestId = await requestsClient.createRequest({
			source: "assistant:cnc-request",
			status: args.status || "new",
			fields,
			files,
		});

		return {
			ok: true,
			requestId,
			status: args.status || "new",
			comment: args.comment,
		};
	},
};

const patchCncRequestTool: ExecutableTool = {
	name: "patchCncRequest",
	description:
		"Patch an existing CNC request fields, files or status in ms-requests",
	parameters: {
		type: "object",
		properties: {
			requestId: {
				type: "string",
				description: "Existing request ID",
			},
			status: {
				type: "string",
				description: "New request status if it changed",
			},
			fields: {
				type: "object",
				description: "Fields to merge into the existing request",
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
		required: ["requestId"],
	},
	execute: async (
		rawArgs:
			| {
					requestId?: string;
					status?: string;
					fields?: Record<string, any>;
					files?: Record<string, string>;
					comment?: string;
			  }
			| string,
	) => {
		const args = parseToolArgs(rawArgs);
		if (!args.requestId) {
			return { ok: false, error: "requestId is required" };
		}

		const files = Object.fromEntries(
			Object.entries(normalizeRecord(args.files)).filter(
				([, value]) => typeof value === "string",
			),
		) as Record<string, string>;

		await requestsClient.patchRequest(
			args.requestId,
			{
				status: args.status,
				fields: normalizeRecord(args.fields),
				files,
			},
			"assistant",
			args.comment || "updated by assistant",
		);

		return { ok: true, requestId: args.requestId };
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
			return { ok: false, error: "requestId is required" };
		}

		const request = await requestsClient.getRequest(args.requestId);
		return { ok: true, request };
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
chatStore.registerFunction("patchCncRequest", patchCncRequestTool);
chatStore.registerFunction("getCncRequest", getCncRequestTool);
chatStore.registerFunction("startFileAnalysis", startFileAnalysisTool);
chatStore.registerFunction("getCommands", getCommandsTool);
chatStore.registerFunction("execCommand", execCommandTool);

chatSendRequested.watch((message) => {
	ensureInitialized(); // Инициализируем чат только при первой отправке сообщения
	chatStore.send(message);
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
	})().catch((error) => {
		console.warn("[Chat] Failed to save file message", error);
	});
});

export { chatStore, chatThreadId };
