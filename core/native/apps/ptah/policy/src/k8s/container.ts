/**
 * Pod-level building blocks shared by every workload kind.
 *
 * Only fields we intend to own are emitted. Omitting one leaves it to the
 * apiserver or another manager; writing a default we did not decide would
 * make ptah fight defaulting webhooks on every resync.
 */

import type { Resources } from "../types.ts";

export interface Port {
	name: string;
	port: number;
	targetPort?: number;
}

export interface VolumeMount {
	name: string;
	mountPath: string;
	subPath?: string;
	readOnly?: boolean;
}

export interface ContainerSpec {
	name: string;
	image: string;
	command?: string[];
	args?: string[];
	env?: Record<string, string>;
	/** Secrets and ConfigMaps projected wholesale into the environment. */
	envFromSecret?: string;
	envFromConfigMap?: string;
	ports?: Port[];
	resources?: Resources;
	volumeMounts?: VolumeMount[];
	probePort?: number;
	probePath?: string;
}

function envList(env: Record<string, string> | undefined) {
	if (!env) return undefined;
	return Object.entries(env).map(([name, value]) => ({ name, value }));
}

function probes(spec: ContainerSpec): Record<string, unknown> {
	if (spec.probePort === undefined) return {};
	const httpGet = { path: spec.probePath ?? "/health", port: spec.probePort };
	return {
		readinessProbe: { httpGet, initialDelaySeconds: 3, periodSeconds: 5, failureThreshold: 6 },
		livenessProbe: { httpGet, initialDelaySeconds: 20, periodSeconds: 20, failureThreshold: 6 },
	};
}

export function container(spec: ContainerSpec): Record<string, unknown> {
	const envFrom: Record<string, unknown>[] = [];
	if (spec.envFromConfigMap) envFrom.push({ configMapRef: { name: spec.envFromConfigMap } });
	if (spec.envFromSecret) envFrom.push({ secretRef: { name: spec.envFromSecret } });

	return {
		name: spec.name,
		image: spec.image,
		...(spec.command ? { command: spec.command } : {}),
		...(spec.args ? { args: spec.args } : {}),
		...(spec.ports
			? {
					ports: spec.ports.map((p) => ({
						name: p.name,
						containerPort: p.targetPort ?? p.port,
					})),
				}
			: {}),
		...(envList(spec.env) ? { env: envList(spec.env) } : {}),
		...(envFrom.length > 0 ? { envFrom } : {}),
		...(spec.resources ? { resources: spec.resources } : {}),
		...(spec.volumeMounts ? { volumeMounts: spec.volumeMounts } : {}),
		...probes(spec),
	};
}
