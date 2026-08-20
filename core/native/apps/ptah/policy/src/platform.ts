/**
 * Base core: everything that exists before any solution is layered on.
 *
 * `mono` runs one shared storage StatefulSet in-namespace. `cloud` provisions
 * no storage here at all — it belongs to the Tenant reconciler, one shard per
 * tenant — so the two profiles differ by exactly that one decision.
 */

import { buildExtras } from "./extras.ts";
import * as k8s from "./k8s/index.ts";
import * as n from "./names.ts";
import { mergeSolutions, moduleData, selectSolutions } from "./solution.ts";
import { storageResources } from "./storage.ts";
import type {
	KubeObject,
	NativeApp,
	PlatformSpec,
	ReconcileInput,
	ReconcileOutput,
} from "./types.ts";
import { require } from "./types.ts";

const UI_PORT = 3000;
const MS_PORT = 3001;

/** Fujin is the single router; every other native peer dials its ZMQ socket. */
function fujinEndpoint(platform: string, spec: PlatformSpec): string {
	const zmq = require(spec.apps.fujin?.ports?.zmq, "spec.apps.fujin.ports.zmq");
	return `tcp://${n.app(platform, "fujin")}:${zmq}`;
}

function baseEnv(
	platform: string,
	spec: PlatformSpec,
	port: number,
	extra: Record<string, string>,
): Record<string, string> {
	return {
		NODE_ENV: "production",
		PORT: String(port),
		PLATFORM: platform,
		PLATFORM_PROFILE: spec.profile,
		CACHE_URL: `redis://${n.cache(platform)}:${spec.cache.port}/0`,
		FUJIN_ZMQ_ENDPOINT: fujinEndpoint(platform, spec),
		...(spec.env ?? {}),
		...extra,
	};
}

function nativeApp(
	platform: string,
	spec: PlatformSpec,
	owner: string,
	name: string,
	app: NativeApp,
	modulesDigest: string,
): KubeObject[] {
	const resourceName = n.app(platform, name);
	const labels = n.labels(platform, name, owner);
	const ports = Object.entries(app.ports ?? {}).map(([portName, port]) => ({
		name: portName,
		port,
	}));

	const env: Record<string, string> = { ...(app.env ?? {}) };
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
				? ports.map((p) => (p.name === "ws" ? { ...p, port: 80, targetPort: p.port } : p))
				: ports;
		objects.push(
			k8s.service(resourceName, spec.namespace, labels, n.selector(platform, name), servicePorts),
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

	const merged = mergeSolutions(selectSolutions(input.solutions, platform));
	const modules = { [n.ANNOTATION_MODULES]: merged.digest };
	const resources: KubeObject[] = [];

	resources.push(
		k8s.configMap(
			n.modulesConfigMap(platform),
			spec.namespace,
			n.labels(platform, "modules", owner),
			moduleData(merged),
		),
	);

	// Valkey: shared cache, no persistence — it is a cache, losing it is a
	// cold start and not a data loss.
	const cacheLabels = n.labels(platform, "cache", owner);
	const cacheSelector = n.selector(platform, "cache");
	resources.push(
		k8s.deployment({
			name: n.cache(platform),
			namespace: spec.namespace,
			labels: cacheLabels,
			selector: cacheSelector,
			replicas: 1,
			containers: [
				{
					name: "valkey",
					image: spec.cache.image,
					ports: [{ name: "redis", port: spec.cache.port }],
					resources: spec.cache.resources,
				},
			],
		}),
		k8s.service(n.cache(platform), spec.namespace, cacheLabels, cacheSelector, [
			{ name: "redis", port: spec.cache.port },
		]),
	);

	for (const [name, app] of Object.entries(spec.apps)) {
		resources.push(...nativeApp(platform, spec, owner, name, app, merged.digest));
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
			annotations: modules,
			containers: [
				{
					name: "ui",
					image: spec.images.ui,
					env: baseEnv(platform, spec, UI_PORT, {
						...solutionEnv,
						FRONTEND_MODULES: JSON.stringify(merged.microfrontends),
						SERVICES_BASE: `http://${n.services(platform)}:80/services`,
					}),
					envFromSecret: spec.secretName,
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
			annotations: modules,
			containers: [
				{
					name: "services",
					image: spec.images.ms,
					env: baseEnv(platform, spec, MS_PORT, {
						...solutionEnv,
						MICROSERVICES: JSON.stringify(merged.microservices),
					}),
					envFromSecret: spec.secretName,
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
		);

		// Only mono publishes a platform-wide route. In cloud the Tenant owns
		// its own hostnames, so a catch-all here would shadow them.
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
			profile: spec.profile,
			namespace: spec.namespace,
			solutions: merged.names,
			modulesDigest: merged.digest,
			microservices: merged.microservices.length,
			microfrontends: merged.microfrontends.length,
			observedGeneration: input.object.metadata.generation ?? 0,
		},
		requeueAfter: 0,
	};
}
