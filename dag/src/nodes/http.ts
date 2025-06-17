import { type INode } from "../core/types";
import { processTemplate } from "../tools/templator";
import { type ContextAccessor } from "../core/types";

interface HttpNodeConfig {
	url: string;
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	headers?: Record<string, string>;
	timeout?: number;
	followRedirects?: boolean;
}

export class HttpNode implements INode {
	public name: string;
	private config: HttpNodeConfig;
	private body: any;

	constructor(name: string, params: HttpNodeConfig, body?: any) {
		this.name = name;
		this.config = {
			method: "GET",
			timeout: 5000,
			followRedirects: true,
			...params,
		};
		this.body = body;
	}

	async execute(data: any, accessor: ContextAccessor): Promise<any> {
		try {
			// Обработка URL через шаблонизатор
			const processedUrl = processTemplate(this.config.url, data, accessor);

			// Обработка headers через шаблонизатор
			const processedHeaders: Record<string, string> = {};
			if (this.config.headers) {
				for (const [key, value] of Object.entries(this.config.headers)) {
					processedHeaders[key] = processTemplate(value, data, accessor);
				}
			}

			// Обработка body через шаблонизатор (если есть)
			let processedBody: any = undefined;
			if (this.body !== undefined) {
				if (typeof this.body === "string") {
					processedBody = processTemplate(this.body, data, accessor);
				} else if (typeof this.body === "object") {
					processedBody = JSON.stringify(this.body);
					processedBody = processTemplate(processedBody, data, accessor);
					try {
						processedBody = JSON.parse(processedBody);
					} catch {
						// Если не удалось распарсить обратно в JSON, оставляем как строку
					}
				} else {
					processedBody = this.body;
				}
			}

			// Настройка запроса
			const requestOptions: RequestInit = {
				method: this.config.method,
				headers: {
					"Content-Type": "application/json",
					...processedHeaders,
				},
			};

			// Добавляем body только для методов, которые его поддерживают
			if (
				["POST", "PUT", "PATCH"].includes(this.config.method) &&
				processedBody !== undefined
			) {
				if (typeof processedBody === "object") {
					requestOptions.body = JSON.stringify(processedBody);
				} else {
					requestOptions.body = processedBody;
				}
			}

			// Настройка timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(
				() => controller.abort(),
				this.config.timeout,
			);
			requestOptions.signal = controller.signal;

			try {
				// Выполнение HTTP запроса
				const response = await fetch(processedUrl, requestOptions);
				clearTimeout(timeoutId);

				// Обработка ответа
				const responseData = {
					status: response.status,
					statusText: response.statusText,
					headers: Object.fromEntries(response.headers.entries()),
					data: null as any,
				};

				// Попытка получить данные ответа
				const contentType = response.headers.get("content-type");
				if (contentType?.includes("application/json")) {
					responseData.data = await response.json();
				} else {
					responseData.data = await response.text();
				}

				// Проверка успешности запроса
				if (!response.ok) {
					throw new Error(
						`HTTP Error: ${response.status} ${response.statusText}`,
					);
				}

				return responseData;
			} catch (error) {
				clearTimeout(timeoutId);
				throw error;
			}
		} catch (error) {
			throw new Error(
				`HttpNode "${this.name}" execution failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
