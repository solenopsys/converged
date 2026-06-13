import type { Store } from "effector";
import {
	completeResponse,
	errorOccurred,
	receiveChunk,
	sessionIdUpdated,
	toolCallExecuted,
	toolCallReceived,
} from "./events";
import * as types from "./types";

const pendingSessionCreations = new Map<string, Promise<string>>();

// Улучшенная функция для обработки переносов строк
const preserveLineBreaks = (text: string): string => {
	if (!text) return "";

	// Обрабатываем различные варианты переносов строк
	return text
		.replace(/\\r\\n/g, "\r\n") // Windows переносы
		.replace(/\\n/g, "\n") // Unix переносы
		.replace(/\\r/g, "\r") // Mac переносы
		.replace(/\\\\/g, "\\"); // Экранированные слеши
};

// Функция для накопления и обработки текста с переносами
const processAccumulatedText = (text: string): string => {
	// Применяем preserveLineBreaks только к накопленному тексту
	return preserveLineBreaks(text);
};


const SESSION_NOT_FOUND_PATTERNS = [
	"SESSION_NOT_FOUND",
	"Conversation not found for sessionId",
	"Session not found:",
];

const isSessionNotFoundError = (error: unknown): boolean => {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return SESSION_NOT_FOUND_PATTERNS.some((pattern) =>
		message.includes(pattern),
	);
};

const getSessionCreationKey = (state: types.ChatState): string => {
	return [
		state.threadId,
		state.serviceType ?? "",
		state.model ?? "",
		state.contextName ?? "",
		state.language ?? "",
	].join("|");
};

const createAndSyncSession = async (
	aiService: types.RuntimeAssistantService,
	state: types.ChatState,
): Promise<string> => {
	const key = getSessionCreationKey(state);
	const pending = pendingSessionCreations.get(key);
	if (pending) {
		return pending;
	}

	const sessionPromise = aiService
		.createSession(state.serviceType, state.model, state.contextName, state.language)
		.then((sessionId) => {
			sessionIdUpdated(sessionId);
			return sessionId;
		})
		.finally(() => {
			pendingSessionCreations.delete(key);
		});

	pendingSessionCreations.set(key, sessionPromise);
	return sessionPromise;
};

const resolveSessionId = async (
	aiService: types.RuntimeAssistantService,
	state: types.ChatState,
): Promise<string> => {
	if (state.sessionId) {
		return state.sessionId;
	}

	return createAndSyncSession(aiService, state);
};

const consumeStreamEvents = async (
	events: AsyncIterable<types.StreamEvent>,
): Promise<void> => {
	for await (const event of events) {
		// NRPC streaming backend sends errors as { error: "..." } without a type field
		const rawError = (event as any).error;
		if (rawError && !(event as any).type) {
			if (isSessionNotFoundError(rawError)) {
				throw new Error(rawError);
			}
			errorOccurred(String(rawError));
			return;
		}

		receiveChunk(event);

		if (event.type === types.StreamEventType.COMPLETED) {
			if (
				(event as { finishReason?: string }).finishReason !== "tool_calls"
			) {
				completeResponse();
			}
			break;
		}

		if (event.type === types.StreamEventType.ERROR) {
			errorOccurred(event.message);
			break;
		}
	}
};

const sendWithSessionRecovery = async (
	aiService: types.RuntimeAssistantService,
	state: types.ChatState,
	messages: any[],
	options: types.ConversationOptions,
) => {
	let sessionId = await resolveSessionId(aiService, state);

	try {
		await consumeStreamEvents(
			aiService.sendMessage(sessionId, messages, options),
		);
		return;
	} catch (error) {
		if (!isSessionNotFoundError(error)) {
			throw error;
		}
	}

	// Session may be lost after microservice restart, recreate and retry once.
	sessionId = await createAndSyncSession(aiService, state);
	await consumeStreamEvents(
		aiService.sendMessage(sessionId, messages, options),
	);
};

export const initializeChat = (
	_: types.ChatState,
	{
		threadId,
		serviceType,
		model,
		contextName,
		language,
	}: {
		threadId: string;
		serviceType?: types.ServiceType;
		model?: string;
		contextName?: string;
		language?: string;
	},
): types.ChatState => ({
	threadId,
	serviceType,
	model,
	contextName,
	language,
	sessionId: undefined,
	messages: [],
	isLoading: false,
	currentResponse: "",
	pendingToolCalls: [],
	lastToolCallName: undefined,
});

export const addUserMessage = (
	state: types.ChatState,
	content: string,
): types.ChatState => {
	const message: types.ChatMessage = {
		id: `msg_${Date.now()}`,
		type: "user",
		content: preserveLineBreaks(content),
		timestamp: Date.now(),
	};

	return {
		...state,
		messages: [...state.messages, message],
		isLoading: true,
		currentResponse: "",
		pendingToolCalls: [],
		lastToolCallName: undefined,
	};
};

export const updateResponse = (
	state: types.ChatState,
	event: any,
): types.ChatState => {
	if (event.type === types.StreamEventType.TEXT_DELTA) {
		// ИСПРАВЛЕНИЕ: Не применяем preserveLineBreaks к отдельным чанкам
		// Просто накапливаем сырой контент, переносы обработаем при финализации
		const newContent = event.content || "";

		return {
			...state,
			currentResponse: state.currentResponse + newContent,
		};
	}

	return state;
};

export const finalize = (state: types.ChatState): types.ChatState => {
	if (!state.currentResponse.trim() && state.pendingToolCalls.length === 0) {
		return {
			...state,
			isLoading: false,
		};
	}

	const processedContent = processAccumulatedText(state.currentResponse);

	const assistantMessage: types.ChatMessage = {
		id: `msg_${Date.now()}`,
		type: "assistant",
		content: processedContent,
		timestamp: Date.now(),
	};

	return {
		...state,
		messages: [...state.messages, assistantMessage],
		isLoading: false,
		currentResponse: "",
		lastToolCallName: undefined,
	};
};

export const handleError = (state: types.ChatState): types.ChatState => ({
	...state,
	isLoading: false,
	currentResponse: "",
	pendingToolCalls: [],
	lastToolCallName: undefined,
});

export const createSession =
	(aiService: types.RuntimeAssistantService) =>
	async ({ threadId, serviceType, model, contextName, language }: types.ChatState) => {
		return await createAndSyncSession(aiService, {
			threadId,
			serviceType,
			model,
			contextName,
			language,
			sessionId: undefined,
			messages: [],
			isLoading: false,
			currentResponse: "",
			pendingToolCalls: [],
		});
	};

export const saveAssistantMessage =
	(
		threadsService: types.ThreadsService,
		metadataService?: types.ChatMetadataService,
	) =>
	async (state: types.ChatState) => {
		if (!state.currentResponse.trim()) {
			return;
		}

		const processedContent = processAccumulatedText(state.currentResponse);

		await threadsService.saveMessage({
			threadId: state.threadId,
			user: "assistant",
			type: types.MessageType.message,
			data: processedContent,
			timestamp: Date.now(),
		});
		await recordChatMessage(metadataService, state.threadId);
	};

const recordChatMessage = async (
	metadataService: types.ChatMetadataService | undefined,
	threadId: string,
) => {
	if (!metadataService || !threadId) return;

	try {
		await metadataService.recordChatMessage(threadId);
	} catch (error) {
		console.warn("[assistant-state] Failed to update chat metadata", error);
	}
};

export const sendMessage =
	(
		aiService: types.RuntimeAssistantService,
		threadsService: types.ThreadsService,
		metadataService: types.ChatMetadataService | undefined,
		$functions: Store<Record<string, types.ExecutableTool>>,
	) =>
	async ({ content, state }: { content: string; state: types.ChatState }) => {
		await threadsService.saveMessage({
			threadId: state.threadId,
			user: "user",
			type: types.MessageType.message,
			data: preserveLineBreaks(content),
			timestamp: Date.now(),
		});
		await recordChatMessage(metadataService, state.threadId);

		const messages = [
			{ type: types.ContentType.TEXT, data: preserveLineBreaks(content) },
		];
		const tools: types.Tool[] = Object.values($functions.getState()).map(
			({ execute, ...tool }) => tool,
		);
		const options: types.ConversationOptions = { tools };

		try {
			await sendWithSessionRecovery(aiService, state, messages, options);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			errorOccurred(message);
		}
	};

export const executeToolCall =
	($functions: Store<Record<string, types.ExecutableTool>>) =>
	async (toolCall: types.ToolCall) => {
		const functions = $functions.getState();
		const func = functions[toolCall.name];
		if (func) {
			try {
				const result = await func.execute(toolCall.args);
				return { toolCallId: toolCall.id, result };
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new Error(message);
			}
		} else {
			throw new Error(`Function "${toolCall.name}" not found`);
		}
	};

export const sendToolResult =
	(
		aiService: types.RuntimeAssistantService,
		threadsService: types.ThreadsService,
		metadataService?: types.ChatMetadataService,
		$functions?: Store<Record<string, types.ExecutableTool>>,
	) =>
	async ({
		toolCallId,
		result,
		state,
	}: {
		toolCallId: string;
		result: any;
		state: types.ChatState;
	}) => {
		let toolResultContent: string;
		if (typeof result === "string") {
			toolResultContent = preserveLineBreaks(result);
		} else {
			toolResultContent = JSON.stringify(result, null, 2);
		}

		await threadsService.saveMessage({
			threadId: state.threadId,
			user: "assistant",
			type: types.MessageType.message,
			data: `Tool call ${toolCallId} result:\n${toolResultContent}`,
			timestamp: Date.now(),
		});
		await recordChatMessage(metadataService, state.threadId);

		const messages = [
			{
				type: types.ContentType.TOOL_RESULT,
				tool_call_id: toolCallId,
				data: toolResultContent,
			},
		];

		const tools: types.Tool[] = $functions
			? Object.values($functions.getState()).map(({ execute, ...tool }) => tool)
			: [];
		const options: types.ConversationOptions =
			tools.length > 0 ? { tools } : {};

		try {
			await sendWithSessionRecovery(aiService, state, messages, options);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			errorOccurred(message);
		}
	};
