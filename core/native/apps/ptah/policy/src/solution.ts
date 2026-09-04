/**
 * A solution is an overlay: a named set of repositories, lambdas, surfaces and
 * workflows layered on top of a base platform. The base cores boot on their
 * own; solutions only widen what those cores expose.
 *
 * In the current image layout every backend module already ships inside the one
 * `ms` image and every surface inside the one `ui` image, so activating
 * a solution is a module-map change plus a rollout — not new pods. The merged
 * map is published as a ConfigMap and its digest is stamped on the workload
 * pod template, which is what actually triggers the rollout.
 */

import { digest } from "./names.ts";
import type {
	KubeObject,
	RegistrySpec,
	SolutionSpec,
	WorkflowRef,
} from "./types.ts";
import { PolicyError } from "./types.ts";

export interface MergedSolutions {
	names: string[];
	repositories: string[];
	lambdas: string[];
	surfaces: string[];
	/** Compute peers to deploy; unlike modules, these are their own pods. */
	processors: string[];
	workflows: WorkflowRef[];
	env: Record<string, string>;
	/** Stable digest of everything above; changes force a rollout. */
	digest: string;
}

function specOf(solution: KubeObject): SolutionSpec {
	return (solution.spec ?? {}) as SolutionSpec;
}

/**
 * Select the solutions that apply to `platform`. `only` narrows the set to
 * named solutions (a tenant subscribing to a subset); an empty `only` means
 * every enabled solution of the platform.
 */
export function selectSolutions(
	solutions: KubeObject[],
	platform: string,
	only?: string[],
): KubeObject[] {
	const wanted = only && only.length > 0 ? new Set(only) : undefined;
	return solutions
		.filter((s) => specOf(s).platform === platform)
		.filter((s) => specOf(s).enabled !== false)
		.filter((s) => !wanted || wanted.has(s.metadata.name))
		.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
}

export function mergeSolutions(selected: KubeObject[]): MergedSolutions {
	const repositories = new Set<string>();
	const lambdas = new Set<string>();
	const surfaces = new Set<string>();
	const processors = new Set<string>();
	const workflows: WorkflowRef[] = [];
	const env: Record<string, string> = {};
	const names: string[] = [];

	for (const solution of selected) {
		const spec = specOf(solution);
		names.push(solution.metadata.name);
		for (const repository of spec.repositories ?? [])
			repositories.add(repository);
		for (const lambda of spec.lambdas ?? []) lambdas.add(lambda);
		for (const sf of spec.surfaces ?? []) surfaces.add(sf);
		for (const processor of spec.processors ?? []) processors.add(processor);
		for (const wf of spec.workflows ?? []) workflows.push(wf);
		// Later solutions win on env collisions; the sort above makes that
		// deterministic rather than dependent on apiserver list order.
		Object.assign(env, spec.env ?? {});
	}

	const merged = {
		names,
		repositories: [...repositories].sort(),
		lambdas: [...lambdas].sort(),
		surfaces: [...surfaces].sort(),
		processors: [...processors].sort(),
		workflows: workflows.sort((a, b) => a.name.localeCompare(b.name)),
		env,
	};

	return { ...merged, digest: digest(JSON.stringify(merged)) };
}

/**
 * The ConfigMap payload consumed by the ui and backend cores at boot.
 *
 * `registry` is folded in here rather than left to each container's own env:
 * the module list and the place those modules are fetched from have to change
 * together, and one ConfigMap means one digest and therefore one rollout.
 */
export function moduleData(
	merged: MergedSolutions,
	registry?: RegistrySpec,
	controllerNamespace?: string,
): Record<string, string> {
	return {
		SOLUTIONS: merged.names.join(","),
		REPOSITORIES: JSON.stringify(merged.repositories),
		LAMBDAS: JSON.stringify(merged.lambdas),
		FRONTEND_MODULES: JSON.stringify(merged.surfaces),
		PROCESSORS: JSON.stringify(merged.processors),
		WORKFLOWS: JSON.stringify(merged.workflows),
		...registryData(registry, controllerNamespace),
	};
}

/**
 * Where a pod fetches modules from.
 *
 * The proxy is a Service in the controller's namespace; the pods that read it
 * run in the platform's. A bare `ptah-proxy` resolves only in the caller's own
 * namespace, so it worked exactly while the operator was installed beside the
 * platform it served — qualifying it is what lets one controller in kube-system
 * feed every workspace. The bare form remains the fallback for a runtime that
 * does not report its namespace, which is the behaviour this replaces.
 */
function moduleProxyUrl(controllerNamespace?: string): string {
	return controllerNamespace
		? `http://ptah-proxy.${controllerNamespace}.svc.cluster.local`
		: "http://ptah-proxy";
}

/**
 * Where a container fetches modules from, and where it keeps them once it has.
 * Absent registry means everything ships inside the image, which is what a
 * local build does.
 */
export function registryData(
	registry?: RegistrySpec,
	controllerNamespace?: string,
): Record<string, string> {
	if (!registry) return {};
	return {
		MODULE_PROXY: moduleProxyUrl(controllerNamespace),
		MODULE_DIGESTS: JSON.stringify(registry.modules ?? {}),
		WORKFLOW_DIGESTS: JSON.stringify(registry.workflows ?? {}),
		MODULE_REGISTRY_REVISION: registry.revision ?? "",
	};
}

/**
 * The env `registryData` owns, and which nothing else may write.
 *
 * A Platform names its registry. It does not get to say where a pod fetches
 * from: that address belongs to the proxy, and it is the only address a pod is
 * allowed to know. `spec.registry.url` is the registry itself — ptah's to read,
 * because ptah is what holds the cache and, when the registry is not public,
 * the credentials for it. Handing that same URL to a workload turns every pod
 * into a registry client: it fetches over the internet instead of over the
 * cluster network, it caches nothing another pod can reuse, and it can only
 * work at all while the bucket is anonymously readable.
 */
export const REGISTRY_ENV_KEYS = [
	"MODULE_PROXY",
	"MODULE_DIGESTS",
	"WORKFLOW_DIGESTS",
	"MODULE_REGISTRY_REVISION",
] as const;

/**
 * Refuse an env block that writes the registry contract.
 *
 * Loud rather than ignored: silently dropping the key leaves a Platform whose
 * spec says one address and whose pods use another, which is the state this
 * exists to make impossible. The reconciler turns the error into a status
 * condition naming the field, so the fix is to delete it from the CR.
 */
export function assertNoRegistryEnv(
	env: Record<string, string> | undefined,
	field: string,
): void {
	if (!env) return;
	const claimed = REGISTRY_ENV_KEYS.filter((key) => key in env);
	if (claimed.length === 0) return;
	throw new PolicyError(
		`${field} may not set ${claimed.join(", ")}: ptah owns where a pod ` +
			`fetches modules from, and the only address a pod may hold is ` +
			`ptah-proxy. Point spec.registry.url at the registry instead.`,
	);
}
