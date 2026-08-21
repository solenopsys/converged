/**
 * The `multi` profile: behemoth split by scope.
 *
 * Mono runs one storage pod and cloud runs one per tenant. Multi sits between
 * them — a fixed set of shards, each owning a set of scopes, declared on the
 * Platform instead of appearing and disappearing with Tenant objects.
 *
 * The split is only about which pod holds a scope's data. Inside a shard the
 * granularity is unchanged: one PersistentVolume per microservice, as in every
 * other profile.
 */

import * as k8s from "./k8s/index.ts";
import * as n from "./names.ts";
import { storageResources } from "./storage.ts";
import type { KubeObject, PlatformSpec, ShardSpec } from "./types.ts";
import { PolicyError } from "./types.ts";

export const CATCH_ALL = "*";

export interface ResolvedShard extends ShardSpec {
	/** Name of the shard's Deployment, Service and volume prefix. */
	resourceName: string;
	catchAll: boolean;
}

/**
 * Validate the shard set before anything is emitted from it.
 *
 * These are rejections rather than repairs on purpose: a duplicate name or a
 * missing catch-all silently routes a scope to the wrong disk, and a wrong
 * disk is indistinguishable from an empty one until someone looks for the
 * data.
 */
export function resolveShards(
	platform: string,
	spec: PlatformSpec,
): ResolvedShard[] {
	const shards = spec.shards ?? [];
	if (shards.length === 0) {
		throw new PolicyError(
			"profile multi requires at least one entry in spec.shards",
		);
	}

	const names = new Set<string>();
	const scopes = new Map<string, string>();
	const resolved: ResolvedShard[] = [];

	for (const shard of shards) {
		const name = (shard.name ?? "").trim();
		if (name.length === 0)
			throw new PolicyError("every shard requires spec.shards[].name");
		if (names.has(name)) throw new PolicyError(`duplicate shard name: ${name}`);
		names.add(name);

		if (!shard.scopes || shard.scopes.length === 0) {
			throw new PolicyError(`shard ${name} claims no scopes`);
		}
		for (const scope of shard.scopes) {
			const owner = scopes.get(scope);
			if (owner) {
				throw new PolicyError(
					`scope ${scope} is claimed by both ${owner} and ${name}`,
				);
			}
			scopes.set(scope, name);
		}

		resolved.push({
			...shard,
			name,
			resourceName: n.shardStorage(platform, name),
			catchAll: shard.scopes.includes(CATCH_ALL),
		});
	}

	const catchAlls = resolved
		.filter((shard) => shard.catchAll)
		.map((shard) => shard.name);
	if (catchAlls.length !== 1) {
		throw new PolicyError(
			`profile multi needs exactly one catch-all shard (scopes: ["*"]); found ${
				catchAlls.length === 0 ? "none" : catchAlls.join(", ")
			}`,
		);
	}

	return resolved.sort((a, b) => a.name.localeCompare(b.name));
}

export function shardResources(
	platform: string,
	spec: PlatformSpec,
	owner: string,
	shards: ResolvedShard[],
	microservices: string[],
	fujinEndpoint: string,
): KubeObject[] {
	return shards.flatMap((shard) =>
		storageResources({
			platform,
			shard: shard.name,
			owner,
			namespace: spec.namespace,
			name: shard.resourceName,
			microservices,
			storage: { ...spec.storage, size: shard.size ?? spec.storage.size },
			nodeAffinity: shard.nodeAffinity,
			resources: shard.resources,
			fujinEndpoint,
		}),
	);
}

/**
 * The scope index every stateless pod reads to find its storage.
 *
 * Same ConfigMap and same key as the cloud profile's tenant index: ui and ms
 * resolve a scope to a host and do not care whether that host is a tenant's
 * pod or a shard. The catch-all is published under `*`, which is what a scope
 * with no explicit shard falls back to.
 */
export function shardIndex(
	platform: string,
	spec: PlatformSpec,
	owner: string,
	shards: ResolvedShard[],
): KubeObject {
	const index: Record<string, string> = {};
	for (const shard of shards) {
		const host = `${shard.resourceName}.${spec.namespace}.svc.cluster.local:${spec.storage.port}`;
		for (const scope of shard.scopes) index[scope] = host;
	}
	return k8s.configMap(
		n.domainsConfigMap(platform),
		spec.namespace,
		n.labels(platform, "domains", owner),
		{ STORAGE_TENANT_SERVICES: JSON.stringify(index) },
	);
}
