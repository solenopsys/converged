import type { KubeObject } from "../src/types.ts";

export function platform(profile: "mono" | "cloud"): KubeObject {
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Platform",
		metadata: { name: "converged", generation: 3 },
		spec: {
			profile,
			namespace: "converged",
			domainBase: "4ir.club",
			secretName: "converged-secrets",
			images: { ui: "reg/ui:1", ms: "reg/ms:1" },
			cache: { image: "valkey:8.1-alpine", port: 6379 },
			storage: {
				image: "reg/behemoth:1",
				size: "5Gi",
				port: 9000,
				mountBase: "/app/data",
				storageClassName: "local-path",
				volumeSource: {
					hostPath: { path: "/var/lib/ptah/{{volume}}", type: "DirectoryOrCreate" },
				},
			},
			apps: {
				fujin: { image: "reg/fujin:1", ports: { ws: 8087, zmq: 5557 } },
				centimanus: {
					image: "reg/centimanus:1",
					fujinTarget: "centimanus",
					fujinEndpointEnv: "CENTIMANUS_FUJIN_ZMQ_ENDPOINT",
					ports: { http: 9000 },
				},
			},
			gateway: {
				className: "traefik",
				hosts: ["*.4ir.club"],
				tls: {
					secretName: "4ir-club-tls",
					issuer: "4ir-club-cluster-issuer",
					dnsNames: ["4ir.club", "*.4ir.club"],
				},
			},
		},
	};
}

export function solution(name: string, extra: Record<string, unknown> = {}): KubeObject {
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Solution",
		metadata: { name },
		spec: {
			platform: "converged",
			microservices: ["geo", "places"],
			microfrontends: ["geo"],
			workflows: [{ name: "wf-leads", script: "workflows/wf-leads.js", periodMs: 600000 }],
			...extra,
		},
	};
}

export function tenant(name: string, extra: Record<string, unknown> = {}): KubeObject {
	return {
		apiVersion: "ptah.io/v1alpha1",
		kind: "Tenant",
		metadata: { name },
		spec: { platform: "converged", ...extra },
	};
}

export function find(resources: KubeObject[], kind: string, name: string) {
	return resources.find((r) => r.kind === kind && r.metadata.name === name);
}
