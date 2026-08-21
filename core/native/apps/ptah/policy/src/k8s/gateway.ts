/**
 * Routing via Gateway API.
 *
 * One Gateway per platform holds the listeners and the certificate; every
 * tenant attaches its own HTTPRoute to it. Adding a site is therefore a route
 * change and never touches the load balancer.
 *
 * Two things Gateway API gives us that the Traefik CRDs did not: route
 * precedence is defined by the spec (most specific path wins), so there are no
 * hand-tuned priorities; and header rewriting is a filter on the rule instead
 * of a separate Middleware object to keep in sync.
 */

import type { KubeObject } from "../types.ts";

export const GATEWAY_API = "gateway.networking.k8s.io/v1";

export interface Listener {
	name: string;
	hostname: string;
	/** TLS certificate Secret; omitted for a plain HTTP listener. */
	certificateRef?: string;
}

export function gateway(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	gatewayClassName: string,
	listeners: Listener[],
): KubeObject {
	return {
		apiVersion: GATEWAY_API,
		kind: "Gateway",
		metadata: { name, namespace, labels },
		spec: {
			gatewayClassName,
			listeners: listeners.map((listener) => ({
				name: listener.name,
				hostname: listener.hostname,
				port: listener.certificateRef ? 443 : 80,
				protocol: listener.certificateRef ? "HTTPS" : "HTTP",
				...(listener.certificateRef
					? {
							tls: {
								mode: "Terminate",
								certificateRefs: [
									{ kind: "Secret", name: listener.certificateRef },
								],
							},
						}
					: {}),
				// Routes are created by ptah in the platform namespace; there
				// is no reason to accept them from anywhere else.
				allowedRoutes: { namespaces: { from: "Same" } },
			})),
		},
	};
}

export interface RouteRule {
	pathPrefix: string;
	service: string;
	port: number;
	/**
	 * Headers forced onto the request. This is `set`, not `add`: it overwrites
	 * whatever the client sent, which is what makes a scope header
	 * untamperable from outside the cluster.
	 */
	setHeaders?: Record<string, string>;
}

export function httpRoute(
	name: string,
	namespace: string,
	labels: Record<string, string>,
	parentGateway: string,
	hostnames: string[],
	rules: RouteRule[],
): KubeObject {
	return {
		apiVersion: GATEWAY_API,
		kind: "HTTPRoute",
		metadata: { name, namespace, labels },
		spec: {
			parentRefs: [{ name: parentGateway, namespace }],
			hostnames,
			rules: rules.map((rule) => ({
				matches: [{ path: { type: "PathPrefix", value: rule.pathPrefix } }],
				...(rule.setHeaders
					? {
							filters: [
								{
									type: "RequestHeaderModifier",
									requestHeaderModifier: {
										set: Object.entries(rule.setHeaders).map(
											([header, value]) => ({
												name: header,
												value,
											}),
										),
									},
								},
							],
						}
					: {}),
				backendRefs: [{ name: rule.service, port: rule.port }],
			})),
		},
	};
}
