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
  isAsyncIterable: boolean;
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
  kind?: "type" | "interface" | "raw";
  typeParameters?: string;
  properties?: PropertyMetadata[];
}

export interface ServiceMetadata {
  serviceName: string;
  interfaceName: string;
  /**
   * The Fujin peer this service is reachable behind, declared in the service
   * file as `@nrpcTarget <peer>`. Microservices live in the runtime the caller
   * is already connected to and leave it unset; a native peer — centimanus,
   * resonus — is somewhere else, and every caller having to remember that is
   * how a call silently ends up at the wrong door.
   */
  target?: string;
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
  transport: 'messaging' | 'http' | 'grpc' | 'ws';
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
