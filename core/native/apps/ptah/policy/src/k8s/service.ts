/** Cluster-internal addressing. Nothing here is ever exposed directly; the
 * Gateway is the only public entry point. */

import type { KubeObject } from "../types.ts";
import type { Port } from "./container.ts";

export function service(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	selector: Record<string, string>,
	ports: Port[],
	/** "None" makes it headless, for stable per-pod DNS. */
	clusterIP?: "None",
): KubeObject {
	return {
		apiVersion: "v1",
		kind: "Service",
		metadata: { name, namespace, labels },
		spec: {
			...(clusterIP ? { clusterIP } : { type: "ClusterIP" }),
			selector,
			ports: ports.map((p) => ({
				name: p.name,
				port: p.port,
				targetPort: p.targetPort ?? p.port,
				protocol: "TCP",
			})),
		},
	};
}
