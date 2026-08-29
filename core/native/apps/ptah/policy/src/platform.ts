/**
 * Base core: everything that exists before any solution is layered on.
 *
 * The profiles differ by exactly one decision — how storage is divided.
 * `mono` runs one behemoth in-namespace, `multi` runs one per shard, and
 * `cloud` provisions none here at all because storage belongs to the Tenant
 * reconciler, one shard per tenant. Everything else on this page is identical
 * across the three.
 */

import {
	accessMaterial,
	accessSecretData,
	accessSecretName,
} from "./access.ts";
import { buildExtras } from "./extras.ts";
import * as k8s from "./k8s/index.ts";
import * as n from "./names.ts";
import {
	CATCH_ALL,
	resolveShards,
	shardIndex,
	shardResources,
} from "./shards.ts";
import {
	assertNoRegistryEnv,
	mergeSolutions,
	moduleData,
	registryData,
	selectSolutions,
} from "./solution.ts";
import { storageResources } from "./storage.ts";
import { domainIndexData } from "./tenant.ts";
import type {
	KubeObject,
	NativeApp,
	PlatformSpec,
	ReconcileInput,
	ReconcileOutput,
} from "./types.ts";
import { PolicyError, require } from "./types.ts";

const UI_PORT = 3000;
const MS_PORT = 3001;

/** Fujin is the single router; every other native peer dials its ZMQ socket. */
function fujinEndpoint(platform: string, spec: PlatformSpec): string {
	const zmq = require(spec.apps.fujin?.ports?.zmq, "spec.apps.fujin.ports.zmq");
	return `tcp://${n.app(platform, "fujin")}:${zmq}`;
}

/**
 * The behemoth whose in-process valkey the stateless pods use, or null when
 * there is no single one — the cloud profile has a shard per tenant, and the
 * scope index is what resolves it per request.
 */
function cacheHostOf(platform: string, spec: PlatformSpec): string | null {
	if (spec.profile === "mono") return n.monoStorage(platform);
	if (spec.profile === "multi") {
		const shards = resolveShards(platform, spec);
		const catchAll = shards.find((shard) => shard.catchAll);
		return catchAll ? catchAll.resourceName : null;
	}
	return null;
}

function baseEnv(
	platform: string,
	spec: PlatformSpec,
	port: number,
	extra: Record<string, string>,
	controllerNamespace?: string,
): Record<string, string> {
	const cacheHost = cacheHostOf(platform, spec);
	assertNoRegistryEnv(spec.env, "spec.env");
	assertNoRegistryEnv(extra, "solution env");
	return {
		NODE_ENV: "production",
		PORT: String(port),
		PLATFORM: platform,
		PLATFORM_PROFILE: spec.profile,
		// Relative on purpose. The browser reaches fujin through the same
		// gateway that served the page, and under `cloud` that hostname is the
		// tenant's — there is no one absolute URL to hand out.
		FUJIN_WS_URL: "/ws",
		STORAGE_VALKEY_PORT: String(spec.storage.cachePort),
		// Set explicitly because the platform Secret is a dump of a `.env` file
		// and carries a developer's DATA_DIR. Container env wins over envFrom,
		// so stating it here is what keeps that path out of the cluster.
		DATA_DIR: "/app/data",
		// Behemoth runs valkey in-process; there is no separate cache to
		// deploy or address. In cloud the shard is per tenant and resolved from
		// the scope index at request time, so no platform-wide URL exists.
		...(cacheHost
			? { CACHE_URL: `redis://${cacheHost}:${spec.storage.cachePort}/0` }
			: {}),
		FUJIN_ZMQ_ENDPOINT: fujinEndpoint(platform, spec),
		...(spec.env ?? {}),
		...extra,
		// Last, and guarded above: the registry contract is ptah's, so no
		// operator-supplied env can move a pod off the proxy even if the guard
		// is one day relaxed.
		...registryData(spec.registry, controllerNamespace),
	};
}

/**
 * The module cache mount for a stateless pod.
 *
 * Only added when a registry is configured: without one every module already
 * lives in the image, and an unused mount would just be a lie about where the
 * code comes from.
 */
function nativeApp(
	platform: string,
	spec: PlatformSpec,
	owner: string,
	name: string,
	app: NativeApp,
	modulesDigest: string,
	accessSecrets: string[],
): KubeObject[] {
	const resourceName = n.app(platform, name);
	const labels = n.labels(platform, name, owner);
	const ports = Object.entries(app.ports ?? {}).map(([portName, port]) => ({
		name: portName,
		port,
	}));

	// Centimanus keeps workflow state and refuses to guess where. Valkey is
	// what makes that state survive a restart, and behemoth already runs one —
	// but only where there is a single cache to name. Under `cloud` the cache
	// is per tenant and resolved per request, so there is no platform-wide host
	// to hand over and in-process state is the honest answer.
	const cacheHost = cacheHostOf(platform, spec);
	const stateEnv =
		name !== "centimanus"
			? {}
			: cacheHost
				? {
						RT_STATE_BACKEND: "valkey",
						VALKEY_HOST: cacheHost,
						VALKEY_PORT: String(spec.storage.cachePort),
					}
				: { RT_STATE_BACKEND: "memory" };

	const env: Record<string, string> = {
		// Fujin refuses to start without a browser scope, and the value is a
		// property of the platform rather than of the image. Seeded before
		// `app.env` so a platform can still override it.
		...(name === "fujin" ? { FUJIN_BROWSER_SCOPE: platform } : {}),
		...stateEnv,
		...(app.env ?? {}),
	};
	// Fujin itself binds the socket; its peers are told where to dial.
	if (name !== "fujin" && app.fujinEndpointEnv) {
		env[app.fujinEndpointEnv] = fujinEndpoint(platform, spec);
	}
	for (const [portName, envName] of Object.entries(app.portEnv ?? {})) {
		const port = app.ports?.[portName];
		if (port !== undefined) env[envName] = String(port);
	}

	const objects: KubeObject[] = [
		k8s.deployment({
			name: resourceName,
			namespace: spec.namespace,
			labels,
			selector: n.selector(platform, name),
			replicas: app.replicas ?? 1,
			hostNetwork: app.hostNetwork,
			annotations: { [n.ANNOTATION_MODULES]: modulesDigest },
			containers: [
				{
					name,
					image: app.image,
					env,
					envFromSecret: spec.secretName,
					// Resonus will not start without SERVICE_TOKEN, and every peer
					// that calls another one needs the same identity the platform
					// signs with. It lives in the Secret ptah mints, not in the
					// credentials Secret an operator supplies.
					envFromSecrets: accessSecrets,
					ports,
					resources: app.resources,
				},
			],
		}),
	];

	if (ports.length > 0) {
		// The Fujin websocket is what the ingress targets, so it is published
		// on :80 while the ZMQ peer port keeps its own name.
		const servicePorts =
			name === "fujin"
				? ports.map((p) =>
						p.name === "ws" ? { ...p, port: 80, targetPort: p.port } : p,
					)
				: ports;
		objects.push(
			k8s.service(
				resourceName,
				spec.namespace,
				labels,
				n.selector(platform, name),
				servicePorts,
			),
		);
	}

	return objects;
}

export function reconcilePlatform(input: ReconcileInput): ReconcileOutput {
	const platform = input.object.metadata.name;
	const spec = input.object.spec as PlatformSpec;
	const owner = n.ownerLabel("Platform", platform);
	require(spec.namespace, "spec.namespace");
	require(spec.profile, "spec.profile");

	// Both workloads take the same platform-wide env; only the port and the
	// per-workload additions differ.
	const baseEnvFor = (port: number, extra: Record<string, string>) =>
		baseEnv(platform, spec, port, extra, input.controllerNamespace);
	const merged = mergeSolutions(selectSolutions(input.solutions, platform));
	// The rollout stamp covers the registry as well as the module set: pointing
	// the platform at a new revision changes nothing the pods can observe
	// unless they restart, so the digest has to move with it.
	const rollout = n.digest(
		JSON.stringify([
			merged.digest,
			registryData(spec.registry, input.controllerNamespace),
		]),
	);
	const modules = { [n.ANNOTATION_MODULES]: rollout };
	const domains =
		spec.profile === "cloud"
			? domainIndexData(input.object, input.tenants)
			: undefined;
	const statelessAnnotations = {
		...modules,
		...(domains
			? { [n.ANNOTATION_DOMAINS]: n.digest(domains.STORAGE_TENANT_SERVICES) }
			: {}),
	};
	const resources: KubeObject[] = [];

	// The platform signs its own tokens. Emitting the Secret here rather than
	// asking an operator for one is the difference between a platform that
	// starts empty and a platform that cannot start until somebody generates an
	// Ed25519 pair by hand.
	const access = accessMaterial();
	const accessSecrets = access ? [accessSecretName(platform)] : [];
	if (access) {
		resources.push(
			k8s.secret(
				accessSecretName(platform),
				spec.namespace,
				n.labels(platform, "access", owner),
				accessSecretData(access),
			),
		);
	}

	resources.push(
		k8s.configMap(
			n.modulesConfigMap(platform),
			spec.namespace,
			n.labels(platform, "modules", owner),
			moduleData(merged, spec.registry, input.controllerNamespace),
		),
	);

	for (const [name, app] of Object.entries(spec.apps)) {
		resources.push(
			...nativeApp(platform, spec, owner, name, app, rollout, accessSecrets),
		);
	}

	// Processors are peers like any other, but they exist only while a solution
	// asks for them: a platform with no slicing solution should not be running
	// a slicer. Naming one that the platform never declared is a typo worth
	// failing on — the alternative is a workflow that waits forever for a peer
	// that was quietly skipped.
	for (const name of merged.processors) {
		const processor = spec.processors?.[name];
		if (!processor) {
			throw new PolicyError(
				`solution requires processor ${name}, absent from spec.processors`,
			);
		}
		resources.push(
			...nativeApp(
				platform,
				spec,
				owner,
				name,
				processor,
				rollout,
				accessSecrets,
			),
		);
	}

	const solutionEnv = merged.env;

	const uiLabels = n.labels(platform, "ui", owner);
	const uiSelector = n.selector(platform, "ui");
	resources.push(
		k8s.deployment({
			name: n.ui(platform),
			namespace: spec.namespace,
			labels: uiLabels,
			selector: uiSelector,
			replicas: spec.replicas?.ui ?? 1,
			annotations: statelessAnnotations,
			containers: [
				{
					name: "ui",
					image: spec.images.ui,
					env: baseEnvFor(UI_PORT, {
						...solutionEnv,
						FUJIN_TARGET: "ui",
						// A fallback, not a pin: the per-request scope arrives in the
						// edge headers. SSR still needs one at startup for the assets
						// it serves before any request has been seen.
						STORAGE_SCOPE: platform,
						// The scope the server-rendered shell hands the browser, and
						// the same one fujin registers connections under.
						FUJIN_BROWSER_SCOPE: platform,
						// The shell refuses to render without these, and they are
						// presentation defaults rather than anything an operator has
						// to decide. Read from spec.env explicitly: `extra` is merged
						// after it, so a plain default here would be one nobody could
						// override.
						FRONT_LOCALE: spec.env?.FRONT_LOCALE ?? "en",
						FRONT_CHAT_CONTEXT: spec.env?.FRONT_CHAT_CONTEXT ?? "chat",
						FRONT_CALL_CONTEXT: spec.env?.FRONT_CALL_CONTEXT ?? "voice",
						FRONTEND_MODULES: JSON.stringify(merged.microfrontends),
						SERVICES_BASE: `http://${n.services(platform)}:80/services`,
					}),
					// The scope index is a ConfigMap because it changes as tenants
					// come and go, and a pod should pick that up on restart rather
					// than on a policy edit.
					envFromConfigMap: n.domainsConfigMap(platform),
					envFromSecret: spec.secretName,
					envFromSecrets: accessSecrets,
					ports: [{ name: "http", port: UI_PORT }],
					resources: spec.resources?.ui,
					probePort: UI_PORT,
				},
			],
		}),
		k8s.service(n.ui(platform), spec.namespace, uiLabels, uiSelector, [
			{ name: "http", port: 80, targetPort: UI_PORT },
		]),
	);

	const msLabels = n.labels(platform, "services", owner);
	const msSelector = n.selector(platform, "services");
	resources.push(
		k8s.deployment({
			name: n.services(platform),
			namespace: spec.namespace,
			labels: msLabels,
			selector: msSelector,
			replicas: spec.replicas?.ms ?? 1,
			annotations: statelessAnnotations,
			containers: [
				{
					name: "services",
					image: spec.images.ms,
					env: baseEnvFor(MS_PORT, {
						...solutionEnv,
						FUJIN_TARGET: "services",
						// The ms calls its own HTTP surface for service-to-service
						// hops, and the startup checklist requires the value whether
						// or not a given microservice makes one. Same address the ui
						// is given — there is one services Service per platform.
						SERVICES_BASE: `http://${n.services(platform)}:80/services`,
						// Only mono has one scope for every request. Multi splits by
						// scope and cloud takes it from the edge headers, so pinning
						// one here would override what the request actually carries.
						...(spec.profile === "mono" ? { STORAGE_SCOPE: platform } : {}),
						MICROSERVICES: JSON.stringify(merged.microservices),
					}),
					envFromConfigMap: n.domainsConfigMap(platform),
					envFromSecret: spec.secretName,
					envFromSecrets: accessSecrets,
					ports: [{ name: "http", port: MS_PORT }],
					resources: spec.resources?.ms,
					probePort: MS_PORT,
				},
			],
		}),
		k8s.service(n.services(platform), spec.namespace, msLabels, msSelector, [
			{ name: "http", port: 80, targetPort: MS_PORT },
		]),
	);

	resources.push(
		k8s.gateway(
			n.gateway(platform),
			spec.namespace,
			n.labels(platform, "gateway", owner),
			require(spec.gateway.className, "spec.gateway.className"),
			spec.gateway.hosts.map((host, index) => ({
				name: n.listenerName(host, index),
				hostname: host,
				port: spec.gateway.httpsPort,
				certificateRef: spec.gateway.tls?.secretName,
			})),
		),
	);

	resources.push(
		...buildExtras(spec, platform, spec.namespace, owner, "platform"),
	);

	// A solution's own ConfigMaps, Secrets and claims are owned by the
	// platform, not by the Solution: the Solution holds no objects of its own,
	// so pruning them has to follow the platform's desired set.
	for (const solution of selectSolutions(input.solutions, platform)) {
		resources.push(
			...buildExtras(
				(solution.spec ?? {}) as PlatformSpec,
				platform,
				spec.namespace,
				owner,
				`solution-${solution.metadata.name}`,
			),
		);
	}

	let shardNames: string[] = [];
	if (spec.profile === "mono") {
		resources.push(
			...storageResources({
				platform,
				owner,
				namespace: spec.namespace,
				name: n.monoStorage(platform),
				microservices: merged.microservices,
				storage: spec.storage,
				fujinEndpoint: fujinEndpoint(platform, spec),
			}),
			// One scope, one shard — but the index is published all the same, so
			// ui and ms resolve their storage the same way in every profile and
			// the ConfigMap they read from always exists.
			shardIndex(platform, spec, owner, [
				{
					name: platform,
					scopes: [platform, CATCH_ALL],
					resourceName: n.monoStorage(platform),
					catchAll: true,
				},
			]),
		);
	} else if (spec.profile === "multi") {
		const shards = resolveShards(platform, spec);
		shardNames = shards.map((shard) => shard.name);
		resources.push(
			...shardResources(
				platform,
				spec,
				owner,
				shards,
				merged.microservices,
				fujinEndpoint(platform, spec),
			),
			// Same ConfigMap and key the cloud profile publishes: a stateless
			// pod resolves a scope to a host without knowing which profile put
			// it there.
			shardIndex(platform, spec, owner, shards),
		);
	}

	// mono and multi serve every scope from one set of hostnames, so the
	// platform owns the route. In cloud the Tenant owns its own hostnames and a
	// catch-all here would shadow them.
	if (spec.profile !== "cloud") {
		resources.push(
			k8s.httpRoute(
				n.route(platform),
				spec.namespace,
				n.labels(platform, "route", owner),
				n.gateway(platform),
				spec.gateway.hosts,
				[
					{ pathPrefix: "/ws", service: n.app(platform, "fujin"), port: 80 },
					{ pathPrefix: "/", service: n.ui(platform), port: 80 },
				],
			),
		);
	}

	const tls = spec.gateway.tls;
	if (tls?.issuer) {
		resources.push(
			k8s.certificate(
				`${platform}-tls`,
				spec.namespace,
				n.labels(platform, "certificate", owner),
				tls.secretName,
				tls.issuer,
				tls.issuerKind ?? "ClusterIssuer",
				require(tls.dnsNames, "spec.ingress.tls.dnsNames"),
			),
		);
	}

	return {
		resources,
		status: {
			// A failed reconcile records ready=false. State the successful
			// counterpart explicitly so a later pass clears that stale condition.
			ready: true,
			reason: "",
			profile: spec.profile,
			namespace: spec.namespace,
			solutions: merged.names,
			modulesDigest: rollout,
			microservices: merged.microservices.length,
			microfrontends: merged.microfrontends.length,
			processors: merged.processors,
			shards: shardNames,
			registry: spec.registry?.url ?? "",
			observedGeneration: input.object.metadata.generation ?? 0,
		},
		requeueAfter: 0,
	};
}
