export interface Resources {
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}

export interface ContainerConfig {
  name: string;
  landing?: boolean;
  spa?: boolean;
  microfrontends?: string[] | "*";
  microservices?: string[] | "*";
  runtimes?: string[] | "*";
  resources?: Resources;
}

export interface Preset {
  description?: string;
  containers: ContainerConfig[];
}

export interface StorageConfig {
  defaultSize: string;
  mountBase: string;
  resources?: Resources;
  overrides?: Record<string, { size: string }>;
}

export interface IngressConfig {
  className?: string;
  hosts: string[];
  tls?: {
    enabled?: boolean;
    issuer?: string;
  };
}

export interface RuntimeDeps {
  /** npm packages needed at runtime, e.g. { "sharp": "^0.33.0" } */
  packages?: Record<string, string>;
  /** apk packages for the runtime image, e.g. ["vips"] */
  apk?: string[];
}

export interface RuntimeConfig {
  resources?: Resources;
}

export interface CacheConfig {
  image: string;
  port?: number;
  database?: number;
  keyPrefix?: string;
  ssrTtlSeconds?: number;
  resources?: Resources;
}

export interface BuildConfig {
  name: string;
  description?: string;

  extends?: string;

  baseImage?: string;

  registry?: string;

  landing?: string;

  /** Categories that belong to this project (not inherited from parent) */
  ownCategories?: string[];

  spa: {
    core?: string;
    microfrontends: string[];
  };

  back: {
    core?: string;
    microservices: Record<string, string[]>;
    runtimes?: Record<string, string[]>;
  };

  runtimeDeps?: RuntimeDeps;

  runtime?: RuntimeConfig;

  cache?: CacheConfig;

  presets: Record<string, Preset>;

  storage: StorageConfig;

  ingress: IngressConfig;

  frontend?: {
    mountChatViewModule?: string;
  };

  env?: {
    common?: Record<string, string>;
    secrets?: string[];
  };
}

export interface MicroserviceRef {
  category: string;
  name: string;
  project: string; // which project dir this service lives in
}

export interface RuntimeRef {
  category: string;
  name: string;
  project: string; // which project dir this runtime lives in
}

export interface ResolvedContainer {
  name: string;
  landing: boolean;
  spa: boolean;
  microfrontends: { name: string; project: string }[];
  microservices: MicroserviceRef[];
  runtimes: RuntimeRef[];
  resources: Resources;
}

export interface GeneratorContext {
  config: BuildConfig;
  preset: string;
  namespace: string;
  containers: ResolvedContainer[];
  outputDir: string;
  projectDir: string;
  parentProjectDir?: string;
  storage: StorageConfig;
}
