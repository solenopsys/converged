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
  
  call(methodName: string, params: any[]): any {
    const method = this.metadata.methods.find(m => m.name === methodName);
    if (!method) {
      throw new Error(`Method ${methodName} not found in service ${this.metadata.serviceName}`);
    }
    
    if (method.isAsyncIterable) {
      return this.callStreaming(methodName, params);
    }
    
    return this.callRegular(methodName, params);
  }

  private async callRegular(methodName: string, params: any[]): Promise<any> {
    const method = this.metadata.methods.find(m => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}`;
    const body = this.prepareParams(method!.parameters, params);
    
    this.abortController = new AbortController();
    
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.timeout);
    
    try {
      const url = `${this.baseUrl}${path}`;
      const response = await fetch(url, {
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
      
      if (method!.returnType === 'void') {
        return undefined;
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      } else {
        return response.text();
      }
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  private callStreaming(methodName: string, params: any[]): AsyncIterable<any> {
    const method = this.metadata.methods.find(m => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}/stream`;
    const body = this.prepareParams(method!.parameters, params);
    const self = this;
    
    return {
      async *[Symbol.asyncIterator]() {
        self.abortController = new AbortController();
        
        const response = await fetch(`${self.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...self.headers
          },
          body: JSON.stringify(body),
          signal: self.abortController.signal
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
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              
              try {
                if (trimmed.startsWith('data: ')) {
                  const data = trimmed.slice(6);
                  if (data === '[DONE]') {
                    return;
                  }
                  yield JSON.parse(data);
                } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                  yield JSON.parse(trimmed);
                }
              } catch (error) {
                console.error('Error parsing streaming data:', error);
              }
            }
          }
        } finally {
          reader.releaseLock();
          self.abortController = null;
        }
      }
    };
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
  
  abort() {
    this.abortController?.abort();
  }
}

function createProxy(client: HttpClientImpl, metadata: ServiceMetadata): any {
  const proxy: Record<string, any> = {};
  
  metadata.methods.forEach(method => {
    proxy[method.name] = (...args: any[]) => {
      console.log('DEBUG proxy call:', {
        methodName: method.name,
        args: args,
        argsLength: args.length,
        methodParameters: method.parameters
      });
      
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
  
  proxy._abort = () => client.abort();
  proxy._metadata = metadata;
  
  return proxy;
}