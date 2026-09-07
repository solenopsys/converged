import type { ResolvedSolution } from "../dev/src/solution";

export type SolutionManifestOptions = {
	platform: string;
	name?: string;
};

/**
 * Convert the source-level solution selection into the CRD Ptah reconciles.
 * `mappings` are a local resolver detail; workflows are the cluster contract.
 */
export function solutionManifest(
	solution: ResolvedSolution,
	options: SolutionManifestOptions,
) {
	const name = options.name || `${options.platform}-${solution.metadata.name}`;
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Solution",
		metadata: { name },
		spec: {
			platform: options.platform,
			repositories: solution.spec.repositories,
			lambdas: solution.spec.lambdas,
			surfaces: solution.spec.surfaces,
			processors: solution.spec.processors,
			workflows: solution.spec.workflows,
		},
	};
}
