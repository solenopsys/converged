import { type INode,processTemplate } from "dag-api";


type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

 
interface HttpNodeConfig {
	url: string;
	method: Method;
	headers?: Record<string, string>;
	timeout?: number;
	followRedirects?: boolean;
}

export default class HttpNode implements INode {
	public name: string;
	private config: HttpNodeConfig;
	private body: any;

	constructor(name: string, url:string,method:string, body?: any) {
		this.name = name;
		this.config = { 
			timeout: 5000,
			followRedirects: true,
			url,
			method: method as Method,
		};
		this.body = body;
	}

	async execute(data: any): Promise<any> {
		try {
			// Обработка URL через шаблонизатор
			const processedUrl = processTemplate(this.config.url, data);
			console.log("data",data)
			console.log("url",processedUrl)

			// Обработка headers через шаблонизатор
			const processedHeaders: Record<string, string> = {};
			if (this.config.headers) {
				for (const [key, value] of Object.entries(this.config.headers)) {
					processedHeaders[key] = processTemplate(value, data);
				}
			}

			// Обработка body через шаблонизатор (если есть)
			let processedBody: any = undefined;
			if (this.body !== undefined) {
				if (typeof this.body === "string") {
					processedBody = processTemplate(this.body, data);
				} else if (typeof this.body === "object") {
					processedBody = JSON.stringify(this.body);
					processedBody = processTemplate(processedBody, data);
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
				console.log("processedUrl",processedUrl)
				console.log("requestOptions",requestOptions)
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
