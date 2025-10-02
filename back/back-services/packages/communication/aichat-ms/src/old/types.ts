/* Тип блока, совместимый с Responses API */
export type ContentBlock =
	| { type: "text" | "output_text"; text: string; annotations?: unknown[] }
	| { type: "image_url"; url: string; annotations?: unknown[] };

/* Что прилетает от OpenAI в стриме */
export interface OpenAIEvent {
	type: string; // "response.output_text.delta", …
	payload: unknown; // оригинальный объект из SDK
	receivedAt: Date;
}

/* Сервис, в который прокси всё сдаёт */
export interface LogService {
	/** Реплика пользователя (обычно один блок-строка) */
	saveUserMessage(params: {
		conversationId: string;
		content: ContentBlock[];
		model?: string;
		timestamp: Date;
		meta?: Record<string, unknown>;
	}): Promise<void>;

	/** Любое событие из OpenAI-стрима. */
	saveOpenAIEvent(params: {
		conversationId: string;
		event: OpenAIEvent;
		model?: string;
	}): Promise<void>;
}


