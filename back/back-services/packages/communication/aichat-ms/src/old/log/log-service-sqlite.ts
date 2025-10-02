// log-service-sqlite.ts
import type { LogService, ContentBlock, OpenAIEvent } from "../types";
import { DatabaseService, NewMessage, NewRawEvent } from "../db";

/* Вспомогательный буфер для сборки ответов ассистента */
interface AssistantBuf {
	blocks: ContentBlock[];
	currentText: string;
}

export class LogServiceSQLite implements LogService {
	private buf = new Map<string, AssistantBuf>();

	constructor(private db: DatabaseService) {}

	/* ——— 1.  USER MESSAGE ——— */
	async saveUserMessage(p: {
		conversationId: string;
		content: ContentBlock[];
		model?: string;
		timestamp: Date;
		meta?: Record<string, unknown>;
	}) {
		const { conversationId } = p;
		await this.ensureConversation(conversationId);

		const messageData: NewMessage = {
			conversation_id: conversationId,
			role: "user",
			content: JSON.stringify(p.content),
			model: p.model ?? null,
			meta: p.meta ? JSON.stringify(p.meta) : null,
		};

		await this.db.messages.create(messageData);
	}

	/* ——— 2.  OPENAI EVENT ——— */
	async saveOpenAIEvent(p: {
		conversationId: string;
		model?: string;
		event: OpenAIEvent;
	}) {
		const { conversationId, event } = p;
		await this.ensureConversation(conversationId);

		/* 2.1  raw-event для аудита */
		const eventData: NewRawEvent = {
			conversation_id: conversationId,
			event_type: event.type,
			payload: JSON.stringify(event.payload),
			model: p.model ?? null,
		};

		await this.db.rawEvents.create(eventData);

		/* 2.2  собираем ответ ассистента */
		await this.aggregateAssistant(conversationId, event, p.model);
	}

	/* ——— 3.  ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ (опционально) ——— */
	
	/* Получить историю сообщений */
	async getConversationMessages(conversationId: string) {
		const messages = await this.db.messages.findByConversation(conversationId);
		return messages.map(msg => ({
			...msg,
			content: JSON.parse(msg.content) as ContentBlock[],
			meta: msg.meta ? JSON.parse(msg.meta) : undefined,
		}));
	}

	/* Получить список диалогов */
	async listConversations() {
		return this.db.conversations.list();
	}

	/* Удалить диалог со всеми сообщениями */
	async deleteConversation(conversationId: string) {
		// Используем транзакцию для атомарного удаления
		await this.db.transaction(async (trx) => {
			// Удаляем raw events
			await trx
				.deleteFrom("chat_raw_events")
				.where("conversation_id", "=", conversationId)
				.execute();
			
			// Удаляем сообщения
			await trx
				.deleteFrom("chat_messages")
				.where("conversation_id", "=", conversationId)
				.execute();
			
			// Удаляем сам диалог
			await trx
				.deleteFrom("chat_conversations")
				.where("id", "=", conversationId)
				.execute();
		});
	}

	/* Получить сырые события (для отладки) */
	async getRawEvents(conversationId: string) {
		const events = await this.db.rawEvents.findByConversation(conversationId);
		return events.map(ev => ({
			...ev,
			payload: ev.payload ? JSON.parse(ev.payload) : null,
		}));
	}

	/* ——— 4.  Вспомогательные методы ——— */

	/** Создаёт запись о диалоге, если её ещё нет */
	private async ensureConversation(id: string) {
		// Проверяем существование
		const existing = await this.db.conversations.findById(id);
		if (!existing) {
			await this.db.conversations.create({ id });
		}
	}

	/** Агрегируем стрим ассистента и сохраняем, когда придёт completed */
	private async aggregateAssistant(
		convo: string,
		ev: OpenAIEvent,
		model?: string,
	) {
		const buf = this.buf.get(convo) ?? { blocks: [], currentText: "" };

		switch (ev.type) {
			/* Полные блоки (non-stream) */
			case "response.output_text": {
				const { text, annotations = [] } = ev.payload as any;
				buf.blocks.push({ type: "output_text", text, annotations });
				break;
			}

			/* Стриминговые чанки */
			case "response.output_text.delta": {
				buf.currentText += (ev.payload as any).delta ?? "";
				break;
			}

			/* Конец ответа */
			case "response.completed":
			case "done": {
				if (buf.currentText) {
					buf.blocks.push({ type: "output_text", text: buf.currentText });
					buf.currentText = "";
				}

				if (buf.blocks.length) {
					const assistantMessage: NewMessage = {
						conversation_id: convo,
						role: "assistant",
						content: JSON.stringify(buf.blocks),
						model: model ?? null,
						meta: null,
					};

					await this.db.messages.create(assistantMessage);
				}
				this.buf.delete(convo);
				return;
			}
		}

		/* если ещё не completed — сохраняем буфер в Map */
		this.buf.set(convo, buf);
	}

	/* Очистка буферов (на случай прерывания) */
	clearBuffers() {
		this.buf.clear();
	}
}

 