/** cert-manager Certificate. The Gateway references the Secret it fills. */

import type { KubeObject } from "../types.ts";

export const CERTMANAGER_API = "cert-manager.io/v1";

export function certificate(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	secretName: string,
	issuer: string,
	issuerKind: string,
	dnsNames: string[],
): KubeObject {
	return {
		apiVersion: CERTMANAGER_API,
		kind: "Certificate",
		metadata: { name, namespace, labels },
		spec: {
			secretName,
			issuerRef: { name: issuer, kind: issuerKind },
			dnsNames,
		},
	};
}
