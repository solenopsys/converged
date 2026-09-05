import { createHash } from "node:crypto";
import {
	BaseService,
	badRequestError,
	createJsonFilterAdapter,
	notFoundError,
} from "back-core";
import type {
	PaginationParams,
	ScriptFile,
	ScriptHashMap,
	ScriptHashResult,
	ScriptListItem,
	ScriptListResult,
	ScriptsService,
} from "g-scripts";
import { StoresController } from "./stores";

const scriptFilters = createJsonFilterAdapter<ScriptListItem>({
	path: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
});

function ensurePath(path: string): string {
	const normalized = path.trim().replace(/^\/+/, "");
	if (!normalized) {
		throw badRequestError("path is empty");
	}
	return normalized;
}

function hashContent(content: string | Uint8Array): string {
	return createHash("sha256").update(content).digest("hex");
}

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

export class ScriptsServiceImpl
	extends BaseService<StoresController>
	implements ScriptsService
{
	constructor() {
		super("rp-scripts");
	}

	private async readFile(path: string): Promise<Uint8Array | undefined> {
		return this.stores.fileStore.read(path);
	}

	protected createStores(repositoryId: string): StoresController {
		return new StoresController(repositoryId);
	}

	private async calculateHash(filePath: string): Promise<string | undefined> {
		const path = ensurePath(filePath);
		const data = await this.readFile(path);
		if (!data) {
			return undefined;
		}
		return hashContent(data);
	}

	async saveScript(file: ScriptFile): Promise<string> {
		await this.ready();
		const path = ensurePath(file.path);
		const data = new TextEncoder().encode(file.content);
		await this.stores.fileStore.put(path, data);
		return path;
	}

	async readScript(filePath: string): Promise<ScriptFile> {
		await this.ready();
		const path = ensurePath(filePath);
		const data = await this.readFile(path);
		if (!data) {
			throw notFoundError(`Script not found: ${path}`, { path });
		}
		return {
			path,
			content: decode(data),
		};
	}

	async deleteScript(filePath: string): Promise<void> {
		await this.ready();
		const path = ensurePath(filePath);
		await this.stores.fileStore.delete(path);
	}

	async listScripts(params: PaginationParams): Promise<ScriptListResult> {
		await this.ready();
		const keys = (await this.stores.fileStore.listKeys()).sort();
		const items: ScriptListItem[] = [];

		for (const path of keys) {
			const hash = await this.calculateHash(path);
			items.push({ path, hash: hash ?? "" });
		}

		const filtered = items.filter(scriptFilters.predicate(params.filter));
		const start = params.offset;
		const end = params.offset + params.limit;

		return {
			items: filtered.slice(start, end),
			totalCount: filtered.length,
		};
	}

	async getHash(filePath: string): Promise<ScriptHashResult> {
		await this.ready();
		return {
			hash: await this.calculateHash(filePath),
		};
	}

	async getHashMap(): Promise<ScriptHashMap> {
		await this.ready();
		const keys = (await this.stores.fileStore.listKeys()).sort();
		const result: ScriptHashMap = {};

		for (const path of keys) {
			const hash = await this.calculateHash(path);
			if (hash) {
				result[path] = hash;
			}
		}

		return result;
	}
}
