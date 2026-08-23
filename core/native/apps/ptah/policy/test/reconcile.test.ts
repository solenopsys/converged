import { describe, expect, test } from "bun:test";
import { reconcile } from "../src/index.ts";
import { ANNOTATION_DOMAINS, ANNOTATION_MODULES } from "../src/names.ts";
import type { KubeObject, ReconcileInput } from "../src/types.ts";
import {
	find,
	nodeAffinity,
	platform,
	registry,
	sharded,
	solution,
	specOf,
	staticStorage,
	tenant,
} from "./fixtures.ts";

function input(
	over: Partial<ReconcileInput> & Pick<ReconcileInput, "kind" | "object">,
): ReconcileInput {
	return { solutions: [], tenants: [], ...over };
}

interface RouteRuleShape {
	matches: { path: { type: string; value: string } }[];
	filters?: {
		type: string;
		requestHeaderModifier: { set: { name: string; value: string }[] };
	}[];
	backendRefs: { name: string; port: number }[];
}

function dataOf(object: KubeObject | undefined): Record<string, string> {
	return (object?.data ?? {}) as Record<string, string>;
}

function annotationsOf(object: KubeObject | undefined): Record<string, string> {
	const spec = object?.spec as {
		template?: { metadata?: { annotations?: Record<string, string> } };
	};
	return spec?.template?.metadata?.annotations ?? {};
}

describe("platform", () => {
	test("mono emits core workloads, storage and a route", () => {
		const { resources, status } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const kinds = resources.map((r) => `${r.kind}/${r.metadata.name}`).sort();

		expect(kinds).toEqual([
			"Certificate/converged-tls",
			"ConfigMap/converged-domains",
			"ConfigMap/converged-modules",
			"ConfigMap/converged-storage-config",
			"Deployment/converged-centimanus",
			"Deployment/converged-fujin",
			"Deployment/converged-services",
			"Deployment/converged-storage",
			"Deployment/converged-ui",
			"Gateway/converged",
			"HTTPRoute/converged",
			"Service/converged-centimanus",
			"Service/converged-fujin",
			"Service/converged-services",
			"Service/converged-storage",
			"Service/converged-ui",
		]);
		expect(status.ready).toBe(true);
		expect(status.reason).toBe("");
		expect(status.observedGeneration).toBe(3);
	});

	test("mono publishes a scope index too, so every profile resolves the same way", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const index = JSON.parse(
			dataOf(find(resources, "ConfigMap", "converged-domains"))
				.STORAGE_TENANT_SERVICES,
		);
		// Fujin, not the storage Service: behemoth is a DEALER that dials out
		// and listens on nothing but its cache port.
		const endpoint = {
			host: "converged-fujin.converged.svc.cluster.local",
			port: 5557,
			target: "behemoth",
			cacheHost: "converged-storage.converged.svc.cluster.local",
			cachePort: 6379,
		};
		expect(index).toEqual({ converged: endpoint, "*": endpoint });
	});

	test("stateless pods get the fujin route and their storage scope", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const envOf = (name: string) =>
			Object.fromEntries(
				specOf<{
					template: {
						spec: { containers: { env: { name: string; value: string }[] }[] };
					};
				}>(resources, "Deployment", name).template.spec.containers[0].env.map(
					(e) => [e.name, e.value],
				),
			);
		// Relative: under cloud the hostname belongs to the tenant, so there is
		// no absolute URL that would be right everywhere.
		expect(envOf("converged-ui").FUJIN_WS_URL).toBe("/ws");
		expect(envOf("converged-ui").FUJIN_TARGET).toBe("ui");
		expect(envOf("converged-services").FUJIN_TARGET).toBe("services");
		expect(envOf("converged-ui").STORAGE_SCOPE).toBe("converged");
		expect(envOf("converged-services").STORAGE_SCOPE).toBe("converged");
		// The Secret is a dump of a .env file and carries a developer's path;
		// an explicit value is what keeps it out.
		expect(envOf("converged-services").DATA_DIR).toBe("/app/data");

		// Under cloud the scope is per request. SSR still needs a startup
		// fallback, but ms must not be pinned or it would answer for the wrong
		// tenant whenever a header went missing.
		const cloud = reconcile(
			input({ kind: "Platform", object: platform("cloud") }),
		).resources;
		const envIn = (name: string) =>
			specOf<{
				template: {
					spec: { containers: { env: { name: string; value: string }[] }[] };
				};
			}>(cloud, "Deployment", name).template.spec.containers[0].env;
		expect(envIn("converged-ui").some((e) => e.name === "STORAGE_SCOPE")).toBe(true);
		expect(envIn("converged-services").some((e) => e.name === "STORAGE_SCOPE")).toBe(false);
	});

	test("the cache is behemoth's, not a workload of its own", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		// Behemoth runs valkey in-process. A separate cache Deployment would be
		// a second, empty cache that nothing writes to.
		expect(resources.some((r) => r.metadata.name.endsWith("-cache"))).toBe(false);

		const storage = specOf<{
			template: { spec: { containers: { args: string[]; command: string[] }[] } };
		}>(resources, "Deployment", "converged-storage");
		expect(storage.template.spec.containers[0].args).toContain("0.0.0.0:6379");
		// Without an explicit command the args would replace the image's CMD
		// and the runtime would try to exec "start".
		expect(storage.template.spec.containers[0].command).toEqual(["/app/storage"]);

		const svc = specOf<{ ports: { name: string; port: number }[] }>(
			resources,
			"Service",
			"converged-storage",
		);
		expect(svc.ports.map((p) => p.name)).toEqual(["storage", "cache"]);

		const envOf = (name: string) =>
			Object.fromEntries(
				(
					specOf<{
						template: {
							spec: { containers: { env: { name: string; value: string }[] }[] };
						};
					}>(resources, "Deployment", name).template.spec.containers[0].env ?? []
				).map((e) => [e.name, e.value]),
			);
		expect(envOf("converged-ui").CACHE_URL).toBe(
			"redis://converged-storage:6379/0",
		);
	});

	test("cloud leaves the cache to each tenant's own behemoth", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("cloud") }),
		);
		const env = specOf<{
			template: {
				spec: { containers: { env: { name: string; value: string }[] }[] };
			};
		}>(resources, "Deployment", "converged-ui").template.spec.containers[0].env;
		// No platform-wide cache exists: the shard is per tenant, and the scope
		// index is what resolves it per request.
		expect(env.some((e) => e.name === "CACHE_URL")).toBe(false);
	});

	test("cloud has no shared storage and no catch-all route", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("cloud") }),
		);
		expect(find(resources, "StatefulSet", "converged-storage")).toBeUndefined();
		expect(find(resources, "Deployment", "converged-storage")).toBeUndefined();
		expect(find(resources, "HTTPRoute", "converged")).toBeUndefined();
		// The Gateway is shared: tenants attach their own routes to it.
		expect(find(resources, "Gateway", "converged")).toBeDefined();
		expect(find(resources, "ConfigMap", "converged-domains")).toBeDefined();
	});

	test("fujin publishes its websocket on :80 and keeps the zmq peer port", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const svc = specOf<{ ports: unknown[] }>(
			resources,
			"Service",
			"converged-fujin",
		);
		expect(svc.ports).toEqual([
			{ name: "ws", port: 80, targetPort: 8087, protocol: "TCP" },
			{ name: "zmq", port: 5557, targetPort: 5557, protocol: "TCP" },
		]);
	});

	test("peers receive the fujin endpoint, fujin itself does not", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const envOf = (name: string) => {
			const spec = find(resources, "Deployment", name)?.spec as {
				template: {
					spec: { containers: { env?: { name: string; value: string }[] }[] };
				};
			};
			return Object.fromEntries(
				(spec.template.spec.containers[0].env ?? []).map((e) => [
					e.name,
					e.value,
				]),
			);
		};
		expect(envOf("converged-centimanus").CENTIMANUS_FUJIN_ZMQ_ENDPOINT).toBe(
			"tcp://converged-fujin:5557",
		);
		// Fujin gets no endpoint — it binds the socket — but it does need the
		// browser scope, without which it exits at startup.
		expect(envOf("converged-fujin")).toEqual({
			FUJIN_BROWSER_SCOPE: "converged",
		});
	});
});

describe("solutions", () => {
	test("merge into the module map and stamp a rollout digest", () => {
		const solutions = [
			solution("cnc", { microservices: ["geo"], microfrontends: ["geo"] }),
			solution("sales", {
				microservices: ["sales", "geo"],
				microfrontends: ["sales"],
			}),
		];
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono"), solutions }),
		);
		const modules = find(resources, "ConfigMap", "converged-modules");
		const data = dataOf(modules);

		expect(data.SOLUTIONS).toBe("cnc,sales");
		expect(JSON.parse(data.MICROSERVICES)).toEqual(["geo", "sales"]);
		expect(JSON.parse(data.FRONTEND_MODULES)).toEqual(["geo", "sales"]);

		const stamp = annotationsOf(find(resources, "Deployment", "converged-ui"))[
			ANNOTATION_MODULES
		];
		expect(stamp).toMatch(/^[0-9a-f]{8}$/);
	});

	test("the digest changes when the module set changes and only then", () => {
		const digestFor = (solutions: KubeObject[]) => {
			const { resources } = reconcile(
				input({ kind: "Platform", object: platform("mono"), solutions }),
			);
			return annotationsOf(find(resources, "Deployment", "converged-services"))[
				ANNOTATION_MODULES
			];
		};

		const base = digestFor([solution("cnc")]);
		expect(digestFor([solution("cnc")])).toBe(base);
		expect(
			digestFor([
				solution("cnc"),
				solution("extra", { microservices: ["billing"] }),
			]),
		).not.toBe(base);
	});

	test("a disabled solution contributes nothing", () => {
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object: platform("mono"),
				solutions: [solution("cnc", { enabled: false })],
			}),
		);
		const data = dataOf(find(resources, "ConfigMap", "converged-modules"));
		expect(data.SOLUTIONS).toBe("");
		expect(JSON.parse(data.MICROSERVICES)).toEqual([]);
	});

	test("reconciling a solution owns no objects", () => {
		const object = solution("cnc");
		const output = reconcile(
			input({ kind: "Solution", object, platform: platform("cloud") }),
		);
		expect(output.resources).toEqual([]);
		expect(output.status.applied).toBe(true);
	});
});

describe("tenant", () => {
	test("emits a storage shard, scope middleware and host routes", () => {
		const { resources, status } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc"),
				platform: platform("cloud"),
			}),
		);
		expect(resources.map((r) => `${r.kind}/${r.metadata.name}`).sort()).toEqual(
			[
				"ConfigMap/converged-storage-democnc-config",
				"Deployment/converged-storage-democnc",
				"HTTPRoute/converged-tenant-democnc",
				"Service/converged-storage-democnc",
			],
		);
		expect(status.ready).toBe(true);
		expect(status.domains).toEqual(["democnc.4ir.club"]);
		const storage = specOf<{
			template: {
				spec: { containers: { env: { name: string; value: string }[] }[] };
			};
		}>(resources, "Deployment", "converged-storage-democnc");
		expect(storage.template.spec.containers[0].env).toContainEqual({
			name: "FUJIN_TARGET",
			value: "behemoth-democnc",
		});
	});

	test("the scope header is forced on every rule, so a client cannot spoof it", () => {
		const { resources } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc"),
				platform: platform("cloud"),
			}),
		);
		const { rules } = specOf<{ rules: RouteRuleShape[] }>(
			resources,
			"HTTPRoute",
			"converged-tenant-democnc",
		);
		expect(rules).toHaveLength(2);
		for (const rule of rules) {
			// `set`, not `add`: an inbound x-storage-scope is overwritten.
			expect(rule.filters?.[0].type).toBe("RequestHeaderModifier");
			expect(rule.filters?.[0].requestHeaderModifier.set).toEqual([
				{ name: "x-storage-scope", value: "democnc" },
				{ name: "workspace", value: "democnc" },
			]);
		}
	});

	test("the tenant route attaches to the platform gateway", () => {
		const { resources } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc"),
				platform: platform("cloud"),
			}),
		);
		const route = find(resources, "HTTPRoute", "converged-tenant-democnc");
		const spec = route?.spec as {
			parentRefs: { name: string; namespace: string }[];
			hostnames: string[];
		};
		expect(spec.parentRefs).toEqual([
			{ name: "converged", namespace: "converged" },
		]);
		expect(spec.hostnames).toEqual(["democnc.4ir.club"]);
	});

	test("extra domains are added alongside the automatic one, without duplicates", () => {
		const { status } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc", {
					domains: ["Shop.example.com", "democnc.4ir.club"],
				}),
				platform: platform("cloud"),
			}),
		);
		expect(status.domains).toEqual(["democnc.4ir.club", "shop.example.com"]);
	});

	test("a missing platform requeues instead of pruning the tenant's objects", () => {
		const output = reconcile(
			input({ kind: "Tenant", object: tenant("democnc") }),
		);
		expect(output.resources).toEqual([]);
		expect(output.status.ready).toBe(false);
		expect(output.requeueAfter).toBeGreaterThan(0);
	});

	test("a tenant on a mono platform is a configuration error", () => {
		expect(() =>
			reconcile(
				input({
					kind: "Tenant",
					object: tenant("democnc"),
					platform: platform("mono"),
				}),
			),
		).toThrow(/require cloud/);
	});

	test("tenants narrow the platform's solutions to their own subscription", () => {
		const solutions = [
			solution("cnc"),
			solution("sales", { microservices: ["sales"] }),
		];
		const { status } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc", { solutions: ["sales"] }),
				platform: platform("cloud"),
				solutions,
			}),
		);
		expect(status.solutions).toEqual(["sales"]);
	});

	test("the domain index maps every tenant scope to its storage shard", () => {
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object: platform("cloud"),
				tenants: [tenant("democnc"), tenant("other")],
			}),
		);
		const cm = dataOf(find(resources, "ConfigMap", "converged-domains"));
		expect(JSON.parse(cm.STORAGE_TENANT_SERVICES)).toEqual({
			democnc: {
				host: "converged-fujin.converged.svc.cluster.local",
				port: 5557,
				target: "behemoth-democnc",
				cacheHost: "converged-storage-democnc.converged.svc.cluster.local",
				cachePort: 6379,
			},
			other: {
				host: "converged-fujin.converged.svc.cluster.local",
				port: 5557,
				target: "behemoth-other",
				cacheHost: "converged-storage-other.converged.svc.cluster.local",
				cachePort: 6379,
			},
		});
	});

	test("a domain-index change rolls UI and services so envFrom is refreshed", () => {
		const annotationsFor = (tenants: KubeObject[], deployment: string) =>
			annotationsOf(
				find(
					reconcile(
						input({ kind: "Platform", object: platform("cloud"), tenants }),
					).resources,
					"Deployment",
					deployment,
				),
			)[ANNOTATION_DOMAINS];
		expect(annotationsFor([], "converged-ui")).not.toBe(
			annotationsFor([tenant("democnc")], "converged-ui"),
		);
		expect(annotationsFor([tenant("democnc")], "converged-services")).toBe(
			annotationsFor([tenant("democnc")], "converged-ui"),
		);
	});
});

describe("ownership", () => {
	test("every emitted object carries the prune selector", () => {
		const all = [
			...reconcile(input({ kind: "Platform", object: platform("mono") }))
				.resources,
			...reconcile(
				input({
					kind: "Tenant",
					object: tenant("t1"),
					platform: platform("cloud"),
				}),
			).resources,
		];
		for (const resource of all) {
			expect(resource.metadata.labels?.["app.kubernetes.io/managed-by"]).toBe(
				"ptah",
			);
			expect(resource.metadata.labels?.["ptah.io/owner"]).toMatch(
				/^(platform|tenant)\./,
			);
		}
	});
});

describe("storage", () => {
	test("creates one claim and one mount per microservice", () => {
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object: platform("mono"),
				solutions: [
					solution("suite", { microservices: ["billing", "geo", "billing"] }),
				],
			}),
		);

		const pvcNames = resources
			.filter((resource) => resource.kind === "PersistentVolumeClaim")
			.map((resource) => resource.metadata.name)
			.sort();
		expect(pvcNames).toEqual([
			"converged-billing",
			"converged-geo",
		]);

		// Keys are the store ids the services actually ask for, not the bare
		// module names a Solution lists.
		const config = dataOf(
			find(resources, "ConfigMap", "converged-storage-config"),
		);
		expect(JSON.parse(config["storage.json"])).toEqual({
			microservices: {
				"billing-ms": "/app/data/converged-billing",
				"geo-ms": "/app/data/converged-geo",
			},
		});

		const deployment = find(resources, "Deployment", "converged-storage");
		const deploymentSpec = deployment?.spec as {
			template: {
				spec: {
					volumes: {
						name: string;
						persistentVolumeClaim?: { claimName: string };
					}[];
					containers: {
						args: string[];
						volumeMounts: { name: string; mountPath: string }[];
					}[];
				};
			};
		};
		expect(
			deploymentSpec.template.spec.volumes.map((volume) => volume.name).sort(),
		).toEqual([
			"converged-billing",
			"converged-geo",
			"storage-config",
		]);
		expect(
			deploymentSpec.template.spec.containers[0].volumeMounts,
		).toContainEqual({
			name: "converged-geo",
			mountPath: "/app/data/converged-geo",
		});
		expect(deploymentSpec.template.spec.containers[0].args).toContain(
			"/etc/behemoth/storage.json",
		);
	});

	test("a claim with no volumeSource asks a provisioner and names no volume", () => {
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object: platform("mono"),
				solutions: [solution("suite", { microservices: ["billing", "geo"] })],
			}),
		);
		// No `volumeName`: there is nothing to pre-bind to yet, and asking for
		// a volume by a name the provisioner has not used would leave the claim
		// Pending forever.
		expect(
			specOf<Record<string, unknown>>(
				resources,
				"PersistentVolumeClaim",
				"converged-geo",
			),
		).toEqual({
			accessModes: ["ReadWriteOnce"],
			storageClassName: "local-path",
			resources: { requests: { storage: "5Gi" } },
		});
		// The volume is the provisioner's to create, so it is not ptah's to
		// declare — and not ptah's to strand as a Released object on the next
		// install either.
		expect(
			resources.filter((resource) => resource.kind === "PersistentVolume"),
		).toEqual([]);
	});

	test("a volumeSource pre-binds every claim to a PV of its own", () => {
		const object = platform("mono");
		(object.spec as Record<string, unknown>).storage = staticStorage();
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object,
				solutions: [solution("suite", { microservices: ["billing", "geo"] })],
			}),
		);
		expect(
			specOf<Record<string, unknown>>(
				resources,
				"PersistentVolumeClaim",
				"converged-geo",
			),
		).toEqual({
			accessModes: ["ReadWriteOnce"],
			storageClassName: "converged-local",
			resources: { requests: { storage: "5Gi" } },
			volumeName: "converged-geo",
		});
		expect(
			specOf<Record<string, unknown>>(
				resources,
				"PersistentVolume",
				"converged-geo",
			),
		).toEqual({
			capacity: { storage: "5Gi" },
			accessModes: ["ReadWriteOnce"],
			storageClassName: "converged-local",
			persistentVolumeReclaimPolicy: "Retain",
			nodeAffinity,
			hostPath: {
				path: "/var/lib/ptah/converged-geo",
				type: "DirectoryOrCreate",
			},
		});
	});

	test("rejects a node-local volumeSource that is not pinned to a node", () => {
		const object = platform("mono");
		const storage = staticStorage();
		delete storage.nodeAffinity;
		(object.spec as Record<string, unknown>).storage = storage;
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object,
					solutions: [solution("suite", { microservices: ["geo"] })],
				}),
			),
		).toThrow(/node-local/);
	});

	test("a tenant gets separate per-microservice disks with its size override", () => {
		const { resources } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc", { storageSize: "50Gi" }),
				platform: platform("cloud"),
				solutions: [solution("suite", { microservices: ["geo"] })],
			}),
		);
		const claim = specOf<{ resources: unknown }>(
			resources,
			"PersistentVolumeClaim",
			"democnc-geo",
		);
		expect(claim.resources).toEqual({ requests: { storage: "50Gi" } });
	});

	test("rejects a source template that maps microservices to the same disk", () => {
		const object = platform("mono");
		const storage = staticStorage({
			volumeSource: { hostPath: { path: "/var/lib/ptah/shared" } },
		});
		(object.spec as Record<string, unknown>).storage = storage;
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object,
					solutions: [solution("suite", { microservices: ["billing", "geo"] })],
				}),
			),
		).toThrow(/distinct source/);
	});
});

describe("multi", () => {
	const suite = () => [
		solution("suite", { microservices: ["billing", "geo"] }),
	];

	test("one behemoth per shard, each with its own disk per microservice", () => {
		const { resources, status } = reconcile(
			input({ kind: "Platform", object: sharded(), solutions: suite() }),
		);

		expect(
			resources
				.filter(
					(r) =>
						r.kind === "Deployment" && r.metadata.name.includes("-storage-"),
				)
				.map((r) => r.metadata.name)
				.sort(),
		).toEqual(["converged-storage-alpha", "converged-storage-rest"]);

		expect(
			resources
				.filter((r) => r.kind === "PersistentVolumeClaim")
				.map((r) => r.metadata.name)
				.sort(),
		).toEqual([
			"converged-alpha-billing",
			"converged-alpha-geo",
			"converged-rest-billing",
			"converged-rest-geo",
		]);
		expect(status.shards).toEqual(["alpha", "rest"]);
	});

	test("each shard's pods select only their own storage", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: sharded(), solutions: suite() }),
		);
		const selectorOf = (name: string) =>
			specOf<{ selector: { matchLabels: Record<string, string> } }>(
				resources,
				"Deployment",
				name,
			).selector.matchLabels["app.kubernetes.io/component"];
		expect(selectorOf("converged-storage-alpha")).toBe("storage-alpha");
		expect(selectorOf("converged-storage-rest")).toBe("storage-rest");
	});

	test("the scope index resolves every scope, including the catch-all", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: sharded(), solutions: suite() }),
		);
		const index = JSON.parse(
			dataOf(find(resources, "ConfigMap", "converged-domains"))
				.STORAGE_TENANT_SERVICES,
		);
		// Every scope routes through fujin; only the cache host is per-shard,
		// because valkey is the one port behemoth actually listens on.
		const shardEndpoint = (shard: string) => ({
			host: "converged-fujin.converged.svc.cluster.local",
			port: 5557,
			target: "behemoth",
			cacheHost: `converged-storage-${shard}.converged.svc.cluster.local`,
			cachePort: 6379,
		});
		expect(index).toEqual({
			acme: shardEndpoint("alpha"),
			globex: shardEndpoint("alpha"),
			"*": shardEndpoint("rest"),
		});
	});

	test("multi publishes the platform-wide route, like mono", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: sharded() }),
		);
		expect(find(resources, "HTTPRoute", "converged")).toBeDefined();
	});

	test("a per-shard size override applies to that shard's volumes only", () => {
		const object = sharded([
			{ name: "alpha", scopes: ["acme"], size: "50Gi" },
			{ name: "rest", scopes: ["*"] },
		]);
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object,
				solutions: [solution("s", { microservices: ["geo"] })],
			}),
		);
		const capacity = (name: string) =>
			specOf<{ resources: { requests: { storage: string } } }>(
				resources,
				"PersistentVolumeClaim",
				name,
			).resources.requests.storage;
		expect(capacity("converged-alpha-geo")).toBe("50Gi");
		expect(capacity("converged-rest-geo")).toBe("5Gi");
	});

	test("a scope claimed twice is rejected rather than resolved by map order", () => {
		const object = sharded([
			{ name: "alpha", scopes: ["acme"] },
			{ name: "beta", scopes: ["acme"] },
			{ name: "rest", scopes: ["*"] },
		]);
		expect(() => reconcile(input({ kind: "Platform", object }))).toThrow(
			/scope acme is claimed by both/,
		);
	});

	test("a shard set with no catch-all leaves unknown scopes nowhere to go", () => {
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object: sharded([{ name: "only", scopes: ["acme"] }]),
				}),
			),
		).toThrow(/exactly one catch-all/);
	});

	test("two catch-alls are caught as the scope collision they are", () => {
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object: sharded([
						{ name: "a", scopes: ["*"] },
						{ name: "b", scopes: ["*"] },
					]),
				}),
			),
		).toThrow(/scope \* is claimed by both a and b/);
	});

	test("multi without shards is a configuration error, not an empty platform", () => {
		expect(() =>
			reconcile(input({ kind: "Platform", object: platform("multi") })),
		).toThrow(/requires at least one entry in spec.shards/);
	});
});

describe("processors", () => {
	const withProcessors = (extra: Record<string, unknown> = {}) =>
		platform("mono", {
			processors: {
				curaengine: {
					image: "reg/curaengine:1",
					fujinTarget: "curaengine",
					fujinEndpointEnv: "CURAENGINE_FUJIN_ZMQ_ENDPOINT",
				},
				opencamlib: { image: "reg/opencamlib:1", fujinTarget: "opencamlib" },
			},
			...extra,
		});

	test("a declared processor stays undeployed until a solution selects it", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: withProcessors() }),
		);
		expect(
			find(resources, "Deployment", "converged-curaengine"),
		).toBeUndefined();
		expect(
			find(resources, "Deployment", "converged-opencamlib"),
		).toBeUndefined();
	});

	test("selecting one deploys it as a peer with the fujin endpoint", () => {
		const { resources, status } = reconcile(
			input({
				kind: "Platform",
				object: withProcessors(),
				solutions: [solution("cam", { processors: ["curaengine"] })],
			}),
		);
		expect(find(resources, "Deployment", "converged-curaengine")).toBeDefined();
		expect(
			find(resources, "Deployment", "converged-opencamlib"),
		).toBeUndefined();

		const env = specOf<{
			template: {
				spec: { containers: { env?: { name: string; value: string }[] }[] };
			};
		}>(resources, "Deployment", "converged-curaengine").template.spec
			.containers[0].env;
		expect(env).toContainEqual({
			name: "CURAENGINE_FUJIN_ZMQ_ENDPOINT",
			value: "tcp://converged-fujin:5557",
		});
		expect(status.processors).toEqual(["curaengine"]);
	});

	test("an unknown processor fails loudly instead of being skipped", () => {
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object: withProcessors(),
					solutions: [solution("cam", { processors: ["slic3r"] })],
				}),
			),
		).toThrow(/requires processor slic3r/);
	});

	test("the module map lists the active processors", () => {
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object: withProcessors(),
				solutions: [
					solution("cam", { processors: ["opencamlib", "curaengine"] }),
				],
			}),
		);
		const data = dataOf(find(resources, "ConfigMap", "converged-modules"));
		expect(JSON.parse(data.PROCESSORS)).toEqual(["curaengine", "opencamlib"]);
	});
});

describe("module registry", () => {
	test("without one, nothing about a remote registry is published", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const data = dataOf(find(resources, "ConfigMap", "converged-modules"));
		expect(data.MODULE_PROXY).toBeUndefined();

		const spec = find(resources, "Deployment", "converged-ui")?.spec as {
			template: { spec: { volumes?: unknown[] } };
		};
		expect(spec.template.spec.volumes).toBeUndefined();
	});

	test("the registry reaches the module map and the stateless pods", () => {
		const { resources, status } = reconcile(
			input({ kind: "Platform", object: platform("mono", { registry }) }),
		);
		const data = dataOf(find(resources, "ConfigMap", "converged-modules"));
		expect(data.MODULE_PROXY).toBe("http://ptah-proxy");
		expect(JSON.parse(data.MODULE_DIGESTS)).toEqual(registry.modules);
		expect(data.MODULE_REGISTRY_REVISION).toBe(registry.revision);
		expect(status.registry).toBe(registry.url);

		for (const name of ["converged-ui", "converged-services"]) {
			const spec = find(resources, "Deployment", name)?.spec as {
				template: {
					spec: {
						volumes?: unknown[];
						containers: {
							env: { name: string; value: string }[];
							volumeMounts?: unknown[];
						}[];
					};
				};
			};
			expect(spec.template.spec.volumes).toBeUndefined();
			expect(spec.template.spec.containers[0].volumeMounts).toBeUndefined();
			expect(spec.template.spec.containers[0].env).toContainEqual({
				name: "MODULE_PROXY",
				value: "http://ptah-proxy",
			});
		}
	});

	test("the proxy is addressed across namespaces", () => {
		const { resources } = reconcile(
			input({
				kind: "Platform",
				object: platform("mono", { registry }),
				controllerNamespace: "kube-system",
			}),
		);
		// The controller serves modules from a Service in its own namespace
		// while every consumer runs in the platform's, so the short name would
		// resolve to nothing the moment the two stop being the same namespace.
		const proxy = "http://ptah-proxy.kube-system.svc.cluster.local";
		expect(dataOf(find(resources, "ConfigMap", "converged-modules")).MODULE_PROXY)
			.toBe(proxy);
		const spec = find(resources, "Deployment", "converged-services")?.spec as {
			template: { spec: { containers: { env: { name: string; value: string }[] }[] } };
		};
		expect(spec.template.spec.containers[0].env).toContainEqual({
			name: "MODULE_PROXY",
			value: proxy,
		});
	});

	test("spec.env cannot point a pod at the registry itself", () => {
		// The failure this prevents: pods handed the bucket URL fetch modules
		// over the internet at boot, so a node that comes up before its egress
		// does starts a platform with an arbitrary prefix of its microservices
		// missing — and reports itself healthy.
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object: platform("mono", {
						registry,
						env: { MODULE_PROXY: registry.url },
					}),
					controllerNamespace: "kube-system",
				}),
			),
		).toThrow(/spec\.env may not set MODULE_PROXY/);
	});

	test("a solution cannot point a pod at the registry itself", () => {
		expect(() =>
			reconcile(
				input({
					kind: "Platform",
					object: platform("mono", { registry }),
					solutions: [
						solution("geo", { env: { MODULE_DIGESTS: "{}" } }),
					],
					controllerNamespace: "kube-system",
				}),
			),
		).toThrow(/solution env may not set MODULE_DIGESTS/);
	});

	test("the proxy cache is not mounted in consumers", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono", { registry }) }),
		);
		const spec = find(resources, "Deployment", "converged-ui")?.spec as {
			template: { spec: { volumes?: unknown[] } };
		};
		expect(spec.template.spec.volumes).toBeUndefined();
	});

	test("a new revision rolls the pods even though the module set is unchanged", () => {
		const stampFor = (object: KubeObject) =>
			annotationsOf(
				find(
					reconcile(input({ kind: "Platform", object })).resources,
					"Deployment",
					"converged-ui",
				),
			)[ANNOTATION_MODULES];

		const before = stampFor(platform("mono", { registry }));
		expect(stampFor(platform("mono", { registry }))).toBe(before);
		expect(
			stampFor(
				platform("mono", { registry: { ...registry, revision: "next" } }),
			),
		).not.toBe(before);
	});
});

describe("declared extras", () => {
	const withExtras = () => {
		const object = platform("mono");
		(object.spec as Record<string, unknown>).configMaps = {
			"app-settings": { LOG_LEVEL: "debug" },
		};
		(object.spec as Record<string, unknown>).secrets = {
			"app-token": { TOKEN: "s3cr3t" },
		};
		(object.spec as Record<string, unknown>).claims = {
			"shared-cache": { size: "10Gi", storageClassName: "local-path" },
		};
		(object.spec as Record<string, unknown>).volumes = {
			"archive-pv": {
				capacity: "1Ti",
				storageClassName: "manual",
				source: { hostPath: { path: "/mnt/archive" } },
			},
		};
		return reconcile(input({ kind: "Platform", object })).resources;
	};

	test("a platform can declare config, secrets, claims and volumes", () => {
		const resources = withExtras();
		expect(find(resources, "ConfigMap", "app-settings")).toBeDefined();
		expect(find(resources, "Secret", "app-token")).toBeDefined();
		expect(
			find(resources, "PersistentVolumeClaim", "shared-cache"),
		).toBeDefined();
		expect(find(resources, "PersistentVolume", "archive-pv")).toBeDefined();
	});

	test("a PersistentVolume is cluster-scoped and keeps its data by default", () => {
		const pv = find(withExtras(), "PersistentVolume", "archive-pv");
		expect(pv?.metadata.namespace).toBeUndefined();
		expect(pv?.metadata.annotations?.["ptah.io/reclaim"]).toBe("retain");
		expect(pv?.spec).toEqual({
			capacity: { storage: "1Ti" },
			accessModes: ["ReadWriteOnce"],
			storageClassName: "manual",
			persistentVolumeReclaimPolicy: "Retain",
			hostPath: { path: "/mnt/archive" },
		});
	});

	test("claims opt in to deletion explicitly", () => {
		const object = platform("mono");
		(object.spec as Record<string, unknown>).claims = {
			scratch: {
				size: "1Gi",
				storageClassName: "local-path",
				reclaim: "delete",
			},
			keepme: { size: "1Gi", storageClassName: "local-path" },
		};
		const resources = reconcile(input({ kind: "Platform", object })).resources;
		expect(
			find(resources, "PersistentVolumeClaim", "scratch")?.metadata.annotations,
		).toEqual({ "ptah.io/reclaim": "delete" });
		expect(
			find(resources, "PersistentVolumeClaim", "keepme")?.metadata.annotations,
		).toEqual({ "ptah.io/reclaim": "retain" });
	});

	test("a solution's extras are owned by the platform that hosts it", () => {
		const object = platform("mono");
		const sol = solution("cnc");
		(sol.spec as Record<string, unknown>).configMaps = {
			"cnc-settings": { A: "1" },
		};
		const { resources } = reconcile(
			input({ kind: "Platform", object, solutions: [sol] }),
		);
		const cm = find(resources, "ConfigMap", "cnc-settings");
		// Owned by the platform: a Solution holds no objects of its own, so
		// prune has to follow the platform's desired set.
		expect(cm?.metadata.labels?.["ptah.io/owner"]).toBe("platform.converged");
	});
});
