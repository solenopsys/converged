// log-service-sqlite.ts
import {
	chatConversations,
	chatMessages,
	chatRawEvents,
	type NewMessage,
	type NewRawEvent,
} from "../db";
import type { LogService, ContentBlock, OpenAIEvent } from "../types";

/* Вспомогательный буфер для сборки ответов ассистента */
interface AssistantBuf {
	blocks: ContentBlock[];
	currentText: string;
}

export class LogServiceSQLite implements LogService {
	private buf = new Map<string, AssistantBuf>();

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
			ts: p.timestamp.toISOString(),
		};

		await chatMessages.create(messageData).execute();
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
			received_at: event.receivedAt.toISOString(),
		};

		await chatRawEvents.create(eventData).execute();

		/* 2.2  собираем ответ ассистента */
		await this.aggregateAssistant(conversationId, event, p.model);
	}

	/* ——— 3.  Вспомогательные методы ——— */

	/** Создаёт запись о диалоге, если её ещё нет */
	private async ensureConversation(id: string) {
		/* Используем готовый хелпер */
		await chatConversations
			.create({ id })
			.onConflict((oc) => oc.column("id").doNothing())
			.execute();
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
					};

					await chatMessages.create(assistantMessage).execute();
				}
				this.buf.delete(convo);
				return;
			}
		}

		/* если ещё не completed — сохраняем буфер в Map */
		this.buf.set(convo, buf);
	}
}
