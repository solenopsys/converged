import * as k8s from "@kubernetes/client-node";
import type { SecretsService } from "./types";

function readNamespace(): string {
  try {
    return require("fs").readFileSync(
      "/var/run/secrets/kubernetes.io/serviceaccount/namespace",
      "utf8",
    ).trim();
  } catch {
    return process.env.K8S_NAMESPACE ?? "default";
  }
}

export class SecretsServiceImpl implements SecretsService {
  private client: k8s.CoreV1Api;
  private namespace: string;

  constructor() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.client = kc.makeApiClient(k8s.CoreV1Api);
    this.namespace = readNamespace();
  }

  async listSecrets(): Promise<string[]> {
    const res = await this.client.listNamespacedSecret({ namespace: this.namespace });
    return (res.items ?? [])
      .map((s) => s.metadata?.name ?? "")
      .filter(Boolean);
  }

  async getSecret(name: string): Promise<Record<string, string>> {
    const res = await this.client.readNamespacedSecret({ name, namespace: this.namespace });
    const raw = res.data ?? {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      result[k] = Buffer.from(v, "base64").toString("utf8");
    }
    return result;
  }

  async setSecret(name: string, data: Record<string, string>): Promise<void> {
    const encoded: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      encoded[k] = Buffer.from(v).toString("base64");
    }

    try {
      await this.client.readNamespacedSecret({ name, namespace: this.namespace });
      await this.client.patchNamespacedSecret({
        name,
        namespace: this.namespace,
        body: { data: encoded },
      });
    } catch {
      await this.client.createNamespacedSecret({
        namespace: this.namespace,
        body: {
          metadata: { name },
          data: encoded,
        },
      });
    }
  }

  async deleteSecret(name: string): Promise<void> {
    await this.client.deleteNamespacedSecret({ name, namespace: this.namespace });
  }
}

export default SecretsServiceImpl;
