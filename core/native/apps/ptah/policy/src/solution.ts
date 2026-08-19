/**
 * A solution is an overlay: a named set of microservices, microfrontends and
 * workflows layered on top of a base platform. The base cores boot on their
 * own; solutions only widen what those cores expose.
 *
 * In the current image layout every microservice already ships inside the one
 * `ms` image and every microfrontend inside the one `ui` image, so activating
 * a solution is a module-map change plus a rollout — not new pods. The merged
 * map is published as a ConfigMap and its digest is stamped on the workload
 * pod template, which is what actually triggers the rollout.
 */

import { digest } from "./names.ts";
import type { KubeObject, SolutionSpec, WorkflowRef } from "./types.ts";

export interface MergedSolutions {
	names: string[];
	microservices: string[];
	microfrontends: string[];
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
	const microservices = new Set<string>();
	const microfrontends = new Set<string>();
	const workflows: WorkflowRef[] = [];
	const env: Record<string, string> = {};
	const names: string[] = [];

	for (const solution of selected) {
		const spec = specOf(solution);
		names.push(solution.metadata.name);
		for (const ms of spec.microservices ?? []) microservices.add(ms);
		for (const mf of spec.microfrontends ?? []) microfrontends.add(mf);
		for (const wf of spec.workflows ?? []) workflows.push(wf);
		// Later solutions win on env collisions; the sort above makes that
		// deterministic rather than dependent on apiserver list order.
		Object.assign(env, spec.env ?? {});
	}

	const merged = {
		names,
		microservices: [...microservices].sort(),
		microfrontends: [...microfrontends].sort(),
		workflows: workflows.sort((a, b) => a.name.localeCompare(b.name)),
		env,
	};

	return { ...merged, digest: digest(JSON.stringify(merged)) };
}

/** The ConfigMap payload consumed by the ui and ms cores at boot. */
export function moduleData(merged: MergedSolutions): Record<string, string> {
	return {
		SOLUTIONS: merged.names.join(","),
		MICROSERVICES: JSON.stringify(merged.microservices),
		FRONTEND_MODULES: JSON.stringify(merged.microfrontends),
		WORKFLOWS: JSON.stringify(merged.workflows),
	};
}
