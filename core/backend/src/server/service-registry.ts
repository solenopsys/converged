import { createMessagingBackend, type ServiceMetadata } from "nrpc/cluster";
import type { PluginConfig } from "./createServer";

export type ServiceBinding = {
	name: string;
	metadata: ServiceMetadata;
	implementation: unknown;
};

export function registerMicroservices(
	services: ServiceBinding[],
	config: PluginConfig,
): void {
	if (!config.messagingRuntime) {
		throw new Error("FUJIN_ZMQ_ENDPOINT is required for microservice registration");
	}

	for (const service of services) {
		createMessagingBackend({
			runtime: config.messagingRuntime,
			metadata: service.metadata,
			serviceImpl: service.implementation,
			serviceOptions: serviceOptions(service.name, config),
			registerStartupTask: config.registerStartupTask,
			registerShutdownTask: config.registerShutdownTask,
		});
	}
}

function serviceOptions(name: string, config: PluginConfig): Record<string, unknown> {
	const envName = `${name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_MS_CONF`;
	const raw = process.env[envName];
	if (!raw) return config;
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("must be a JSON object");
		}
		return { ...config, ...parsed };
	} catch (error) {
		throw new Error(`Invalid ${envName}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
