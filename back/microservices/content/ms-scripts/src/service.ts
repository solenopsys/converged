import { createHash } from "node:crypto";
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

const MS_ID = "scripts-ms";

function ensurePath(path: string): string {
	const normalized = path.trim().replace(/^\/+/, "");
	if (!normalized) {
		const error: any = new Error("path is empty");
		error.statusCode = 400;
		throw error;
	}
	return normalized;
}

function hashContent(content: string | Uint8Array): string {
	return createHash("sha256").update(content).digest("hex");
}

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

export class ScriptsServiceImpl implements ScriptsService {
	stores!: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private async ensureInit(): Promise<void> {
		await this.init();
	}

	private async calculateHash(filePath: string): Promise<string | undefined> {
		const path = ensurePath(filePath);
		const data = await this.stores.fileStore.get(path);
		if (!data) {
			return undefined;
		}
		return hashContent(data);
	}

	async saveScript(file: ScriptFile): Promise<string> {
		await this.ensureInit();
		const path = ensurePath(file.path);
		const data = new TextEncoder().encode(file.content);
		await this.stores.fileStore.put(path, data);
		return path;
	}

	async readScript(filePath: string): Promise<ScriptFile> {
		await this.ensureInit();
		const path = ensurePath(filePath);
		const data = await this.stores.fileStore.get(path);
		if (!data) {
			throw new Error(`Script not found: ${path}`);
		}
		return {
			path,
			content: decode(data),
		};
	}

	async deleteScript(filePath: string): Promise<void> {
		await this.ensureInit();
		const path = ensurePath(filePath);
		await this.stores.fileStore.delete(path);
	}

	async listScripts(params: PaginationParams): Promise<ScriptListResult> {
		await this.ensureInit();
		const keys = (await this.stores.fileStore.listKeys()).sort();
		const start = params.offset;
		const end = params.offset + params.limit;
		const items: ScriptListItem[] = [];

		for (const path of keys.slice(start, end)) {
			const hash = await this.calculateHash(path);
			items.push({ path, hash: hash ?? "" });
		}

		return {
			items,
			totalCount: keys.length,
		};
	}

	async getHash(filePath: string): Promise<ScriptHashResult> {
		await this.ensureInit();
		return {
			hash: await this.calculateHash(filePath),
		};
	}

	async getHashMap(): Promise<ScriptHashMap> {
		await this.ensureInit();
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
