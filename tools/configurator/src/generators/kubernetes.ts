import type { GeneratorContext, ResolvedContainer, StorageConfig } from "../types";
import * as cdk8s from "cdk8s";
import * as kplus from "cdk8s-plus-31";

const APP_PORT = 3000;
const SERVICE_PORT = 80;
const DATA_MOUNT = "/app/data";
const CONFIG_MOUNT = "/app/config";
const CONFIG_FILE = "config.json";

const TRAEFIK_API = "traefik.io/v1alpha1";
const CERTMANAGER_API = "cert-manager.io/v1";
const K3S_HELM_API = "helm.cattle.io/v1";

const HELM_HOST = "{{ .Values.ingress.host }}";
const HELM_IMAGE = "{{ .Values.image.name }}";
const HELM_TAG = "{{ .Values.image.tag }}";
const HELM_PULL_POLICY = "{{ .Values.image.pullPolicy }}";

// --- Helpers ---

function diskSize(storage: StorageConfig): number {
  const raw = storage.defaultSize;
  return parseInt(raw);
}

function imageUri(): string {
  return `${HELM_IMAGE}:${HELM_TAG}`;
}

function buildMicroserviceMap(container: ResolvedContainer): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const svc of container.microservices) {
    (map[svc.category] ??= []).push(svc.name);
  }
  return map;
}

function buildEnv(chart: cdk8s.Chart, ctx: GeneratorContext, container: ResolvedContainer): Record<string, kplus.EnvValue> {
  const env: Record<string, kplus.EnvValue> = {
    NODE_ENV: kplus.EnvValue.fromValue("production"),
    PORT: kplus.EnvValue.fromValue(String(APP_PORT)),
    CONTAINER_NAME: kplus.EnvValue.fromValue(container.name),
    CONFIG_PATH: kplus.EnvValue.fromValue(`${CONFIG_MOUNT}/${CONFIG_FILE}`),
  };

  for (const [k, v] of Object.entries(ctx.config.env?.common ?? {})) {
    if (k !== "NODE_ENV") env[k] = kplus.EnvValue.fromValue(v);
  }

  const secretNames = ctx.config.env?.secrets ?? [];
  if (secretNames.length > 0) {
    const secretName = `${ctx.config.name}-secrets`;
    const secretObj = kplus.Secret.fromSecretName(chart, `${container.name}-secrets-ref`, secretName);
    for (const key of secretNames) {
      env[key] = kplus.EnvValue.fromSecretValue({ secret: secretObj, key });
    }
  }

  return env;
}

function parseCpu(value?: string): kplus.Cpu | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.endsWith("m")) {
    const millis = Number(normalized.slice(0, -1));
    return Number.isFinite(millis) ? kplus.Cpu.millis(millis) : undefined;
  }
  const units = Number(normalized);
  return Number.isFinite(units) ? kplus.Cpu.units(units) : undefined;
}

function parseMemory(value?: string): cdk8s.Size | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d+)(Ki|Mi|Gi)$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount)) return undefined;
  if (unit === "ki") return cdk8s.Size.kibibytes(amount);
  if (unit === "mi") return cdk8s.Size.mebibytes(amount);
  if (unit === "gi") return cdk8s.Size.gibibytes(amount);
  return undefined;
}

function toContainerResources(resources: ResolvedContainer["resources"]): kplus.ContainerResources | undefined {
  const requestCpu = parseCpu(resources.requests?.cpu);
  const limitCpu = parseCpu(resources.limits?.cpu);
  const requestMemory = parseMemory(resources.requests?.memory);
  const limitMemory = parseMemory(resources.limits?.memory);

  const hasCpu = requestCpu || limitCpu;
  const hasMemory = requestMemory || limitMemory;
  if (!hasCpu && !hasMemory) return undefined;

  return {
    ...(hasCpu ? { cpu: { request: requestCpu, limit: limitCpu } } : {}),
    ...(hasMemory ? { memory: { request: requestMemory, limit: limitMemory } } : {}),
  };
}

// --- Chart builders ---

class ContainerBuilder {
  constructor(
    private chart: cdk8s.Chart,
    private ctx: GeneratorContext,
    private container: ResolvedContainer,
  ) {}

  private get prefix() { return `${this.ctx.config.name}-${this.container.name}`; }
  private get labels() { return { app: this.ctx.config.name, component: this.container.name }; }

  build() {
    const configMap = this.createConfigMap();
    const pvcTemplate = this.createPvcTemplate();
    const dataVolume = this.createDataVolume();
    const configVolume = kplus.Volume.fromConfigMap(this.chart, `${this.container.name}-config-vol`, configMap);

    const sts = new kplus.StatefulSet(this.chart, `${this.container.name}-sts`, {
      metadata: { name: this.prefix, labels: this.labels },
      replicas: 1,
      serviceName: `${this.prefix}-headless`,
      containers: [{
        name: this.container.name,
        image: imageUri(),
        imagePullPolicy: HELM_PULL_POLICY as any,
        ports: [{ number: APP_PORT }],
        envVariables: buildEnv(this.chart, this.ctx, this.container),
        resources: toContainerResources(this.container.resources),
        securityContext: { ensureNonRoot: false, readOnlyRootFilesystem: false },
        volumeMounts: [
          { path: DATA_MOUNT, volume: dataVolume },
          { path: CONFIG_MOUNT, volume: configVolume, readOnly: true },
        ],
      }],
      securityContext: { ensureNonRoot: false },
      podMetadata: { labels: this.labels },
      volumeClaimTemplates: [pvcTemplate],
    });

    // Headless service for StatefulSet
    new kplus.Service(this.chart, `${this.container.name}-headless`, {
      metadata: { name: `${this.prefix}-headless`, labels: this.labels },
      type: kplus.ServiceType.CLUSTER_IP,
      clusterIP: "None",
      ports: [{ port: APP_PORT, targetPort: APP_PORT }],
      selector: sts,
    });

    // Regular service
    new kplus.Service(this.chart, `${this.container.name}-svc`, {
      metadata: { name: this.prefix, labels: this.labels },
      type: kplus.ServiceType.CLUSTER_IP,
      ports: [{ port: SERVICE_PORT, targetPort: APP_PORT }],
      selector: sts,
    });
  }

  private createConfigMap(): kplus.ConfigMap {
    const { config } = this.ctx;
    const containerConfig = {
      name: config.name,
      landing: this.container.landing ? config.landing : undefined,
      spa: this.container.spa ? config.spa : undefined,
      back: { core: config.back.core, microservices: buildMicroserviceMap(this.container) },
    };

    return new kplus.ConfigMap(this.chart, `${this.container.name}-config`, {
      metadata: { name: `${this.prefix}-config`, labels: this.labels },
      data: { [CONFIG_FILE]: JSON.stringify(containerConfig, null, 2) },
    });
  }

  private createPvcTemplate(): kplus.PersistentVolumeClaim {
    const name = `${this.prefix}-data`;
    return new kplus.PersistentVolumeClaim(this.chart, `${this.container.name}-pvc-tpl`, {
      metadata: { name },
      storage: cdk8s.Size.gibibytes(diskSize(this.ctx.storage)),
      accessModes: [kplus.PersistentVolumeAccessMode.READ_WRITE_ONCE],
      storageClassName: "local-path",
    });
  }

  private createDataVolume(): kplus.Volume {
    const claimName = `${this.prefix}-data`;
    const pvcRef = kplus.PersistentVolumeClaim.fromClaimName(this.chart, `${this.container.name}-pvc-ref`, claimName);
    return kplus.Volume.fromPersistentVolumeClaim(this.chart, `${this.container.name}-data-vol`, pvcRef, { name: claimName });
  }
}

class IngressBuilder {
  private routes: { match: string; priority: number; service: string }[] = [];

  constructor(private chart: cdk8s.Chart, private ctx: GeneratorContext) {}

  build() {
    this.collectRoutes();
    this.routes.sort((a, b) => b.priority - a.priority);
    this.createIngressRoute();
  }

  private collectRoutes() {
    const { config, containers } = this.ctx;

    for (const c of containers) {
      const svc = `${config.name}-${c.name}`;

      for (const ms of c.microservices) {
        this.routes.push({
          match: `Host(\`${HELM_HOST}\`) && PathPrefix(\`/services/${ms.name}\`)`,
          priority: 100,
          service: svc,
        });
      }

      if (c.spa) {
        this.routes.push({ match: `Host(\`${HELM_HOST}\`) && PathPrefix(\`/console\`)`, priority: 10, service: svc });
      }

      if (c.landing) {
        this.routes.push({ match: `Host(\`${HELM_HOST}\`) && PathPrefix(\`/\`)`, priority: 1, service: svc });
      }
    }
  }

  private createIngressRoute() {
    const { config } = this.ctx;

    new cdk8s.ApiObject(this.chart, "ingress-route", {
      apiVersion: TRAEFIK_API,
      kind: "IngressRoute",
      metadata: { name: `${config.name}-ingress` },
      spec: {
        entryPoints: ["web"],
        routes: this.routes.map((r) => ({
          match: r.match,
          kind: "Rule",
          priority: r.priority,
          services: [{ name: r.service, port: SERVICE_PORT }],
        })),
        ...(config.ingress.tls?.enabled && { tls: { secretName: `${config.name}-tls` } }),
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
        dnsNames: [HELM_HOST],
      },
    });
  }
}

class K3sHelmChartBuilder {
  constructor(private chart: cdk8s.Chart, private ctx: GeneratorContext, private chartBase64: string) {}

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

// --- Entry point ---

export function generateKubernetesManifests(ctx: GeneratorContext, chartBase64?: string) {
  const helmDir = `${ctx.outputDir}/helm`;

  // Helm chart templates
  const app = new cdk8s.App({ outdir: `${helmDir}/templates` });
  const chart = new cdk8s.Chart(app, ctx.config.name);

  for (const container of ctx.containers) {
    new ContainerBuilder(chart, ctx, container).build();
  }

  new IngressBuilder(chart, ctx).build();
  new CertificateBuilder(chart, ctx).build();

  app.synth();

  // K3s HelmChart CRD
  if (chartBase64) {
    const k3sApp = new cdk8s.App({ outdir: ctx.outputDir });
    const k3sChart = new cdk8s.Chart(k3sApp, "k3s-chart");
    new K3sHelmChartBuilder(k3sChart, ctx, chartBase64).build();
    k3sApp.synth();
  }
}
