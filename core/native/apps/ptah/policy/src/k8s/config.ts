/** ConfigMaps and Secrets. */

import type { KubeObject } from "../types.ts";

export function configMap(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	data: Record<string, string>,
	binaryData?: Record<string, string>,
): KubeObject {
	return {
		apiVersion: "v1",
		kind: "ConfigMap",
		metadata: { name, namespace, labels },
		data,
		...(binaryData ? { binaryData } : {}),
	};
}

/**
 * A Secret written from policy.
 *
 * `stringData` values travel through the reconcile input, which means they sit
 * in the custom resource in plaintext and are readable by anyone with `get` on
 * it. That is the right shape for values that are secret from the cluster's
 * users but not from its administrators — a generated token, a derived
 * password. Real credentials belong in a Secret created out of band, which the
 * policy then only references by name.
 */
export function secret(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	stringData: Record<string, string>,
	type = "Opaque",
): KubeObject {
	return {
		apiVersion: "v1",
		kind: "Secret",
		metadata: { name, namespace, labels },
		type,
		stringData,
	};
}
