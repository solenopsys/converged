/**
 * Behemoth storage topology.
 *
 * One behemoth process serves many microservices, but their persistence is
 * isolated: every microservice receives one PV/PVC and all of its stores live
 * below that single mounted root. The ConfigMap is the exact mount table that
 * behemoth validates at startup.
 */

import type { VolumeMount } from "./k8s/container.ts";
import * as k8s from "./k8s/index.ts";
import * as n from "./names.ts";
import type { KubeObject, PlatformSpec, Resources } from "./types.ts";
import { PolicyError, require } from "./types.ts";

const CONFIG_VOLUME = "storage-config";
const CONFIG_KEY = "storage.json";
const CONFIG_PATH = `/etc/behemoth/${CONFIG_KEY}`;
/** The UID the published behemoth image runs as. */
const DEFAULT_STORAGE_UID = 1000;

/**
 * The fujin peer name a behemoth registers under. Exported because the scope
 * index has to address exactly this name: a copy that drifts sends every
 * storage op to a peer that never registered, and the failure surfaces as a
 * send error in the caller rather than as anything wrong here.
 */
export function behemothTarget(scope?: string): string {
	return scope ? `behemoth-${scope}` : "behemoth";
}

interface StorageResourcesSpec {
	platform: string;
	tenant?: string;
	/** Shard name on a `multi` platform; absent for mono and cloud. */
	shard?: string;
	owner: string;
	namespace: string;
	name: string;
	microservices: string[];
	storage: PlatformSpec["storage"];
	fujinEndpoint: string;
	scope?: string;
	nodeAffinity?: Record<string, unknown>;
	resources?: Resources;
}

function renderTemplate(
	value: unknown,
	variables: Record<string, string>,
): unknown {
	if (typeof value === "string") {
		return Object.entries(variables).reduce(
			(rendered, [name, replacement]) =>
				rendered.replaceAll(`{{${name}}}`, replacement),
			value,
		);
	}
	if (Array.isArray(value))
		return value.map((item) => renderTemplate(item, variables));
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, item]) => [
				key,
				renderTemplate(item, variables),
			]),
		);
	}
	return value;
}

export function storageResources(spec: StorageResourcesSpec): KubeObject[] {
	const sourceTemplate = require(spec.storage
		.volumeSource, "spec.storage.volumeSource");
	const microservices = [...new Set(spec.microservices)].sort();
	// The component label distinguishes one behemoth from another; it is part
	// of the immutable Deployment selector, so it has to be derived from the
	// shard or tenant rather than shared.
	const suffix = spec.tenant ?? spec.shard;
	const component = suffix ? `storage-${suffix}` : "storage";
	const labels = n.labels(spec.platform, component, spec.owner);
	const selector = n.selector(spec.platform, component);
	const mountBase = spec.storage.mountBase.replace(/\/+$/g, "");
	const mounts: Record<string, string> = {};
	const podVolumes: Record<string, unknown>[] = [
		k8s.configMapVolume(CONFIG_VOLUME, n.storageConfigMap(spec.name)),
	];
	const volumeMounts: VolumeMount[] = [
		{
			name: CONFIG_VOLUME,
			mountPath: CONFIG_PATH,
			subPath: CONFIG_KEY,
			readOnly: true,
		},
	];
	const resources: KubeObject[] = [];
	const renderedSources = new Set<string>();

	for (const microservice of microservices) {
		const volume = n.storageVolume(spec.name, microservice);
		const mountPath = `${mountBase}/${volume}`;
		const source = renderTemplate(sourceTemplate, {
			volume,
			platform: spec.platform,
			tenant: spec.tenant ?? "",
			shard: spec.shard ?? "",
			microservice,
		}) as Record<string, unknown>;
		const sourceIdentity = JSON.stringify(source);
		if (renderedSources.has(sourceIdentity)) {
			throw new PolicyError(
				"spec.storage.volumeSource must resolve to a distinct source for every microservice",
			);
		}
		renderedSources.add(sourceIdentity);

		mounts[n.storeId(microservice)] = mountPath;
		podVolumes.push(k8s.claimVolume(volume, volume));
		volumeMounts.push({ name: volume, mountPath });

		resources.push(
			k8s.persistentVolume(
				volume,
				labels,
				{
					capacity: spec.storage.size,
					storageClassName: spec.storage.storageClassName,
					accessModes: spec.storage.accessModes,
					reclaimPolicy: spec.storage.reclaimPolicy,
					source,
					nodeAffinity: spec.nodeAffinity ?? spec.storage.nodeAffinity,
				},
				"retain",
			),
			k8s.persistentVolumeClaim(
				volume,
				spec.namespace,
				labels,
				{
					size: spec.storage.size,
					storageClassName: spec.storage.storageClassName,
					accessModes: spec.storage.accessModes,
					volumeName: volume,
				},
				"retain",
			),
		);
	}

	// Every mount arrives owned by root: the kubelet creates a `hostPath`
	// directory as root:root 0755, and `fsGroup` — which would fix this for a
	// CSI volume — is never applied to hostPath. Behemoth runs unprivileged, so
	// without this hand-over its first write to any store fails with EACCES and
	// the caller sees `AccessDenied` from a storage that reported every mount
	// as mounted. Runs as root and only touches the data mounts.
	const storageUid = spec.storage.runAsUser ?? DEFAULT_STORAGE_UID;
	const dataMounts = volumeMounts.filter((mount) => mount.name !== CONFIG_VOLUME);
	const chownInit = {
		name: "storage-own",
		image: spec.storage.image,
		command: ["/bin/sh", "-c"],
		args: [
			dataMounts
				.map((mount) => `chown ${storageUid}:${storageUid} '${mount.mountPath}'`)
				.join(" && ") || "true",
		],
		securityContext: { runAsUser: 0, runAsGroup: 0 },
		volumeMounts: dataMounts,
	};

	const config = JSON.stringify({ microservices: mounts }, null, 2);
	resources.push(
		k8s.configMap(n.storageConfigMap(spec.name), spec.namespace, labels, {
			[CONFIG_KEY]: config,
		}),
		k8s.deployment({
			name: spec.name,
			namespace: spec.namespace,
			labels,
			selector,
			replicas: 1,
			annotations: { [n.ANNOTATION_STORAGE_CONFIG]: n.digest(config) },
			volumes: podVolumes,
			initContainers: [chownInit],
			containers: [
				{
					name: "storage",
					image: spec.storage.image,
					env: {
						FUJIN_TARGET: behemothTarget(spec.scope),
					},
					// The behemoth image names its binary in CMD and declares no
					// ENTRYPOINT, so args alone replace the whole command and the
					// runtime is left trying to exec "start".
					command: ["/app/storage"],
					args: [
						"start",
						"--config",
						CONFIG_PATH,
						"--fujin",
						spec.fujinEndpoint,
						// Behemoth runs valkey in-process and binds it to
						// loopback by default, which serves only itself. The
						// cache is meant to be shared with ui and ms, so it has
						// to listen on the pod's address.
						"--valkey",
						`0.0.0.0:${spec.storage.cachePort}`,
						...(spec.scope ? ["--scope", spec.scope] : []),
					],
					ports: [
						{ name: "storage", port: spec.storage.port },
						{ name: "cache", port: spec.storage.cachePort },
					],
					resources: spec.resources ?? spec.storage.resources,
					volumeMounts,
				},
			],
		}),
		k8s.service(spec.name, spec.namespace, labels, selector, [
			{ name: "storage", port: spec.storage.port },
			{ name: "cache", port: spec.storage.cachePort },
		]),
	);

	return resources;
}
