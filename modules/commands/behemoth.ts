import {
	createStorageServiceClient,
	type StorageServiceClient,
} from "g-behemoth/browser";
import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";

function formatBytes(bytes: number): string {
	const units = ["b", "kb", "mb", "gb", "tb"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
	return `${Number(value.toFixed(digits))}${units[unit]}`;
}

const statHandler: Handler = async (client: StorageServiceClient) => {
	const stats = await client.stat();
	const lines: string[] = [];

	if (stats.valkey.memoryBytes > 0) {
		lines.push(`valkey - ${formatBytes(stats.valkey.memoryBytes)}`);
	}

	for (const [engineName, engine] of Object.entries(stats.engines)) {
		if (engine.memoryBytes === 0) continue;
		lines.push(`${engineName} - ${formatBytes(engine.memoryBytes)}`);
		for (const store of [...engine.stores]
			.filter((item) => item.memoryBytes > 0)
			.sort((left, right) => left.name.localeCompare(right.name))) {
			lines.push(`  ${store.name} - ${formatBytes(store.memoryBytes)}`);
		}
	}

	console.log(
		lines.length > 0
			? lines.join("\n")
			: "No storage memory is currently attributed.",
	);
};

class BehemothProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"stat",
				{
					handler: statHandler,
					description: "Show storage memory by engine and store",
				},
			],
		]);
	}
}

export default () =>
	new BehemothProcessor(
		createStorageServiceClient(
			createCliNrpcClientConfig({ target: "behemoth" }),
		),
	);
