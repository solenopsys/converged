import { describe, expect, test } from "bun:test";
import { reconcile } from "../src/index.ts";
import { ANNOTATION_MODULES } from "../src/names.ts";
import type { KubeObject, ReconcileInput } from "../src/types.ts";
import { find, platform, solution, tenant } from "./fixtures.ts";

function input(over: Partial<ReconcileInput> & Pick<ReconcileInput, "kind" | "object">): ReconcileInput {
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
	const spec = object?.spec as { template?: { metadata?: { annotations?: Record<string, string> } } };
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
			"ConfigMap/converged-modules",
			"Deployment/converged-cache",
			"Deployment/converged-centimanus",
			"Deployment/converged-fujin",
			"Deployment/converged-services",
			"Deployment/converged-ui",
			"Gateway/converged",
			"HTTPRoute/converged",
			"Service/converged-cache",
			"Service/converged-centimanus",
			"Service/converged-fujin",
			"Service/converged-services",
			"Service/converged-storage",
			"Service/converged-ui",
			"StatefulSet/converged-storage",
		]);
		expect(status.observedGeneration).toBe(3);
	});

	test("cloud has no shared storage and no catch-all route", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("cloud") }),
		);
		expect(find(resources, "StatefulSet", "converged-storage")).toBeUndefined();
		expect(find(resources, "HTTPRoute", "converged")).toBeUndefined();
		// The Gateway is shared: tenants attach their own routes to it.
		expect(find(resources, "Gateway", "converged")).toBeDefined();
		expect(find(resources, "ConfigMap", "converged-domains")).toBeDefined();
	});

	test("fujin publishes its websocket on :80 and keeps the zmq peer port", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const svc = find(resources, "Service", "converged-fujin");
		expect((svc?.spec as { ports: unknown[] }).ports).toEqual([
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
				template: { spec: { containers: { env?: { name: string; value: string }[] }[] } };
			};
			return Object.fromEntries(
				(spec.template.spec.containers[0].env ?? []).map((e) => [e.name, e.value]),
			);
		};
		expect(envOf("converged-centimanus").CENTIMANUS_FUJIN_ZMQ_ENDPOINT).toBe(
			"tcp://converged-fujin:5557",
		);
		expect(envOf("converged-fujin")).toEqual({});
	});
});

describe("solutions", () => {
	test("merge into the module map and stamp a rollout digest", () => {
		const solutions = [
			solution("cnc", { microservices: ["geo"], microfrontends: ["geo"] }),
			solution("sales", { microservices: ["sales", "geo"], microfrontends: ["sales"] }),
		];
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono"), solutions }),
		);
		const modules = find(resources, "ConfigMap", "converged-modules");
		const data = dataOf(modules);

		expect(data.SOLUTIONS).toBe("cnc,sales");
		expect(JSON.parse(data.MICROSERVICES)).toEqual(["geo", "sales"]);
		expect(JSON.parse(data.FRONTEND_MODULES)).toEqual(["geo", "sales"]);

		const stamp = annotationsOf(find(resources, "Deployment", "converged-ui"))[ANNOTATION_MODULES];
		expect(stamp).toMatch(/^[0-9a-f]{8}$/);
	});

	test("the digest changes when the module set changes and only then", () => {
		const digestFor = (solutions: KubeObject[]) => {
			const { resources } = reconcile(
				input({ kind: "Platform", object: platform("mono"), solutions }),
			);
			return annotationsOf(find(resources, "Deployment", "converged-services"))[ANNOTATION_MODULES];
		};

		const base = digestFor([solution("cnc")]);
		expect(digestFor([solution("cnc")])).toBe(base);
		expect(digestFor([solution("cnc"), solution("extra", { microservices: ["billing"] })])).not.toBe(base);
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
			input({ kind: "Tenant", object: tenant("democnc"), platform: platform("cloud") }),
		);
		expect(resources.map((r) => `${r.kind}/${r.metadata.name}`).sort()).toEqual([
			"HTTPRoute/converged-tenant-democnc",
			"Service/converged-storage-democnc",
			"StatefulSet/converged-storage-democnc",
		]);
		expect(status.ready).toBe(true);
		expect(status.domains).toEqual(["democnc.4ir.club"]);
	});

	test("the scope header is forced on every rule, so a client cannot spoof it", () => {
		const { resources } = reconcile(
			input({ kind: "Tenant", object: tenant("democnc"), platform: platform("cloud") }),
		);
		const route = find(resources, "HTTPRoute", "converged-tenant-democnc");
		const rules = (route?.spec as { rules: RouteRuleShape[] }).rules;
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
			input({ kind: "Tenant", object: tenant("democnc"), platform: platform("cloud") }),
		);
		const route = find(resources, "HTTPRoute", "converged-tenant-democnc");
		const spec = route?.spec as { parentRefs: { name: string; namespace: string }[]; hostnames: string[] };
		expect(spec.parentRefs).toEqual([{ name: "converged", namespace: "converged" }]);
		expect(spec.hostnames).toEqual(["democnc.4ir.club"]);
	});

	test("extra domains are added alongside the automatic one, without duplicates", () => {
		const { status } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc", { domains: ["Shop.example.com", "democnc.4ir.club"] }),
				platform: platform("cloud"),
			}),
		);
		expect(status.domains).toEqual(["democnc.4ir.club", "shop.example.com"]);
	});

	test("a missing platform requeues instead of pruning the tenant's objects", () => {
		const output = reconcile(input({ kind: "Tenant", object: tenant("democnc") }));
		expect(output.resources).toEqual([]);
		expect(output.status.ready).toBe(false);
		expect(output.requeueAfter).toBeGreaterThan(0);
	});

	test("a tenant on a mono platform is a configuration error", () => {
		expect(() =>
			reconcile(input({ kind: "Tenant", object: tenant("democnc"), platform: platform("mono") })),
		).toThrow(/require cloud/);
	});

	test("tenants narrow the platform's solutions to their own subscription", () => {
		const solutions = [solution("cnc"), solution("sales", { microservices: ["sales"] })];
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
			democnc: "converged-storage-democnc.converged.svc.cluster.local:9000",
			other: "converged-storage-other.converged.svc.cluster.local:9000",
		});
	});
});

describe("ownership", () => {
	test("every emitted object carries the prune selector", () => {
		const all = [
			...reconcile(input({ kind: "Platform", object: platform("mono") })).resources,
			...reconcile(input({ kind: "Tenant", object: tenant("t1"), platform: platform("cloud") })).resources,
		];
		for (const resource of all) {
			expect(resource.metadata.labels?.["app.kubernetes.io/managed-by"]).toBe("ptah");
			expect(resource.metadata.labels?.["ptah.io/owner"]).toMatch(/^(platform|tenant)\./);
		}
	});
});

describe("storage", () => {
	test("claim templates carry an explicit storage class, never the cluster default", () => {
		const { resources } = reconcile(
			input({ kind: "Platform", object: platform("mono") }),
		);
		const sts = find(resources, "StatefulSet", "converged-storage");
		const claims = (sts?.spec as { volumeClaimTemplates: KubeObject[] }).volumeClaimTemplates;
		expect(claims[0].spec).toEqual({
			accessModes: ["ReadWriteOnce"],
			storageClassName: "local-path",
			resources: { requests: { storage: "5Gi" } },
		});
	});

	test("a tenant's size overrides the platform default on its own shard", () => {
		const { resources } = reconcile(
			input({
				kind: "Tenant",
				object: tenant("democnc", { storageSize: "50Gi" }),
				platform: platform("cloud"),
			}),
		);
		const sts = find(resources, "StatefulSet", "converged-storage-democnc");
		const claims = (sts?.spec as { volumeClaimTemplates: KubeObject[] }).volumeClaimTemplates;
		expect((claims[0].spec as { resources: unknown }).resources).toEqual({
			requests: { storage: "50Gi" },
		});
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
		expect(find(resources, "PersistentVolumeClaim", "shared-cache")).toBeDefined();
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
			scratch: { size: "1Gi", storageClassName: "local-path", reclaim: "delete" },
			keepme: { size: "1Gi", storageClassName: "local-path" },
		};
		const resources = reconcile(input({ kind: "Platform", object })).resources;
		expect(find(resources, "PersistentVolumeClaim", "scratch")?.metadata.annotations)
			.toEqual({ "ptah.io/reclaim": "delete" });
		expect(find(resources, "PersistentVolumeClaim", "keepme")?.metadata.annotations)
			.toEqual({ "ptah.io/reclaim": "retain" });
	});

	test("a solution's extras are owned by the platform that hosts it", () => {
		const object = platform("mono");
		const sol = solution("cnc");
		(sol.spec as Record<string, unknown>).configMaps = { "cnc-settings": { A: "1" } };
		const { resources } = reconcile(
			input({ kind: "Platform", object, solutions: [sol] }),
		);
		const cm = find(resources, "ConfigMap", "cnc-settings");
		// Owned by the platform: a Solution holds no objects of its own, so
		// prune has to follow the platform's desired set.
		expect(cm?.metadata.labels?.["ptah.io/owner"]).toBe("platform.converged");
	});
});
