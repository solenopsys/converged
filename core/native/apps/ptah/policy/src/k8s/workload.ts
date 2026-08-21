/**
 * Deployments and StatefulSets — the two workload kinds ptah owns.
 *
 * They share a pod template; the only real difference is that a StatefulSet
 * brings its own storage.
 */

import type { KubeObject } from "../types.ts";
import { type ContainerSpec, container } from "./container.ts";
import { type ClaimSpec, claimSpec } from "./volume.ts";

export interface WorkloadSpec {
	name: string;
	namespace: string;
	labels: Record<string, string>;
	selector: Record<string, string>;
	replicas: number;
	containers: ContainerSpec[];
	initContainers?: ContainerSpec[];
	volumes?: Record<string, unknown>[];
	/** Stamped on the pod template, so a change here rolls the workload. */
	annotations?: Record<string, string>;
	hostNetwork?: boolean;
	serviceAccount?: string;
}

function podTemplate(spec: WorkloadSpec): Record<string, unknown> {
	return {
		metadata: {
			labels: spec.labels,
			...(spec.annotations ? { annotations: spec.annotations } : {}),
		},
		spec: {
			...(spec.hostNetwork
				? { hostNetwork: true, dnsPolicy: "ClusterFirstWithHostNet" }
				: {}),
			...(spec.serviceAccount
				? { serviceAccountName: spec.serviceAccount }
				: {}),
			...(spec.initContainers
				? { initContainers: spec.initContainers.map(container) }
				: {}),
			containers: spec.containers.map(container),
			...(spec.volumes ? { volumes: spec.volumes } : {}),
		},
	};
}

export function deployment(spec: WorkloadSpec): KubeObject {
	return {
		apiVersion: "apps/v1",
		kind: "Deployment",
		metadata: {
			name: spec.name,
			namespace: spec.namespace,
			labels: spec.labels,
		},
		spec: {
			replicas: spec.replicas,
			selector: { matchLabels: spec.selector },
			template: podTemplate(spec),
		},
	};
}

export interface StatefulSetSpec extends WorkloadSpec {
	serviceName: string;
	/**
	 * Claim templates. These are immutable once the StatefulSet exists:
	 * growing a volume means patching the generated claims, which is a
	 * deliberate operation and not something a resync should attempt.
	 */
	volumeClaims: { name: string; spec: ClaimSpec }[];
}

export function statefulSet(spec: StatefulSetSpec): KubeObject {
	return {
		apiVersion: "apps/v1",
		kind: "StatefulSet",
		metadata: {
			name: spec.name,
			namespace: spec.namespace,
			labels: spec.labels,
		},
		spec: {
			serviceName: spec.serviceName,
			replicas: spec.replicas,
			selector: { matchLabels: spec.selector },
			template: podTemplate(spec),
			volumeClaimTemplates: spec.volumeClaims.map((claim) => ({
				metadata: { name: claim.name },
				spec: claimSpec(claim.spec),
			})),
		},
	};
}
