// types.ts
export interface ParameterMetadata {
  name: string;
  type: string;
  optional: boolean;
  isArray: boolean;
}

export interface MethodMetadata {
  name: string;
  parameters: ParameterMetadata[];
  returnType: string;
  isAsync: boolean;
  returnTypeIsArray: boolean;
  isAsyncIterable: boolean; // Новое поле для AsyncIterable методов
}

export interface PropertyMetadata {
  name: string;
  type: string;
  optional: boolean;
  isArray: boolean;
}

export interface TypeMetadata {
  name: string;
  definition: string;
  properties?: PropertyMetadata[];
}

export interface ServiceMetadata {
  serviceName: string;
  interfaceName: string;
  filePath: string;
  methods: MethodMetadata[];
  types: TypeMetadata[];
}

export interface RouteMetadata {
  path: string;
  method: string;
  serviceName: string;
  methodName: string;
}

export interface BackendConfig {
  transport: 'http' | 'grpc' | 'ws';
  serviceUrl?: string;
  servicePath?: string;
  metadata: ServiceMetadata;
}

export interface FrontendConfig {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
  services: Record<string, ServiceClientConfig>;
}

export interface ServiceClientConfig {
  serviceName: string;
  routes: RouteMetadata[];
}