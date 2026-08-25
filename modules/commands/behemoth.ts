import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import {
	createStorageServiceClient,
	type StorageServiceClient,
} from "g-behemoth/browser";

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
	// The production storage process may still be on the previous stat schema.
	// Keep this CLI usable until its response includes the runtime memory block.
	const runtimeMemory = stats?.memory;
	const cgroup = runtimeMemory?.cgroup;
	const process = runtimeMemory?.process;

	if (cgroup) {
		const limit =
			cgroup.limitBytes === null ? "unlimited" : formatBytes(cgroup.limitBytes);
		lines.push(
			`container cgroup - ${formatBytes(cgroup.currentBytes)} / ${limit}`,
		);
		lines.push(
			`  working set (kubectl top basis) - ${formatBytes(cgroup.workingSetBytes)}`,
		);
		lines.push(`  anonymous - ${formatBytes(cgroup.anonBytes)}`);
		lines.push(`  file cache - ${formatBytes(cgroup.fileBytes)}`);
		lines.push(`  kernel - ${formatBytes(cgroup.kernelBytes)}`);
		lines.push(`    slab - ${formatBytes(cgroup.slabBytes)}`);
		lines.push(`    page tables - ${formatBytes(cgroup.pageTablesBytes)}`);
		lines.push(`    sockets - ${formatBytes(cgroup.socketBytes)}`);
		lines.push(
			`    inactive file cache - ${formatBytes(cgroup.inactiveFileBytes)}`,
		);
	}

	if (process) {
		if (lines.length > 0) lines.push("");
		lines.push(`process RSS - ${formatBytes(process.rssBytes)}`);
		lines.push(`  PSS - ${formatBytes(process.pssBytes)}`);
		lines.push(`    anonymous - ${formatBytes(process.pssAnonBytes)}`);
		lines.push(`    file-backed - ${formatBytes(process.pssFileBytes)}`);
		lines.push(`    shared memory - ${formatBytes(process.pssShmemBytes)}`);
		lines.push(`  private mappings - ${formatBytes(process.privateBytes)}`);
		lines.push(`  shared mappings - ${formatBytes(process.sharedBytes)}`);
		lines.push(
			`  engine counters - ${formatBytes(runtimeMemory.engineAttributedBytes)}`,
		);
		lines.push(
			`  not explained by engine counters - ${formatBytes(process.unattributedRssBytes)}`,
		);
		// RSS legitimately exceeds the cgroup figure and the two are not
		// comparable. memory.current only counts pages charged to this cgroup,
		// and a file-backed page is charged to whichever cgroup first faulted it
		// in — the image layer holding the binary, or a PV whose pages an earlier
		// pod brought into the page cache. Those stay resident in this process's
		// page tables, so they land in RSS while being charged elsewhere. Read
		// `anonymous` above for the heap; file-backed pages are reclaimable.
		if (cgroup && process.rssBytes > cgroup.currentBytes) {
			lines.push(
				"  (RSS is above the cgroup total: file-backed pages charged to another cgroup)",
			);
		}
	}

	if (runtimeMemory) {
		if (lines.length > 0) lines.push("");
		lines.push("storage engine counters (subset of process memory)");
	}

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
					description: "Show container, process, and storage-engine memory",
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
