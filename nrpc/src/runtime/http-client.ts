// nrpc-runtime/http-client.ts
import type { ServiceMetadata } from '../types';

export interface ClientConfig {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export function createHttpClient<T>(
  metadata: ServiceMetadata,
  config: ClientConfig = {}
): T {
  const client = new HttpClientImpl(metadata, config);
  return createProxy(client, metadata) as T;
}

class HttpClientImpl {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;
  private abortController: AbortController | null = null;
  
  constructor(
    private metadata: ServiceMetadata,
    config: ClientConfig
  ) {
    this.baseUrl = config.baseUrl || "/services";
    this.timeout = config.timeout || 5000;
    this.headers = config.headers || {};
  }
  
  async call(methodName: string, params: any[]): Promise<any> {
    const method = this.metadata.methods.find(m => m.name === methodName);
    if (!method) {
      throw new Error(`Method ${methodName} not found in service ${this.metadata.serviceName}`);
    }
    
    // Простой путь: /serviceName/methodName
    const path = `/${this.metadata.serviceName}/${methodName}`;
    const body = this.prepareParams(method.parameters, params);
    
    // Создаем новый AbortController для каждого запроса
    this.abortController = new AbortController();
    
    // Устанавливаем таймаут
    const timeoutId = setTimeout(() => {
      if (this.abortController) {
        this.abortController.abort();
      }
    }, this.timeout);
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Пытаемся получить детали ошибки из ответа
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Игнорируем ошибки парсинга
        }
        
        throw new Error(errorMessage);
      }
      
      // Проверяем, что ответ не пустой для методов, которые должны что-то возвращать
      if (method.returnType === 'void') {
        return undefined;
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        return response.text();
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    } finally {
      this.abortController = null;
    }
  }
  
  private prepareParams(paramDefs: any[], params: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    paramDefs.forEach((def, index) => {
      if (params[index] !== undefined) {
        result[def.name] = params[index];
      } else if (!def.optional) {
        throw new Error(`Required parameter '${def.name}' is missing`);
      }
    });
    
    return result;
  }
  
  // Метод для отмены текущего запроса
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

function createProxy(client: HttpClientImpl, metadata: ServiceMetadata): any {
  const proxy: Record<string, any> = {};
  
  metadata.methods.forEach(method => {
    proxy[method.name] = (...args: any[]) => {
      // Валидация количества аргументов
      const requiredParamsCount = method.parameters.filter(p => !p.optional).length;
      const totalParamsCount = method.parameters.length;
      
      if (args.length < requiredParamsCount) {
        throw new Error(
          `Method ${method.name} requires at least ${requiredParamsCount} arguments, got ${args.length}`
        );
      }
      
      if (args.length > totalParamsCount) {
        throw new Error(
          `Method ${method.name} accepts at most ${totalParamsCount} arguments, got ${args.length}`
        );
      }
      
      return client.call(method.name, args);
    };
  });
  
  // Добавляем вспомогательные методы
  proxy._abort = () => client.abort();
  proxy._metadata = metadata;
  
  return proxy;
}