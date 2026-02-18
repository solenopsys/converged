// nrpc-runtime/elysia-backend.ts
import { Elysia } from "elysia";
import { jwtVerify } from "jose";
import type { ServiceMetadata } from "../types";
import { serializeValue, deserializeValue } from "./serialization";
import {
  AccessMatcher,
  extractPermissionsFromPayload,
  resolveAccessForMethod,
  type AccessMode,
} from "./access-control";

export interface ElysiaBackendConfig {
  metadata: ServiceMetadata;
  serviceImpl?: any;
  serviceUrl?: string;
  configEnvVar?: string;
  pathPrefix?: string;
  accessControl?: AccessControlConfig;
}

export interface PluginOptions {
  dbPath?: string;
  [key: string]: any;
}

export interface AccessControlConfig {
  mode?: "required" | "optional" | "off";
  secret?: string;
  headerName?: string;
  accessResolver?: (params: {
    serviceName: string;
    methodName: string;
    metadata: ServiceMetadata;
  }) => AccessMode;
}

export function createHttpBackend(config: ElysiaBackendConfig) {
  return (options: PluginOptions = {}) =>
    (app: Elysia) => {
      const backend = new ElysiaBackend(config, options);
      const pathPrefix = config.pathPrefix || "";

      // Регистрируем методы как POST эндпоинты
      console.log(`[nrpc] Registering service: ${config.metadata.serviceName}`);
      for (const method of config.metadata.methods) {
        const path = `${pathPrefix}/${config.metadata.serviceName}/${method.name}`;
        console.log(`[nrpc]   POST ${path}`);

        // Обычный HTTP эндпоинт
        const handler = async ({
          body,
          headers,
        }: {
          body?: any;
          headers: Record<string, string | undefined>;
        }) => {
          try {
            await backend.authorize(method.name, headers);
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

        // Дополнительный streaming эндпоинт для AsyncIterable методов
        if (method.isAsyncIterable) {
          const streamPath = `${path}/stream`;

          const streamHandler = async ({
            body,
            set,
            headers,
          }: {
            body?: any;
            set: any;
            headers: Record<string, string | undefined>;
          }) => {
            try {
              await backend.authorize(method.name, headers);
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
        }
      }

      return app;
    };
}

class ElysiaBackend {
  private serviceInstance: any;
  private isRemoteService: boolean;
  private accessControl: AccessControlConfig;
  private accessSecret: Uint8Array;
  private accessMode: "required" | "optional" | "off";

  constructor(
    private config: ElysiaBackendConfig,
    private options: PluginOptions,
  ) {
    this.isRemoteService = !!config.serviceUrl;
    this.accessControl = config.accessControl ?? {};
    this.accessMode = this.resolveAccessMode();
    const secret =
      this.accessControl.secret ??
      process.env.ACCESS_JWT_SECRET ??
      "access-secret";
    this.accessSecret = new TextEncoder().encode(secret);

    if (!this.isRemoteService && config.serviceImpl) {
      this.initializeLocalService();
    }
  }

  private initializeLocalService() {
    try {
      // If serviceImpl is already an instance (not a class/constructor), use it directly
      if (typeof this.config.serviceImpl === "object" && this.config.serviceImpl !== null) {
        this.serviceInstance = this.config.serviceImpl;
        return;
      }

      let serviceConfig = { ...this.options };

      if (this.config.configEnvVar) {
        const envConfigValue = process.env[this.config.configEnvVar];

        if (envConfigValue) {
          try {
            const envConfig = JSON.parse(envConfigValue);
            serviceConfig = { ...serviceConfig, ...envConfig };
          } catch (error) {
            console.error(
              `Error parsing config from ${this.config.configEnvVar}:`,
              error,
            );
          }
        }
      }

      this.serviceInstance = new this.config.serviceImpl(serviceConfig);
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

  async authorize(
    methodName: string,
    headers: Record<string, string | undefined>,
  ): Promise<void> {
    const mode = this.accessMode;
    if (mode === "off") {
      return;
    }

    const headerName = this.accessControl.headerName ?? "authorization";
    const normalizedHeader = headerName.toLowerCase();
    const tokenHeader =
      headers?.[normalizedHeader] ??
      headers?.[headerName] ??
      headers?.[headerName.toUpperCase()];
    const token = tokenHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      if (mode === "required") {
        const error: any = new Error("Unauthorized");
        error.statusCode = 401;
        throw error;
      }
      return;
    }

    let payload: any;
    try {
      const result = await jwtVerify(token, this.accessSecret, {
        algorithms: ["HS256"],
      });
      payload = result.payload;
    } catch {
      const error: any = new Error("Invalid token");
      error.statusCode = 401;
      throw error;
    }

    const permissions = extractPermissionsFromPayload(payload);
    const matcher = new AccessMatcher(permissions);
    const access =
      this.accessControl.accessResolver?.({
        serviceName: this.config.metadata.serviceName,
        methodName,
        metadata: this.config.metadata,
      }) ?? resolveAccessForMethod(methodName);

    const allowed = matcher.can(
      this.config.metadata.serviceName,
      methodName,
      access,
    );

    if (!allowed) {
      const error: any = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    }
  }

  private resolveAccessMode(): "required" | "optional" | "off" {
    const envFlag = (process.env.NRPC_ACCESS_DISABLED ?? "").toLowerCase();
    if (envFlag === "1" || envFlag === "true" || envFlag === "yes") {
      return "off";
    }

    const envMode = (process.env.NRPC_ACCESS_MODE ?? "").toLowerCase();
    if (envMode === "off" || envMode === "disabled") return "off";
    if (envMode === "required" || envMode === "strict") return "required";
    if (envMode === "optional") return "optional";

    return this.accessControl.mode ?? "optional";
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

    const args = this.buildMethodArgs(methodMetadata, params);
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

    const args = this.buildMethodArgs(methodMetadata, params);

    // Сохраняем ссылку на serviceInstance для использования в ReadableStream
    const serviceInstance = this.serviceInstance;

    return new ReadableStream({
      async start(controller) {
        try {
          const asyncIterable = serviceInstance[methodName](...args);

          if (
            !asyncIterable ||
            typeof asyncIterable[Symbol.asyncIterator] !== "function"
          ) {
            throw new Error(
              `Method ${methodName} did not return an AsyncIterable`,
            );
          }

          for await (const item of asyncIterable) {
            let dataToSend;

            if (Buffer.isBuffer?.(item)) {
              const text = item.toString("utf8");
              try {
                dataToSend = JSON.parse(text);
              } catch {
                dataToSend = { type: "text", content: text };
              }
            } else if (item instanceof Uint8Array) {
              const text = new TextDecoder().decode(item);
              try {
                dataToSend = JSON.parse(text);
              } catch {
                dataToSend = { type: "text", content: text };
              }
            } else if (item instanceof ArrayBuffer) {
              const text = new TextDecoder().decode(item);
              try {
                dataToSend = JSON.parse(text);
              } catch {
                dataToSend = { type: "text", content: text };
              }
            } else if (typeof item === "string") {
              try {
                dataToSend = JSON.parse(item);
              } catch {
                dataToSend = { type: "text", content: item };
              }
            } else if (typeof item === "object" && item !== null) {
              dataToSend = item;
            } else {
              dataToSend = { type: "unknown", content: String(item) };
            }

            const sseData = `data: ${JSON.stringify(dataToSend)}\n\n`;
            controller.enqueue(sseData);
          }

          controller.enqueue(`data: [DONE]\n\n`);
          controller.close();
        } catch (error) {
          console.error(`Error in streaming ${methodName}:`, error);
          controller.enqueue(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          controller.close();
        }
      },
    });
  }

  private buildMethodArgs(
    methodMetadata: ServiceMetadata["methods"][number],
    params: any,
  ) {
    const safeParams = params ?? {};
    const isSingleParam = methodMetadata.parameters.length === 1;

    return methodMetadata.parameters.map((param) => {
      let rawValue = safeParams[param.name];

      // Backward compatibility:
      // allow flat JSON body for single-argument methods, e.g.
      // `{ limit, offset }` for `listQueries(params)`.
      if (
        rawValue === undefined &&
        isSingleParam &&
        safeParams &&
        typeof safeParams === "object" &&
        !Array.isArray(safeParams)
      ) {
        rawValue = safeParams;
      }

      return deserializeValue(rawValue, param.type);
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
