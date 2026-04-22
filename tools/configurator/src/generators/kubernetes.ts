import type {
  GeneratorContext,
  MicroserviceRef,
  Resources,
  RuntimeRef,
  StorageConfig,
} from "../types";
import {
  buildDeploymentPlan,
  CONFIG_FILE,
  CONFIG_MOUNT,
  DATA_MOUNT,
  RUNTIME_APP_PORT,
  SERVICE_PORT,
  SERVICES_APP_PORT,
  STORAGE_BIN_PATH,
  STORAGE_SOCKET_DIR,
  STORAGE_SOCKET_PATH,
  UI_APP_PORT,
  type DeploymentPlan,
  type RuntimeContainerPlan,
  type ServiceGroupPlan,
} from "../topology";
import * as cdk8s from "cdk8s";

const TRAEFIK_API = "traefik.io/v1alpha1";
const CERTMANAGER_API = "cert-manager.io/v1";
const K3S_HELM_API = "helm.cattle.io/v1";

const HELM_UI_IMAGE = "{{ .Values.images.ui.name }}";
const HELM_UI_TAG = "{{ .Values.images.ui.tag }}";
const HELM_UI_PULL_POLICY = "{{ .Values.images.ui.pullPolicy }}";

const HELM_MS_IMAGE = "{{ .Values.images.ms.name }}";
const HELM_MS_TAG = "{{ .Values.images.ms.tag }}";
const HELM_MS_PULL_POLICY = "{{ .Values.images.ms.pullPolicy }}";

const HELM_RT_IMAGE = "{{ .Values.images.rt.name }}";
const HELM_RT_TAG = "{{ .Values.images.rt.tag }}";
const HELM_RT_PULL_POLICY = "{{ .Values.images.rt.pullPolicy }}";

const HELM_STORAGE_IMAGE = "{{ .Values.images.storage.name }}";
const HELM_STORAGE_TAG = "{{ .Values.images.storage.tag }}";
const HELM_STORAGE_PULL_POLICY = "{{ .Values.images.storage.pullPolicy }}";

const HELM_VALKEY_IMAGE = "{{ .Values.images.valkey.name }}";
const HELM_VALKEY_TAG = "{{ .Values.images.valkey.tag }}";
const HELM_VALKEY_PULL_POLICY = "{{ .Values.images.valkey.pullPolicy }}";

const DEFAULT_STORAGE_RESOURCES: Resources = {
  requests: { cpu: "200m", memory: "128Mi" },
  limits: { cpu: "1000m", memory: "2Gi" },
};

function buildHttpHealthProbes(port: number) {
  const base = {
    httpGet: { path: "/health", port },
    timeoutSeconds: 2,
  };
  return {
    startupProbe: {
      ...base,
      periodSeconds: 2,
      failureThreshold: 120,
    },
    readinessProbe: {
      ...base,
      periodSeconds: 5,
      failureThreshold: 6,
    },
    livenessProbe: {
      ...base,
      periodSeconds: 10,
      failureThreshold: 3,
    },
  };
}

function buildStorageHealthProbes() {
  const base = {
    exec: {
      command: [
        STORAGE_BIN_PATH,
        "health",
        "--socket",
        STORAGE_SOCKET_PATH,
        "--timeout-ms",
        "1000",
      ],
    },
    timeoutSeconds: 2,
  };
  return {
    startupProbe: {
      ...base,
      periodSeconds: 2,
      failureThreshold: 60,
    },
    readinessProbe: {
      ...base,
      periodSeconds: 5,
      failureThreshold: 3,
    },
    livenessProbe: {
      ...base,
      periodSeconds: 10,
      failureThreshold: 3,
    },
  };
}

function buildValkeyHealthProbes(port: number) {
  const base = {
    tcpSocket: { port },
    timeoutSeconds: 2,
  };
  return {
    startupProbe: {
      ...base,
      periodSeconds: 2,
      failureThreshold: 60,
    },
    readinessProbe: {
      ...base,
      periodSeconds: 5,
      failureThreshold: 6,
    },
    livenessProbe: {
      ...base,
      periodSeconds: 10,
      failureThreshold: 3,
    },
  };
}

function buildStorageContainer(dataClaimName: string, ctx: GeneratorContext) {
  const resources = ctx.storage.resources ?? DEFAULT_STORAGE_RESOURCES;
  return {
    name: "storage",
    image: storageImageUri(),
    imagePullPolicy: HELM_STORAGE_PULL_POLICY,
    restartPolicy: "Always",
    command: [STORAGE_BIN_PATH, "start", "--data-dir", DATA_MOUNT, "--socket", STORAGE_SOCKET_PATH],
    resources: toK8sResources(resources),
    ...buildStorageHealthProbes(),
    securityContext: {
      allowPrivilegeEscalation: false,
      privileged: false,
      readOnlyRootFilesystem: false,
      runAsNonRoot: false,
    },
    volumeMounts: [
      { name: dataClaimName, mountPath: DATA_MOUNT },
      { name: "storage-socket", mountPath: STORAGE_SOCKET_DIR },
    ],
  };
}

function uiImageUri(): string {
  return `${HELM_UI_IMAGE}:${HELM_UI_TAG}`;
}

function msImageUri(): string {
  return `${HELM_MS_IMAGE}:${HELM_MS_TAG}`;
}

function rtImageUri(): string {
  return `${HELM_RT_IMAGE}:${HELM_RT_TAG}`;
}

function storageImageUri(): string {
  return `${HELM_STORAGE_IMAGE}:${HELM_STORAGE_TAG}`;
}

function valkeyImageUri(): string {
  return `${HELM_VALKEY_IMAGE}:${HELM_VALKEY_TAG}`;
}

function parseSizeGi(raw: string | undefined, fallbackGi: number): number {
  if (!raw) return fallbackGi;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallbackGi;
}

function diskSizeForGroup(storage: StorageConfig, group?: ServiceGroupPlan): string {
  let maxGi = parseSizeGi(storage.defaultSize, 5);
  for (const svc of group?.microservices ?? []) {
    const overrideSize = storage.overrides?.[svc.name]?.size;
    maxGi = Math.max(maxGi, parseSizeGi(overrideSize, maxGi));
  }
  return `${maxGi}Gi`;
}

function labels(app: string, component: string): Record<string, string> {
  return { app, component };
}

function buildMicroserviceMap(services: MicroserviceRef[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const svc of services) {
    (map[svc.category] ??= []).push(svc.name);
  }
  return map;
}

function buildFrontendModules(plan: DeploymentPlan): Record<string, boolean> {
  const modules: Record<string, boolean> = {};
  for (const mf of plan.ui.microfrontends) {
    modules[mf.name] = true;
  }
  return modules;
}

function toEnvList(values: Record<string, string>) {
  return Object.entries(values).map(([name, value]) => ({ name, value }));
}

function buildBaseEnv(
  ctx: GeneratorContext,
  port: number,
  extra: Record<string, string> = {},
) {
  const env: Record<string, string> = {
    NODE_ENV: "production",
    PORT: String(port),
    DATA_DIR: DATA_MOUNT,
    CONFIG_PATH: `${CONFIG_MOUNT}/${CONFIG_FILE}`,
    ...extra,
  };

  for (const [k, v] of Object.entries(ctx.config.env?.common ?? {})) {
    if (k === "NODE_ENV" || k === "PORT" || k === "CONFIG_PATH" || k === "DATA_DIR") continue;
    env[k] = v;
  }

  return toEnvList(env);
}

function toK8sResources(resources?: Resources): Record<string, any> | undefined {
  if (!resources) return undefined;

  const requests: Record<string, string> = {};
  if (resources.requests?.cpu) requests.cpu = resources.requests.cpu;
  if (resources.requests?.memory) requests.memory = resources.requests.memory;

  const limits: Record<string, string> = {};
  if (resources.limits?.cpu) limits.cpu = resources.limits.cpu;
  if (resources.limits?.memory) limits.memory = resources.limits.memory;

  const result: Record<string, any> = {};
  if (Object.keys(requests).length > 0) result.requests = requests;
  if (Object.keys(limits).length > 0) result.limits = limits;

  return Object.keys(result).length > 0 ? result : undefined;
}

function createConfigMap(
  chart: cdk8s.Chart,
  id: string,
  name: string,
  resourceLabels: Record<string, string>,
  config: unknown,
) {
  return new cdk8s.ApiObject(chart, id, {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name, labels: resourceLabels },
    data: {
      [CONFIG_FILE]: JSON.stringify(config, null, 2),
    },
  });
}

function createClusterService(
  chart: cdk8s.Chart,
  id: string,
  name: string,
  resourceLabels: Record<string, string>,
  selector: Record<string, string>,
  targetPort: number,
) {
  return new cdk8s.ApiObject(chart, id, {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name, labels: resourceLabels },
    spec: {
      type: "ClusterIP",
      selector,
      ports: [
        {
          port: SERVICE_PORT,
          targetPort,
        },
      ],
    },
  });
}

function createHeadlessService(
  chart: cdk8s.Chart,
  id: string,
  name: string,
  selector: Record<string, string>,
  targetPort: number,
) {
  return new cdk8s.ApiObject(chart, id, {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name },
    spec: {
      type: "ClusterIP",
      clusterIP: "None",
      selector,
      ports: [
        {
          port: targetPort,
          targetPort,
        },
      ],
    },
  });
}

class WorkloadBuilder {
  constructor(
    private chart: cdk8s.Chart,
    private ctx: GeneratorContext,
    private plan: DeploymentPlan,
  ) {}

  build() {
    if (this.plan.mode === "mono") {
      this.buildMonoPod();
      return;
    }

    this.buildValkeyDeployment();
    this.buildUiPod();
    for (const runtime of this.plan.runtime.containers) {
      this.buildRuntimePod(runtime);
    }
    for (const group of this.plan.serviceGroups) {
      this.buildGroupPod(group);
    }
  }

  private runtimeServicesBase(): string {
    const firstGroup = this.plan.serviceGroups[0];
    return firstGroup ? `http://${firstGroup.serviceName}:${SERVICE_PORT}/services` : "";
  }

  private buildValkeyDeployment() {
    const appName = this.ctx.config.name;
    const podLabels = labels(appName, "valkey");

    new cdk8s.ApiObject(this.chart, "valkey-deployment", {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: this.plan.cache.serviceName, labels: podLabels },
      spec: {
        replicas: 1,
        selector: { matchLabels: podLabels },
        template: {
          metadata: { labels: podLabels },
          spec: {
            containers: [
              {
                name: "valkey",
                image: valkeyImageUri(),
                imagePullPolicy: HELM_VALKEY_PULL_POLICY,
                command: ["valkey-server", "--save", "", "--appendonly", "no"],
                ports: [{ containerPort: this.plan.cache.port }],
                env: toEnvList({
                  PORT: String(this.plan.cache.port),
                }),
                ...buildValkeyHealthProbes(this.plan.cache.port),
                resources: toK8sResources(this.plan.cache.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
              },
            ],
            securityContext: {
              runAsNonRoot: false,
            },
          },
        },
      },
    });

    createClusterService(
      this.chart,
      "valkey-service",
      this.plan.cache.serviceName,
      podLabels,
      podLabels,
      this.plan.cache.port,
    );
  }

  private buildUiPod() {
    const appName = this.ctx.config.name;
    const podLabels = labels(appName, "ui");
    const configMapName = `${appName}-ui-config`;
    const secretName = `${appName}-secrets`;

    createConfigMap(
      this.chart,
      "ui-config",
      configMapName,
      podLabels,
      {
        name: appName,
        landing: this.plan.ui.landing ? this.ctx.config.landing : undefined,
        spa: this.plan.ui.spa ? this.ctx.config.spa : undefined,
        back: {
          core: this.ctx.config.back.core,
          microservices: {},
        },
      },
    );

    new cdk8s.ApiObject(this.chart, "ui-deployment", {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: `${appName}-ui`, labels: podLabels },
      spec: {
        replicas: 1,
        selector: { matchLabels: podLabels },
        template: {
          metadata: { labels: podLabels },
          spec: {
            containers: [
              {
                name: "ui",
                image: uiImageUri(),
                imagePullPolicy: HELM_UI_PULL_POLICY,
                ports: [{ containerPort: UI_APP_PORT }],
                env: buildBaseEnv(this.ctx, UI_APP_PORT, {
                  VALKEY_URL: this.plan.cache.url,
                }),
                envFrom: [{ secretRef: { name: secretName } }],
                ...buildHttpHealthProbes(UI_APP_PORT),
                resources: toK8sResources(this.plan.ui.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
                volumeMounts: [
                  { name: "ui-data", mountPath: DATA_MOUNT },
                  {
                    name: "ui-config",
                    mountPath: CONFIG_MOUNT,
                    readOnly: true,
                  },
                ],
              },
            ],
            securityContext: {
              runAsNonRoot: false,
            },
            volumes: [
              { name: "ui-data", emptyDir: {} },
              {
                name: "ui-config",
                configMap: { name: configMapName },
              },
            ],
          },
        },
      },
    });

    createClusterService(
      this.chart,
      "ui-service",
      this.plan.ui.serviceName,
      podLabels,
      podLabels,
      UI_APP_PORT,
    );
  }

  private buildRuntimePod(runtime: RuntimeContainerPlan) {
    const appName = this.ctx.config.name;
    const podName = runtime.serviceName;
    const podLabels = labels(appName, runtime.name);
    const secretName = `${appName}-secrets`;

    new cdk8s.ApiObject(this.chart, `${runtime.name}-deployment`, {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: podName, labels: podLabels },
      spec: {
        replicas: 1,
        selector: { matchLabels: podLabels },
        template: {
          metadata: { labels: podLabels },
          spec: {
            containers: [
              {
                name: runtime.name,
                image: rtImageUri(),
                imagePullPolicy: HELM_RT_PULL_POLICY,
                ports: [{ containerPort: RUNTIME_APP_PORT }],
                env: buildBaseEnv(this.ctx, RUNTIME_APP_PORT, {
                  SERVICES_BASE: this.runtimeServicesBase(),
                  VALKEY_URL: this.plan.cache.url,
                  RT_RUNTIMES: runtime.runtimes.map((rt) => `${rt.category}/${rt.name}`).join(","),
                }),
                envFrom: [{ secretRef: { name: secretName } }],
                ...buildHttpHealthProbes(RUNTIME_APP_PORT),
                resources: toK8sResources(runtime.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
              },
            ],
            securityContext: {
              runAsNonRoot: false,
            },
          },
        },
      },
    });

    createClusterService(
      this.chart,
      `${runtime.name}-service`,
      runtime.serviceName,
      podLabels,
      podLabels,
      RUNTIME_APP_PORT,
    );
  }

  private buildGroupPod(group: ServiceGroupPlan) {
    const appName = this.ctx.config.name;
    const podName = `${appName}-${group.name}`;
    const podLabels = labels(appName, group.name);
    const configMapName = `${podName}-config`;
    const dataClaimName = `${podName}-data`;
    const headlessServiceName = `${podName}-headless`;
    const secretName = `${appName}-secrets`;

    createConfigMap(
      this.chart,
      `${group.name}-config`,
      configMapName,
      podLabels,
      {
        name: appName,
        spa: this.plan.ui.spa ? this.ctx.config.spa : undefined,
        back: {
          core: this.ctx.config.back.core,
          microservices: buildMicroserviceMap(group.microservices),
        },
        frontend: {
          modules: buildFrontendModules(this.plan),
        },
      },
    );

    createHeadlessService(
      this.chart,
      `${group.name}-headless`,
      headlessServiceName,
      podLabels,
      SERVICES_APP_PORT,
    );

    new cdk8s.ApiObject(this.chart, `${group.name}-statefulset`, {
      apiVersion: "apps/v1",
      kind: "StatefulSet",
      metadata: { name: podName, labels: podLabels },
      spec: {
        replicas: 1,
        serviceName: headlessServiceName,
        selector: { matchLabels: podLabels },
        template: {
          metadata: { labels: podLabels },
          spec: {
            initContainers: [buildStorageContainer(dataClaimName, this.ctx)],
            containers: [
              {
                name: "services",
                image: msImageUri(),
                imagePullPolicy: HELM_MS_PULL_POLICY,
                ports: [{ containerPort: SERVICES_APP_PORT }],
                env: buildBaseEnv(this.ctx, SERVICES_APP_PORT, {
                  STORAGE_SOCKET_PATH,
                  VALKEY_URL: this.plan.cache.url,
                }),
                envFrom: [{ secretRef: { name: secretName } }],
                ...buildHttpHealthProbes(SERVICES_APP_PORT),
                resources: toK8sResources(group.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
                volumeMounts: [
                  { name: dataClaimName, mountPath: DATA_MOUNT },
                  {
                    name: "services-config",
                    mountPath: CONFIG_MOUNT,
                    readOnly: true,
                  },
                  {
                    name: "storage-socket",
                    mountPath: STORAGE_SOCKET_DIR,
                  },
                ],
              },
            ],
            securityContext: {
              runAsNonRoot: false,
            },
            volumes: [
              {
                name: "services-config",
                configMap: { name: configMapName },
              },
              {
                name: "storage-socket",
                emptyDir: {},
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: { name: dataClaimName },
            spec: {
              accessModes: ["ReadWriteOnce"],
              resources: {
                requests: {
                  storage: diskSizeForGroup(this.ctx.storage, group),
                },
              },
              storageClassName: "local-path",
            },
          },
        ],
      },
    });

    createClusterService(
      this.chart,
      `${group.name}-service`,
      group.serviceName,
      podLabels,
      podLabels,
      SERVICES_APP_PORT,
    );
  }

  private buildMonoPod() {
    const appName = this.ctx.config.name;
    const monoGroup = this.plan.serviceGroups[0];
    const podName = `${appName}-mono`;
    const podLabels = labels(appName, "mono");
    const uiConfigMapName = `${podName}-ui-config`;
    const servicesConfigMapName = `${podName}-services-config`;
    const dataClaimName = `${podName}-data`;
    const headlessServiceName = `${podName}-headless`;
    const secretName = `${appName}-secrets`;

    createConfigMap(
      this.chart,
      "mono-ui-config",
      uiConfigMapName,
      podLabels,
      {
        name: appName,
        landing: this.plan.ui.landing ? this.ctx.config.landing : undefined,
        spa: this.plan.ui.spa ? this.ctx.config.spa : undefined,
        back: {
          core: this.ctx.config.back.core,
          microservices: {},
        },
      },
    );

    createConfigMap(
      this.chart,
      "mono-services-config",
      servicesConfigMapName,
      podLabels,
      {
        name: appName,
        spa: this.plan.ui.spa ? this.ctx.config.spa : undefined,
        back: {
          core: this.ctx.config.back.core,
          microservices: buildMicroserviceMap(monoGroup.microservices),
        },
        frontend: {
          modules: buildFrontendModules(this.plan),
        },
      },
    );

    createHeadlessService(
      this.chart,
      "mono-headless",
      headlessServiceName,
      podLabels,
      SERVICES_APP_PORT,
    );

    new cdk8s.ApiObject(this.chart, "mono-statefulset", {
      apiVersion: "apps/v1",
      kind: "StatefulSet",
      metadata: { name: podName, labels: podLabels },
      spec: {
        replicas: 1,
        serviceName: headlessServiceName,
        selector: { matchLabels: podLabels },
        template: {
          metadata: { labels: podLabels },
          spec: {
            initContainers: [buildStorageContainer(dataClaimName, this.ctx)],
            containers: [
              {
                name: "ui",
                image: uiImageUri(),
                imagePullPolicy: HELM_UI_PULL_POLICY,
                ports: [{ containerPort: UI_APP_PORT }],
                env: buildBaseEnv(this.ctx, UI_APP_PORT, {
                  SERVICES_BASE: `http://127.0.0.1:${SERVICES_APP_PORT}/services`,
                  VALKEY_URL: this.plan.cache.url,
                }),
                envFrom: [{ secretRef: { name: secretName } }],
                ...buildHttpHealthProbes(UI_APP_PORT),
                resources: toK8sResources(this.plan.ui.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
                volumeMounts: [
                  { name: dataClaimName, mountPath: DATA_MOUNT },
                  {
                    name: "ui-config",
                    mountPath: CONFIG_MOUNT,
                    readOnly: true,
                  },
                ],
              },
              {
                name: "services",
                image: msImageUri(),
                imagePullPolicy: HELM_MS_PULL_POLICY,
                ports: [{ containerPort: SERVICES_APP_PORT }],
                env: buildBaseEnv(this.ctx, SERVICES_APP_PORT, {
                  STORAGE_SOCKET_PATH,
                  VALKEY_URL: this.plan.cache.url,
                }),
                envFrom: [{ secretRef: { name: secretName } }],
                ...buildHttpHealthProbes(SERVICES_APP_PORT),
                resources: toK8sResources(monoGroup.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
                volumeMounts: [
                  { name: dataClaimName, mountPath: DATA_MOUNT },
                  {
                    name: "services-config",
                    mountPath: CONFIG_MOUNT,
                    readOnly: true,
                  },
                  {
                    name: "storage-socket",
                    mountPath: STORAGE_SOCKET_DIR,
                  },
                ],
              },
              {
                name: "rt",
                image: rtImageUri(),
                imagePullPolicy: HELM_RT_PULL_POLICY,
                ports: [{ containerPort: RUNTIME_APP_PORT }],
                env: toEnvList({
                  NODE_ENV: "production",
                  PORT: String(RUNTIME_APP_PORT),
                  SERVICES_BASE: `http://127.0.0.1:${SERVICES_APP_PORT}/services`,
                  VALKEY_URL: this.plan.cache.url,
                }),
                envFrom: [{ secretRef: { name: secretName } }],
                ...buildHttpHealthProbes(RUNTIME_APP_PORT),
                resources: toK8sResources(this.plan.runtime.containers[0]?.resources ?? monoGroup.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
              },
              {
                name: "valkey",
                image: valkeyImageUri(),
                imagePullPolicy: HELM_VALKEY_PULL_POLICY,
                command: ["valkey-server", "--save", "", "--appendonly", "no"],
                ports: [{ containerPort: this.plan.cache.port }],
                env: toEnvList({
                  PORT: String(this.plan.cache.port),
                }),
                ...buildValkeyHealthProbes(this.plan.cache.port),
                resources: toK8sResources(this.plan.cache.resources),
                securityContext: {
                  allowPrivilegeEscalation: false,
                  privileged: false,
                  readOnlyRootFilesystem: false,
                  runAsNonRoot: false,
                },
              },
            ],
            securityContext: {
              runAsNonRoot: false,
            },
            volumes: [
              { name: "ui-config", configMap: { name: uiConfigMapName } },
              {
                name: "services-config",
                configMap: { name: servicesConfigMapName },
              },
              {
                name: "storage-socket",
                emptyDir: {},
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: { name: dataClaimName },
            spec: {
              accessModes: ["ReadWriteOnce"],
              resources: {
                requests: {
                  storage: diskSizeForGroup(this.ctx.storage, monoGroup),
                },
              },
              storageClassName: "local-path",
            },
          },
        ],
      },
    });

    createClusterService(
      this.chart,
      "mono-ui-service",
      this.plan.ui.serviceName,
      labels(appName, "ui"),
      podLabels,
      UI_APP_PORT,
    );

    createClusterService(
      this.chart,
      "mono-services-service",
      monoGroup.serviceName,
      labels(appName, "services"),
      podLabels,
      SERVICES_APP_PORT,
    );

    createClusterService(
      this.chart,
      "mono-runtime-service",
      this.plan.runtime.containers[0]?.serviceName ?? `${appName}-runtime`,
      labels(appName, "runtime"),
      podLabels,
      RUNTIME_APP_PORT,
    );
  }
}

class IngressBuilder {
  private routes: { match: string; priority: number; service: string }[] = [];

  constructor(
    private chart: cdk8s.Chart,
    private ctx: GeneratorContext,
    private plan: DeploymentPlan,
  ) {}

  build() {
    this.collectRoutes();
    this.routes.sort((a, b) => b.priority - a.priority);
    this.createIngressRoute();
  }

  private collectRoutes() {
    const hosts = this.ctx.config.ingress.hosts;
    const seenServicePaths = new Set<string>();

    for (const runtime of this.plan.runtime.containers) {
      for (const runtimePath of this.runtimeServicePaths(runtime.runtimes)) {
        for (const host of hosts) {
          this.routes.push({
            match: `Host(\`${host}\`) && PathPrefix(\`/runtime/${runtimePath}\`)`,
            priority: 110,
            service: runtime.serviceName,
          });
        }
      }
    }

    for (const group of this.plan.serviceGroups) {
      for (const ms of group.microservices) {
        if (seenServicePaths.has(ms.name)) continue;
        seenServicePaths.add(ms.name);

        for (const host of hosts) {
          this.routes.push({
            match: `Host(\`${host}\`) && PathPrefix(\`/services/${ms.name}\`)`,
            priority: 100,
            service: group.serviceName,
          });
        }
      }
    }

    for (const host of hosts) {
      this.routes.push({
        match: `Host(\`${host}\`) && PathPrefix(\`/console\`)`,
        priority: 10,
        service: this.plan.ui.serviceName,
      });
    }

    if (this.plan.ui.landing) {
      for (const host of hosts) {
        this.routes.push({
          match: `Host(\`${host}\`) && PathPrefix(\`/\`)`,
          priority: 1,
          service: this.plan.ui.serviceName,
        });
      }
    }
  }

  private runtimeServicePaths(runtimes: RuntimeRef[]): string[] {
    const paths = new Set<string>();
    for (const runtime of runtimes) {
      paths.add(runtime.name);
    }
    return Array.from(paths);
  }

  private createIngressRoute() {
    const { config } = this.ctx;

    new cdk8s.ApiObject(this.chart, "ingress-route", {
      apiVersion: TRAEFIK_API,
      kind: "IngressRoute",
      metadata: { name: `${config.name}-ingress` },
      spec: {
        entryPoints: ["web"],
        routes: this.routes.map((route) => ({
          match: route.match,
          kind: "Rule",
          priority: route.priority,
          services: [{ name: route.service, port: SERVICE_PORT }],
        })),
        ...(config.ingress.tls?.enabled && {
          tls: { secretName: `${config.name}-tls` },
        }),
      },
    });
  }
}

class CertificateBuilder {
  constructor(private chart: cdk8s.Chart, private ctx: GeneratorContext) {}

  build() {
    const { config } = this.ctx;
    if (!config.ingress.tls?.enabled) return;

    const issuer = config.ingress.tls.issuer || "letsencrypt-prod";

    new cdk8s.ApiObject(this.chart, "certificate", {
      apiVersion: CERTMANAGER_API,
      kind: "Certificate",
      metadata: { name: `${config.name}-tls` },
      spec: {
        secretName: `${config.name}-tls`,
        issuerRef: { name: issuer, kind: "ClusterIssuer" },
        dnsNames: config.ingress.hosts,
      },
    });
  }
}

class K3sHelmChartBuilder {
  constructor(
    private chart: cdk8s.Chart,
    private ctx: GeneratorContext,
    private chartBase64: string,
  ) {}

  build() {
    const { config, preset } = this.ctx;

    new cdk8s.ApiObject(this.chart, "k3s-helmchart", {
      apiVersion: K3S_HELM_API,
      kind: "HelmChart",
      metadata: { name: `${config.name}-${preset}`, namespace: "kube-system" },
      spec: {
        chartContent: this.chartBase64,
        targetNamespace: this.ctx.namespace,
        createNamespace: true,
      },
    });
  }
}

export function generateKubernetesManifests(
  ctx: GeneratorContext,
  chartBase64?: string,
) {
  const helmDir = `${ctx.outputDir}/helm`;

  const app = new cdk8s.App({ outdir: `${helmDir}/templates` });
  const chart = new cdk8s.Chart(app, ctx.config.name);
  const plan = buildDeploymentPlan(ctx);

  new WorkloadBuilder(chart, ctx, plan).build();
  new IngressBuilder(chart, ctx, plan).build();
  new CertificateBuilder(chart, ctx).build();
  app.synth();

  if (chartBase64) {
    const k3sApp = new cdk8s.App({ outdir: ctx.outputDir });
    const k3sChart = new cdk8s.Chart(k3sApp, "k3s-chart");
    new K3sHelmChartBuilder(k3sChart, ctx, chartBase64).build();
    k3sApp.synth();
  }
}
