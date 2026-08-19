/**
 * Policy entry point. The Zig runtime evaluates this bundle and then calls
 * `__ptah_reconcile(<json>)`, which must return a JSON string. Nothing here
 * touches the outside world: no fetch, no timers, no `kube.*` host calls.
 *
 * The bundle is re-evaluated on every reconcile inside a fresh QuickJS
 * runtime with a 100 ms budget, so keep top-level work to declarations only.
 */

import { reconcilePlatform } from "./platform.ts";
import { selectSolutions } from "./solution.ts";
import { PolicyError } from "./types.ts";
import type { ReconcileInput, ReconcileOutput, SolutionSpec } from "./types.ts";
import { domainIndex, reconcileTenant } from "./tenant.ts";

/**
 * A Solution owns no cluster objects of its own — it is an overlay that the
 * Platform pass folds into the module map. Reconciling one only validates it
 * and reports where it landed.
 */
function reconcileSolution(input: ReconcileInput): ReconcileOutput {
	const spec = (input.object.spec ?? {}) as SolutionSpec;
	if (!spec.platform) {
		throw new PolicyError("solution requires spec.platform");
	}
	const applied =
		input.platform !== undefined &&
		selectSolutions([input.object], spec.platform).length > 0;

	return {
		resources: [],
		status: {
			platform: spec.platform,
			enabled: spec.enabled !== false,
			applied,
			reason: input.platform ? "" : `platform ${spec.platform} not found`,
			microservices: spec.microservices?.length ?? 0,
			microfrontends: spec.microfrontends?.length ?? 0,
			workflows: spec.workflows?.length ?? 0,
			observedGeneration: input.object.metadata.generation ?? 0,
		},
		requeueAfter: input.platform ? 0 : 15_000,
	};
}

export function reconcile(input: ReconcileInput): ReconcileOutput {
	switch (input.kind) {
		case "Platform": {
			const output = reconcilePlatform(input);
			const spec = input.object.spec as { profile?: string };
			if (spec.profile === "cloud") {
				output.resources.push(domainIndex(input.object, input.tenants));
			}
			return output;
		}
		case "Solution":
			return reconcileSolution(input);
		case "Tenant":
			return reconcileTenant(input);
		default:
			throw new PolicyError(`unknown kind: ${input.kind}`);
	}
}

/**
 * Native bridge. Errors are returned as data rather than thrown, so the
 * controller can put them in a status condition instead of treating a policy
 * bug as a runtime crash. An error response carries no resources, which the
 * controller reads as "make no changes" rather than "prune everything".
 */
function bridge(payload: string): string {
	try {
		const input = JSON.parse(payload) as ReconcileInput;
		const output = reconcile(input);
		return JSON.stringify({ ok: true, ...output });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({ ok: false, error: message });
	}
}

(globalThis as Record<string, unknown>).__ptah_reconcile = bridge;
