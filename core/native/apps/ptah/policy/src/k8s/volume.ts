/**
 * Storage: claims, statically provisioned volumes, and the pod-level volume
 * sources that reference them.
 *
 * Deleting storage is the one action here that cannot be undone by a later
 * reconcile, so it is opt-in per object: see `ANNOTATION_RECLAIM`.
 */

import { ANNOTATION_RECLAIM } from "../names.ts";
import type { KubeObject } from "../types.ts";

export type Reclaim = "retain" | "delete";

export interface ClaimSpec {
	size: string;
	/**
	 * Required. The cluster default class is a property of whichever cluster
	 * the manifest lands in, so leaving it unset makes the same policy mean
	 * different storage in different places.
	 */
	storageClassName: string;
	accessModes?: string[];
	/** Bind to one specific PersistentVolume instead of provisioning. */
	volumeName?: string;
}

/** Shared by standalone claims and StatefulSet claim templates. */
export function claimSpec(spec: ClaimSpec): Record<string, unknown> {
	return {
		accessModes: spec.accessModes ?? ["ReadWriteOnce"],
		storageClassName: spec.storageClassName,
		resources: { requests: { storage: spec.size } },
		...(spec.volumeName ? { volumeName: spec.volumeName } : {}),
	};
}

/**
 * A standalone claim, for volumes whose lifetime is not tied to one
 * StatefulSet — a Deployment that needs durable state, or a claim shared by
 * several workloads.
 */
export function persistentVolumeClaim(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	spec: ClaimSpec,
	reclaim: Reclaim = "retain",
): KubeObject {
	return {
		apiVersion: "v1",
		kind: "PersistentVolumeClaim",
		metadata: {
			name,
			namespace,
			labels,
			annotations: { [ANNOTATION_RECLAIM]: reclaim },
		},
		spec: claimSpec(spec),
	};
}

export interface VolumeSpec {
	capacity: string;
	accessModes?: string[];
	storageClassName: string;
	/** Retain keeps the data after the bound claim is deleted. */
	reclaimPolicy?: "Retain" | "Delete" | "Recycle";
	/**
	 * The volume source, verbatim: `{ hostPath: {...} }`, `{ local: {...} }`,
	 * `{ nfs: {...} }`, `{ csi: {...} }`. Kept opaque because the set of
	 * sources is the cluster's business, not the policy's.
	 */
	source: Record<string, unknown>;
	nodeAffinity?: Record<string, unknown>;
}

/**
 * A statically provisioned volume. Most clusters never need this — a
 * provisioner creates volumes on demand — but pre-existing disks and pinned
 * local storage have to be declared. Cluster-scoped: no namespace.
 */
export function persistentVolume(
	name: string,
	labels: Record<string, string>,
	spec: VolumeSpec,
	reclaim: Reclaim = "retain",
): KubeObject {
	return {
		apiVersion: "v1",
		kind: "PersistentVolume",
		metadata: { name, labels, annotations: { [ANNOTATION_RECLAIM]: reclaim } },
		spec: {
			capacity: { storage: spec.capacity },
			accessModes: spec.accessModes ?? ["ReadWriteOnce"],
			storageClassName: spec.storageClassName,
			persistentVolumeReclaimPolicy: spec.reclaimPolicy ?? "Retain",
			...(spec.nodeAffinity ? { nodeAffinity: spec.nodeAffinity } : {}),
			...spec.source,
		},
	};
}

/** Pod volume backed by an existing claim. */
export function claimVolume(
	name: string,
	claimName: string,
): Record<string, unknown> {
	return { name, persistentVolumeClaim: { claimName } };
}

/**
 * Node-local scratch space, gone when the pod is. Right for anything that can
 * be rebuilt from its source — a module cache re-fetched from the registry —
 * and wrong for anything that cannot.
 */
export function emptyDirVolume(
	name: string,
	sizeLimit?: string,
): Record<string, unknown> {
	return { name, emptyDir: sizeLimit ? { sizeLimit } : {} };
}

export function configMapVolume(
	name: string,
	configMapName: string,
): Record<string, unknown> {
	return { name, configMap: { name: configMapName } };
}

export function secretVolume(
	name: string,
	secretName: string,
): Record<string, unknown> {
	return { name, secret: { secretName } };
}
