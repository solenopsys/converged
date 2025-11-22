// nrpc-runtime/elysia-backend.ts
import { Elysia } from "elysia";
import type { ServiceMetadata } from "../types";
import { serializeValue, deserializeValue } from "./serialization";

export interface ElysiaBackendConfig {
  metadata: ServiceMetadata;
  serviceImpl?: any;
  serviceUrl?: string;
  configEnvVar?: string;
  pathPrefix?: string;
}

export interface PluginOptions {
  dbPath?: string;
  [key: string]: any;
}

export function createHttpBackend(config: ElysiaBackendConfig) {
  return (options: PluginOptions = {}) =>
    (app: Elysia) => {
      const backend = new ElysiaBackend(config, options);
      const pathPrefix = config.pathPrefix || "";

      // Регистрируем методы как POST эндпоинты
      for (const method of config.metadata.methods) {
        const path = `${pathPrefix}/${config.metadata.serviceName}/${method.name}`;

        // Обычный HTTP эндпоинт
        const handler = async ({ body }: { body?: any }) => {
          try {
            const result = await backend.callMethod(method.name, body || {});
            if (
              result === null ||
              result === undefined ||
              typeof result === "string" ||
              typeof result === "number" ||
              typeof result === "boolean"
            ) {
              return new Response(JSON.stringify(result), {
                headers: { "Content-Type": "application/json" },
              });
            }
            return result;
          } catch (error: any) {
            console.error(
              `Error in ${config.metadata.serviceName}.${method.name}:`,
              error,
            );

            // Handle errors with statusCode
            const statusCode = error.statusCode || 500;
            const message = error.message || "Internal Server Error";

            return new Response(JSON.stringify({ error: message }), {
              status: statusCode,
              headers: { "Content-Type": "application/json" },
            });
          }
        };

        app.post(path, handler);
        console.log(
          `Registered route: POST ${path} -> ${config.metadata.serviceName}.${method.name}`,
        );

        // Дополнительный streaming эндпоинт для AsyncIterable методов
        if (method.isAsyncIterable) {
          const streamPath = `${path}/stream`;

          const streamHandler = async ({
            body,
            set,
          }: {
            body?: any;
            set: any;
          }) => {
            try {
              set.headers["Content-Type"] = "text/event-stream";
              set.headers["Cache-Control"] = "no-cache";
              set.headers["Connection"] = "keep-alive";
              set.headers["Access-Control-Allow-Origin"] = "*";

              return backend.streamMethod(method.name, body || {});
            } catch (error) {
              console.error(
                `Error in streaming ${config.metadata.serviceName}.${method.name}:`,
                error,
              );
              throw error;
            }
          };

          app.post(streamPath, streamHandler);
          console.log(
            `Registered streaming route: POST ${streamPath} -> ${config.metadata.serviceName}.${method.name} (stream)`,
          );
        }
      }

      return app;
    };
}

class ElysiaBackend {
  private serviceInstance: any;
  private isRemoteService: boolean;

  constructor(
    private config: ElysiaBackendConfig,
    private options: PluginOptions,
  ) {
    this.isRemoteService = !!config.serviceUrl;

    if (!this.isRemoteService && config.serviceImpl) {
      this.initializeLocalService();
    }
  }

  private initializeLocalService() {
    try {
      let serviceConfig = { ...this.options };

      if (this.config.configEnvVar) {
        const envConfigValue = process.env[this.config.configEnvVar];

        if (envConfigValue) {
          try {
            const envConfig = JSON.parse(envConfigValue);
            serviceConfig = { ...serviceConfig, ...envConfig };
            console.log(`Config loaded from ${this.config.configEnvVar}`);
          } catch (error) {
            console.error(
              `Error parsing config from ${this.config.configEnvVar}:`,
              error,
            );
          }
        } else {
          console.warn(
            `Environment variable ${this.config.configEnvVar} not found, using plugin options`,
          );
        }
      }

      this.serviceInstance = new this.config.serviceImpl(serviceConfig);
      console.log(
        `Service ${this.config.metadata.serviceName} initialized successfully`,
      );
    } catch (error) {
      console.error(
        `Error initializing service ${this.config.metadata.serviceName}:`,
        error,
      );
      throw error;
    }
  }

  async callMethod(methodName: string, params: any): Promise<any> {
    if (this.isRemoteService) {
      return this.callRemoteMethod(methodName, params);
    } else {
      return this.callLocalMethod(methodName, params);
    }
  }

  async streamMethod(methodName: string, params: any): Promise<ReadableStream> {
    if (this.isRemoteService) {
      return this.streamRemoteMethod(methodName, params);
    } else {
      return this.streamLocalMethod(methodName, params);
    }
  }

  private async callLocalMethod(methodName: string, params: any): Promise<any> {
    if (!this.serviceInstance) {
      throw new Error(`Service instance not initialized`);
    }

    if (typeof this.serviceInstance[methodName] !== "function") {
      throw new Error(
        `Method ${methodName} not found in service ${this.config.metadata.serviceName}`,
      );
    }

    const methodMetadata = this.config.metadata.methods.find(
      (m) => m.name === methodName,
    );
    if (!methodMetadata) {
      throw new Error(`Method metadata not found for ${methodName}`);
    }

    const args = methodMetadata.parameters.map((param) =>
      deserializeValue(params[param.name], param.type),
    );
    const result = await this.serviceInstance[methodName](...args);
    return serializeValue(result, methodMetadata.returnType);
  }

  private async streamLocalMethod(
    methodName: string,
    params: any,
  ): Promise<ReadableStream> {
    if (!this.serviceInstance) {
      throw new Error(`Service instance not initialized`);
    }

    if (typeof this.serviceInstance[methodName] !== "function") {
      throw new Error(
        `Method ${methodName} not found in service ${this.config.metadata.serviceName}`,
      );
    }

    const methodMetadata = this.config.metadata.methods.find(
      (m) => m.name === methodName,
    );
    if (!methodMetadata) {
      throw new Error(`Method metadata not found for ${methodName}`);
    }

    if (!methodMetadata.isAsyncIterable) {
      throw new Error(`Method ${methodName} is not an AsyncIterable method`);
    }

    const args = methodMetadata.parameters.map((param) => params[param.name]);

    // Сохраняем ссылку на serviceInstance для использования в ReadableStream
    const serviceInstance = this.serviceInstance;

    return new ReadableStream({
      async start(controller) {
        try {
          console.log(
            `[ElysiaBackend] Starting stream for ${methodName} with args:`,
            args,
          );

          // Получаем AsyncIterable от сервиса
          const asyncIterable = serviceInstance[methodName](...args);
          console.log(
            `[ElysiaBackend] Got result, type:`,
            typeof asyncIterable,
          );

          // Проверяем, что это действительно AsyncIterable
          if (
            !asyncIterable ||
            typeof asyncIterable[Symbol.asyncIterator] !== "function"
          ) {
            console.error(
              `[ElysiaBackend] Method ${methodName} did not return an AsyncIterable, got:`,
              asyncIterable,
            );
            throw new Error(
              `Method ${methodName} did not return an AsyncIterable`,
            );
          }

          // Итерируем через AsyncIterable
          for await (const item of asyncIterable) {
            // ДЕТАЛЬНАЯ ДИАГНОСТИКА
            console.log(`[ElysiaBackend] Raw item:`, item);
            console.log(`[ElysiaBackend] Item type:`, typeof item);
            console.log(
              `[ElysiaBackend] Item constructor:`,
              item?.constructor?.name,
            );
            console.log(`[ElysiaBackend] Is Buffer:`, Buffer.isBuffer?.(item));
            console.log(
              `[ElysiaBackend] Is Uint8Array:`,
              item instanceof Uint8Array,
            );
            console.log(
              `[ElysiaBackend] Is ArrayBuffer:`,
              item instanceof ArrayBuffer,
            );
            console.log(`[ElysiaBackend] Is Array:`, Array.isArray(item));

            // Проверяем что item - это обычный объект, а не Buffer/Uint8Array
            let dataToSend;

            if (Buffer.isBuffer?.(item)) {
              // Buffer -> строка -> попытка парсинга JSON
              const text = item.toString("utf8");
              console.log(`[ElysiaBackend] Buffer decoded to text:`, text);
              try {
                dataToSend = JSON.parse(text);
                console.log(
                  `[ElysiaBackend] Successfully parsed JSON from buffer:`,
                  dataToSend,
                );
              } catch (e) {
                console.log(
                  `[ElysiaBackend] Failed to parse JSON, using as text`,
                );
                dataToSend = { type: "text", content: text };
              }
            } else if (item instanceof Uint8Array) {
              // Uint8Array -> строка -> попытка парсинга JSON
              const text = new TextDecoder().decode(item);
              console.log(`[ElysiaBackend] Uint8Array decoded to text:`, text);
              try {
                dataToSend = JSON.parse(text);
                console.log(
                  `[ElysiaBackend] Successfully parsed JSON from Uint8Array:`,
                  dataToSend,
                );
              } catch (e) {
                console.log(
                  `[ElysiaBackend] Failed to parse JSON, using as text`,
                );
                dataToSend = { type: "text", content: text };
              }
            } else if (item instanceof ArrayBuffer) {
              // ArrayBuffer -> строка -> попытка парсинга JSON
              const text = new TextDecoder().decode(item);
              console.log(`[ElysiaBackend] ArrayBuffer decoded to text:`, text);
              try {
                dataToSend = JSON.parse(text);
                console.log(
                  `[ElysiaBackend] Successfully parsed JSON from ArrayBuffer:`,
                  dataToSend,
                );
              } catch (e) {
                console.log(
                  `[ElysiaBackend] Failed to parse JSON, using as text`,
                );
                dataToSend = { type: "text", content: text };
              }
            } else if (typeof item === "string") {
              // Строка -> попытка парсинга JSON
              console.log(`[ElysiaBackend] Item is string:`, item);
              try {
                dataToSend = JSON.parse(item);
                console.log(
                  `[ElysiaBackend] Successfully parsed JSON from string:`,
                  dataToSend,
                );
              } catch (e) {
                console.log(
                  `[ElysiaBackend] Failed to parse JSON, using as text`,
                );
                dataToSend = { type: "text", content: item };
              }
            } else if (typeof item === "object" && item !== null) {
              // Уже объект
              console.log(`[ElysiaBackend] Item is already object:`, item);
              dataToSend = item;
            } else {
              console.warn(
                `[ElysiaBackend] Unexpected item type:`,
                typeof item,
                item,
              );
              dataToSend = { type: "unknown", content: String(item) };
            }

            // Сериализуем в JSON для SSE
            console.log(`[ElysiaBackend] Final dataToSend:`, dataToSend);
            const jsonData = JSON.stringify(dataToSend);
            const sseData = `data: ${jsonData}\n\n`;

            console.log(
              `[ElysiaBackend] Final SSE data:`,
              sseData.slice(0, 200) + (sseData.length > 200 ? "..." : ""),
            );
            controller.enqueue(sseData); // Отправляем строку напрямую
          }

          // Отправляем сигнал завершения
          const doneMessage = `data: [DONE]\n\n`;
          console.log(`[ElysiaBackend] Stream completed, sending [DONE]`);
          controller.enqueue(doneMessage); // Строка напрямую
          controller.close();
        } catch (error) {
          console.error(
            `[ElysiaBackend] Error in streaming method ${methodName}:`,
            error,
          );
          const errorMessage = `data: ${JSON.stringify({ error: error.message })}\n\n`;
          controller.enqueue(errorMessage); // Строка напрямую
          controller.close();
        }
      },
    });
  }

  private async callRemoteMethod(
    methodName: string,
    params: any,
  ): Promise<any> {
    if (!this.config.serviceUrl) {
      throw new Error("Service URL not configured for remote service");
    }

    const response = await fetch(`${this.config.serviceUrl}/${methodName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(
        `Remote service error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  private async streamRemoteMethod(
    methodName: string,
    params: any,
  ): Promise<ReadableStream> {
    if (!this.config.serviceUrl) {
      throw new Error("Service URL not configured for remote service");
    }

    const response = await fetch(
      `${this.config.serviceUrl}/${methodName}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(params),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Remote streaming service error: ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    return response.body;
  }
}
