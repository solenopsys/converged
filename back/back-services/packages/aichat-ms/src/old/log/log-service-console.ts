import type { ContentBlock, OpenAIEvent, LogService } from "./log-service";

/**
 * Простейшая «реализация по-умолчанию»:
 * всё, что получает прокси, выводит в stdout одним
 * prettified-JSON без какой-либо агрегации.
 *
 * Полезно для локальной отладки, когда ещё нет БД.
 */
export class LogServiceConsole implements LogService {
	async saveUserMessage(params: {
		conversationId: string;
		role?: "user"; // прокси может передавать, но не обязателен
		content: ContentBlock[];
		model?: string;
		timestamp: Date;
		meta?: Record<string, unknown>;
	}): Promise<void> {
		console.log(
			JSON.stringify(
				{ kind: "user_message", ...params },
				null,
				2, // красивый вывод
			),
		);
	}

	async saveOpenAIEvent(params: {
		conversationId: string;
		model?: string;
		event: OpenAIEvent;
	}): Promise<void> {
		console.log(JSON.stringify({ kind: "openai_event", ...params }, null, 2));
	}
}
