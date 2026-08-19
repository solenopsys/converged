/**
 * A tenant is one site on a cloud-profile platform: its own storage shard, its
 * own hostnames, and a scope that the edge stamps onto every request.
 *
 * This is a port of the Go operator's Tenant reconciler. The behavioural
 * difference is ownership: the Go version created objects imperatively and
 * left orphans behind on a rename, while everything returned here is the full
 * desired set and anything absent is pruned.
 */

import * as k8s from "./k8s/index.ts";
import * as n from "./names.ts";
import { mergeSolutions, selectSolutions } from "./solution.ts";
import type {
	KubeObject,
	PlatformSpec,
	ReconcileInput,
	ReconcileOutput,
	TenantSpec,
} from "./types.ts";
import { PolicyError, require } from "./types.ts";

export function reconcileTenant(input: ReconcileInput): ReconcileOutput {
	const tenant = input.object.metadata.name;
	const spec = (input.object.spec ?? {}) as TenantSpec;
	const owner = n.ownerLabel("Tenant", tenant);

	const platformObject = input.platform;
	if (!platformObject) {
		// Not an error worth failing on: the platform may simply not be
		// created yet. Report it and come back.
		return {
			resources: [],
			status: { ready: false, reason: `platform ${spec.platform} not found` },
			requeueAfter: 15_000,
			prune: false,
		};
	}

	const platform = platformObject.metadata.name;
	const platformSpec = platformObject.spec as PlatformSpec;
	if (platformSpec.profile !== "cloud") {
		throw new PolicyError(
			`tenant ${tenant} targets platform ${platform} with profile ${platformSpec.profile}; tenants require cloud`,
		);
	}

	const namespace = platformSpec.namespace;
	const scope = n.tenantScope(tenant);
	const storageName = n.tenantStorage(platform, tenant);
	const domains = n.tenantDomains(tenant, platformSpec.domainBase, spec.domains ?? []);
	const size = spec.storageSize ?? platformSpec.storage.size;
	const fujinZmq = require(
		platformSpec.apps.fujin?.ports?.zmq,
		"platform spec.apps.fujin.ports.zmq",
	);

	const storageLabels = n.labels(platform, `storage-${tenant}`, owner);
	const storageSelector = n.selector(platform, `storage-${tenant}`);

	const resources: KubeObject[] = [
		k8s.statefulSet({
			name: storageName,
			namespace,
			labels: storageLabels,
			selector: storageSelector,
			replicas: 1,
			serviceName: storageName,
			volumeClaims: [
				{
					name: "data",
					spec: {
						size,
						storageClassName: platformSpec.storage.storageClassName,
						accessModes: platformSpec.storage.accessModes,
					},
				},
			],
			containers: [
				{
					name: "storage",
					image: platformSpec.storage.image,
					args: [
						"start",
						"--data-dir",
						platformSpec.storage.mountBase,
						"--fujin",
						`tcp://${n.app(platform, "fujin")}:${fujinZmq}`,
						"--scope",
						scope,
					],
					ports: [{ name: "storage", port: platformSpec.storage.port }],
					resources: platformSpec.storage.resources,
					volumeMounts: [{ name: "data", mountPath: platformSpec.storage.mountBase }],
				},
			],
		}),
		k8s.service(storageName, namespace, storageLabels, storageSelector, [
			{ name: "storage", port: platformSpec.storage.port },
		]),
	];

	// One route per tenant, carrying every hostname it answers on. The scope
	// headers are set by a filter on each rule rather than by a separate
	// middleware object: `set` overwrites whatever the client sent, so the
	// scope stays a deployment fact the application never has to defend.
	const scopeHeaders = { "x-storage-scope": scope, workspace: scope };
	resources.push(
		k8s.httpRoute(
			n.tenantRoute(platform, tenant),
			namespace,
			n.labels(platform, `route-${tenant}`, owner),
			n.gateway(platform),
			domains,
			[
				{
					pathPrefix: "/ws",
					service: n.app(platform, "fujin"),
					port: 80,
					setHeaders: scopeHeaders,
				},
				{
					pathPrefix: "/",
					service: n.ui(platform),
					port: 80,
					setHeaders: scopeHeaders,
				},
			],
		),
	);

	const merged = mergeSolutions(
		selectSolutions(input.solutions, platform, spec.solutions),
	);

	return {
		resources,
		status: {
			ready: true,
			scope,
			storageHost: `${storageName}.${namespace}.svc.cluster.local`,
			storagePort: platformSpec.storage.port,
			domains,
			solutions: merged.names,
			observedGeneration: input.object.metadata.generation ?? 0,
		},
		requeueAfter: 0,
	};
}

/**
 * Cloud platforms publish one scope -> storage host index that the stateless
 * ms and ui pods read. It is owned by the Platform, not by any single tenant,
 * so it lives here but is emitted from the platform reconcile pass.
 */
export function domainIndex(
	platform: KubeObject,
	tenants: KubeObject[],
): KubeObject {
	const name = platform.metadata.name;
	const spec = platform.spec as PlatformSpec;
	const index: Record<string, string> = {};
	for (const tenant of tenants) {
		const tenantSpec = (tenant.spec ?? {}) as TenantSpec;
		if (tenantSpec.platform !== name) continue;
		const scope = n.tenantScope(tenant.metadata.name);
		index[scope] =
			`${n.tenantStorage(name, tenant.metadata.name)}.${spec.namespace}.svc.cluster.local:${spec.storage.port}`;
	}
	return k8s.configMap(
		n.domainsConfigMap(name),
		spec.namespace,
		n.labels(name, "domains", n.ownerLabel("Platform", name)),
		{ STORAGE_TENANT_SERVICES: JSON.stringify(index) },
	);
}
