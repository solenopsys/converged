/**
 * The declarative escape hatch: ConfigMaps, Secrets, claims and volumes that a
 * Platform or Solution names directly in its spec.
 *
 * Everything the core needs is built by `platform.ts`. This is for the rest —
 * a solution that wants its own bucket of settings, a claim for a workload the
 * base core knows nothing about — so that adding one is an edit to a custom
 * resource rather than a change to this codebase.
 */

import * as k8s from "./k8s/index.ts";
import * as n from "./names.ts";
import type { ExtraResources, KubeObject } from "./types.ts";

export function buildExtras(
	extras: ExtraResources,
	platform: string,
	namespace: string,
	owner: string,
	component: string,
): KubeObject[] {
	const resources: KubeObject[] = [];
	const labels = (kind: string) =>
		n.labels(platform, `${component}-${kind}`, owner);

	for (const [name, data] of Object.entries(extras.configMaps ?? {})) {
		resources.push(k8s.configMap(name, namespace, labels("config"), data));
	}

	for (const [name, data] of Object.entries(extras.secrets ?? {})) {
		resources.push(k8s.secret(name, namespace, labels("secret"), data));
	}

	for (const [name, claim] of Object.entries(extras.claims ?? {})) {
		resources.push(
			k8s.persistentVolumeClaim(
				name,
				namespace,
				labels("claim"),
				{
					size: claim.size,
					storageClassName: claim.storageClassName,
					accessModes: claim.accessModes,
					volumeName: claim.volumeName,
				},
				claim.reclaim ?? "retain",
			),
		);
	}

	for (const [name, volume] of Object.entries(extras.volumes ?? {})) {
		resources.push(
			k8s.persistentVolume(
				name,
				labels("volume"),
				{
					capacity: volume.capacity,
					storageClassName: volume.storageClassName,
					accessModes: volume.accessModes,
					reclaimPolicy: volume.reclaimPolicy,
					source: volume.source,
					nodeAffinity: volume.nodeAffinity,
				},
				volume.reclaim ?? "retain",
			),
		);
	}

	return resources;
}
