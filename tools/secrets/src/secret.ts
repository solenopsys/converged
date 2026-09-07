/**
 * An env file, as one Kubernetes Secret.
 *
 * The whole file goes in. Picking out "the secret ones" would mean keeping a
 * list of key names in step with every module that reads one, and the failure
 * mode of that list falling behind is a pod that starts and then misbehaves —
 * far worse than shipping a non-secret value inside a Secret, which costs
 * nothing. The exclusions below are therefore not about sensitivity.
 */

/**
 * Values the deployment computes, which must not be frozen into a Secret.
 *
 * Each of these is derived from the cluster's own topology — where the gateway
 * sits, which tenants have storage, which domain maps to which workspace. The
 * operator writes them at rollout. A Secret carrying a stale copy would win
 * over the computed one and point the pod at last deploy's addresses, so the
 * env file's values are dropped here rather than being allowed to shadow.
 */
const DEPLOYMENT_MANAGED_KEYS = [
	"LLM_GATE_URL",
	"STORAGE_TENANT_SERVICES",
	"WORKSPACE_DOMAIN_MAP",
];

export function buildSecretData(
	env: Record<string, string>,
	extraExclusions: readonly string[] = [],
): Record<string, string> {
	const excluded = new Set([...DEPLOYMENT_MANAGED_KEYS, ...extraExclusions]);
	return Object.fromEntries(
		Object.entries(env)
			.filter(([key]) => !excluded.has(key))
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => [
				key,
				Buffer.from(value, "utf8").toString("base64"),
			]),
	);
}

export type SecretSpec = {
	name: string;
	namespace: string;
	data: Record<string, string>;
};

/**
 * Emitted by hand rather than through a YAML library: the document is six fixed
 * lines and a flat map of base64, which has no character a quoting rule could
 * apply to. A dependency here would only add a way for the output to drift.
 */
export function renderSecret({ name, namespace, data }: SecretSpec): string {
	return [
		"apiVersion: v1",
		"kind: Secret",
		"metadata:",
		`  name: ${name}`,
		`  namespace: ${namespace}`,
		"type: Opaque",
		"data:",
		...Object.entries(data).map(
			// An empty value base64s to an empty string, and a bare `KEY:` parses as
			// null — which the apiserver rejects, since Secret data is map[string].
			// The explicit `""` is what keeps a blank line in the env file working.
			([key, value]) => `  ${key}: ${value === "" ? '""' : value}`,
		),
		"",
	].join("\n");
}
