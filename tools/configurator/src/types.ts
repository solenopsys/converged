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
  resources?: Resources;
}

export interface Preset {
  description?: string;
  containers: ContainerConfig[] | "auto";
}

export interface StorageConfig {
  defaultSize: string;
  mountBase: string;
  overrides?: Record<string, { size: string }>;
}

export interface IngressConfig {
  className?: string;
  host: string;
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

export interface BuildConfig {
  name: string;
  description?: string;

  extends?: string;

  baseImage?: string;

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
  };

  runtimeDeps?: RuntimeDeps;

  presets: Record<string, Preset>;

  storage: StorageConfig;

  ingress: IngressConfig;

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

export interface ResolvedContainer {
  name: string;
  landing: boolean;
  spa: boolean;
  microfrontends: { name: string; project: string }[];
  microservices: MicroserviceRef[];
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
