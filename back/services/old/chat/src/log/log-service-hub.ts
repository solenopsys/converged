import type { LogService, ContentBlock, OpenAIEvent } from "./log-service";

/**
 * LogServiceHub — «веерный» лог-адаптер.
 *
 * ▸ Сам реализует LogService
 * ▸ Внутри хранит произвольное число других LogService-реализаций
 * ▸ Каждую запись или событие рассылает во все подключённые «синки»
 *
 * Подходит, когда нужно одновременно писать в БД, файл и консоль,
 * не меняя код прокси.
 */
export class LogServiceHub implements LogService {
	/** Внутренний список подключённых реализаций */
	private sinks: LogService[] = [];

	/**
	 * Можно передать первый LogService (или массив) прямо в конструктор.
	 */
	constructor(initial?: LogService | LogService[]) {
		if (initial) {
			this.add(initial);
		}
	}

	/** Добавляет ещё один LogService */
	add(next: LogService | LogService[]) {
		if (Array.isArray(next)) {
			this.sinks.push(...next);
		} else {
			this.sinks.push(next);
		}
	}

	/** Удаляет ранее добавленный LogService */
	remove(sink: LogService) {
		this.sinks = this.sinks.filter((s) => s !== sink);
	}

	/* ——— реализация интерфейса LogService ——— */

	async saveUserMessage(p: {
		conversationId: string;
		content: ContentBlock[];
		model?: string;
		timestamp: Date;
		meta?: Record<string, unknown>;
	}): Promise<void> {
		await this.fanOut((s) => s.saveUserMessage(p));
	}

	async saveOpenAIEvent(p: {
		conversationId: string;
		model?: string;
		event: OpenAIEvent;
	}): Promise<void> {
		await this.fanOut((s) => s.saveOpenAIEvent(p));
	}

	/* ——— внутренний helper ——— */

	/**
	 * Рассылает вызов по всем зарегистрированным sinks параллельно.
	 * Ошибки отдельных реализаций не прерывают остальных —
	 * они выводятся в консоль и проглатываются.
	 */
	private async fanOut(
		invoke: (sink: LogService) => Promise<void>,
	): Promise<void> {
		await Promise.allSettled(
			this.sinks.map(async (sink) => {
				try {
					await invoke(sink);
				} catch (err) {
					console.error("[LogServiceHub] sink error:", err);
				}
			}),
		);
	}
}
