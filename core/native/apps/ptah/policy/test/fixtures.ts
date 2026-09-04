import type { KubeObject, Profile, ShardSpec } from "../src/types.ts";

export function platform(
	profile: Profile,
	extra: Record<string, unknown> = {},
): KubeObject {
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Platform",
		metadata: { name: "converged", generation: 3 },
		spec: {
			profile,
			namespace: "converged",
			domainBase: "4ir.club",
			secretName: "converged-secrets",
			images: { ui: "reg/ui:1", ms: "reg/ms:1" },
			storage: {
				image: "reg/behemoth:1",
				size: "5Gi",
				port: 9000,
				cachePort: 6379,
				mountBase: "/app/data",
				// The dynamic form, which is the chart default: a claim per
				// microservice for the provisioner behind this class to fill.
				// `staticStorage` is the other form.
				storageClassName: "local-path",
			},
			apps: {
				fujin: { image: "reg/fujin:1", ports: { ws: 8087, zmq: 5557 } },
				centimanus: {
					image: "reg/centimanus:1",
					fujinTarget: "centimanus",
					fujinEndpointEnv: "CENTIMANUS_FUJIN_ZMQ_ENDPOINT",
					ports: { http: 9000 },
				},
			},
			gateway: {
				className: "traefik",
				hosts: ["*.4ir.club"],
				tls: {
					secretName: "4ir-club-tls",
					issuer: "4ir-club-cluster-issuer",
					dnsNames: ["4ir.club", "*.4ir.club"],
				},
			},
			...extra,
		},
	};
}

/** Pins a node-local volume; any static storage has to carry one. */
export const nodeAffinity = {
	required: {
		nodeSelectorTerms: [
			{
				matchExpressions: [
					{
						key: "kubernetes.io/hostname",
						operator: "In",
						values: ["node-1"],
					},
				],
			},
		],
	},
};

/**
 * The static storage form: ptah declares the volumes as well as the claims, so
 * the class carries no provisioner of its own and the node affinity is what
 * keeps the data and the pod on the same machine.
 */
export function staticStorage(
	extra: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		image: "reg/behemoth:1",
		size: "5Gi",
		port: 9000,
		cachePort: 6379,
		mountBase: "/app/data",
		storageClassName: "converged-local",
		volumeSource: {
			hostPath: {
				path: "/var/lib/ptah/{{volume}}",
				type: "DirectoryOrCreate",
			},
		},
		nodeAffinity,
		...extra,
	};
}

/** A `multi` platform with a named shard alongside the catch-all. */
export function sharded(shards?: ShardSpec[]): KubeObject {
	return platform("multi", {
		shards: shards ?? [
			{ name: "alpha", scopes: ["acme", "globex"] },
			{ name: "rest", scopes: ["*"] },
		],
	});
}

export const registry = {
	url: "https://registry.example.com/converged",
	solutions: "solutions/converged.json",
	revision: "2026-08-21",
	modules: {
		"rp-assistant.js":
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	},
	workflows: {
		"workflows/wf-files-process.js":
			"c7d99a8c1e48a1c9c0dc616c08e9391f204d260f6b7f29c7c1623b78f5de8a6b",
	},
};

export function solution(
	name: string,
	extra: Record<string, unknown> = {},
): KubeObject {
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Solution",
		metadata: { name },
		spec: {
			platform: "converged",
			repositories: ["geo", "places"],
			lambdas: ["ses"],
			surfaces: ["geo"],
			workflows: [
				{ name: "wf-leads", script: "workflows/wf-leads.js", periodMs: 600000 },
			],
			...extra,
		},
	};
}

export function tenant(
	name: string,
	extra: Record<string, unknown> = {},
): KubeObject {
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Tenant",
		metadata: { name },
		spec: { platform: "converged", ...extra },
	};
}

export function find(resources: KubeObject[], kind: string, name: string) {
	return resources.find((r) => r.kind === kind && r.metadata.name === name);
}

/**
 * `find` plus the assertion that it hit. An object missing from the desired
 * set is a test failure worth naming, not an optional value to thread through
 * every assertion that follows.
 */
export function specOf<T>(
	resources: KubeObject[],
	kind: string,
	name: string,
): T {
	const object = find(resources, kind, name);
	if (!object) throw new Error(`no ${kind}/${name} in the desired set`);
	return object.spec as T;
}
