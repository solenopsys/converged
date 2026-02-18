// nrpc-runtime/http-client.ts
import type { ServiceMetadata } from "../types";
import { serializeValue, deserializeValue } from "./serialization";

export interface ClientConfig {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export function createHttpClient<T>(
  metadata: ServiceMetadata,
  config: ClientConfig = {},
): T {
  const client = new HttpClientImpl(metadata, config);
  return createProxy(client, metadata) as T;
}

class HttpClientImpl {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(
    private metadata: ServiceMetadata,
    config: ClientConfig,
  ) {
    const envBase = typeof process !== "undefined" ? process.env?.SERVICES_BASE : undefined;
    this.baseUrl = config.baseUrl || envBase || "/services";
    this.timeout = config.timeout || 5000;
    this.headers = config.headers || {};
  }

  call(methodName: string, params: any[]): any {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    if (!method) {
      throw new Error(
        `Method ${methodName} not found in service ${this.metadata.serviceName}`,
      );
    }

    if (method.isAsyncIterable) {
      return this.callStreaming(methodName, params);
    }

    return this.callRegular(methodName, params);
  }

  private async callRegular(methodName: string, params: any[]): Promise<any> {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}`;
    const body = this.prepareParams(method!.parameters, params);

    // Локальный AbortController для каждого запроса
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeout);

    try {
      const url = `${this.baseUrl}${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${url} ${response.status}: ${response.statusText}`;

        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // ignore
        }

        throw new Error(errorMessage);
      }

      if (method!.returnType === "void") {
        return undefined;
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return deserializeValue(data, method!.returnType);
      } else {
        return response.text();
      }
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  private callStreaming(methodName: string, params: any[]): AsyncIterable<any> {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}/stream`;
    const body = this.prepareParams(method!.parameters, params);
    const self = this;

    return {
      async *[Symbol.asyncIterator]() {
        // Локальный AbortController для стрима
        const abortController = new AbortController();

        const response = await fetch(`${self.baseUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...self.headers,
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // ignore
          }
          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let eventStart = 0;
            let eventEnd = buffer.indexOf("\n\n");

            while (eventEnd !== -1) {
              const eventData = buffer.slice(eventStart, eventEnd);

              const lines = eventData.split("\n");
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6);

                  if (data === "[DONE]") {
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const deserialized = deserializeValue(
                      parsed,
                      method!.returnType,
                    );
                    yield deserialized;
                  } catch (error) {
                    console.error("Error parsing JSON data:", data, error);
                  }
                }
              }

              eventStart = eventEnd + 2;
              eventEnd = buffer.indexOf("\n\n", eventStart);
            }

            buffer = buffer.slice(eventStart);
          }
        } finally {
          reader.releaseLock();
        }
      },
    };
  }

  private prepareParams(paramDefs: any[], params: any[]): Record<string, any> {
    const result: Record<string, any> = {};

    paramDefs.forEach((def, index) => {
      if (params[index] !== undefined) {
        result[def.name] = serializeValue(params[index], def.type);
      } else if (!def.optional) {
        throw new Error(`Required parameter '${def.name}' is missing`);
      }
    });

    return result;
  }
}

function createProxy(client: HttpClientImpl, metadata: ServiceMetadata): any {
  const proxy: Record<string, any> = {};

  metadata.methods.forEach((method) => {
    proxy[method.name] = (...args: any[]) => {
      const requiredParamsCount = method.parameters.filter(
        (p) => !p.optional,
      ).length;
      const totalParamsCount = method.parameters.length;

      if (args.length < requiredParamsCount) {
        throw new Error(
          `Method ${method.name} requires at least ${requiredParamsCount} arguments, got ${args.length}`,
        );
      }

      if (args.length > totalParamsCount) {
        throw new Error(
          `Method ${method.name} accepts at most ${totalParamsCount} arguments, got ${args.length}`,
        );
      }

      return client.call(method.name, args);
    };
  });

  proxy._metadata = metadata;

  return proxy;
}
