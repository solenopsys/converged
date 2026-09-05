import { notFoundError } from "back-core";
import type {
	PaginatedResult,
	PaginationParams,
	StructService,
} from "g-struct";
import { Access } from "nrpc";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-struct";

export class StructServiceImpl implements StructService {
	stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	private async readFile(path: string): Promise<Uint8Array | undefined> {
		return this.stores.fileStore.read(path);
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	async saveJson(path: string, data: any): Promise<string> {
		const json = JSON.stringify(data);
		const bytes = new TextEncoder().encode(json);
		await this.stores.fileStore.put(path, bytes);
		return path;
	}

	@Access("public")
	async readJson(path: string): Promise<any> {
		console.log("[rp-struct] readJson:request", { path });
		const data = await this.readFile(path);
		if (!data) {
			const allKeys = await this.stores.fileStore.listKeys();
			console.log("[rp-struct] readJson:not-found", {
				path,
				keysCount: allKeys.length,
				sample: allKeys.slice(0, 30),
				hasExact: allKeys.includes(path),
				hasDataPrefixed: allKeys.includes(`data/${path}`),
			});
			throw notFoundError(`File not found: ${path}`, { path });
		}
		console.log("[rp-struct] readJson:found", { path, bytes: data.byteLength });
		const json = new TextDecoder().decode(data);
		return JSON.parse(json);
	}

	@Access("public")
	async readJsonBatch(paths: string[]): Promise<any[]> {
		return Promise.all(paths.map((p) => this.readJson(p)));
	}

	async deleteJson(path: string): Promise<void> {
		await this.stores.fileStore.delete(path);
	}

	async listJson(params: PaginationParams): Promise<PaginatedResult<string>> {
		const allKeys = await this.stores.fileStore.listKeys();
		const pathFilter = params.filter?.path;
		const jsonKeys = allKeys.filter((path) => {
			if (!path.endsWith(".json")) return false;
			if (!pathFilter || typeof pathFilter !== "object") return true;
			const filter = pathFilter as Record<string, unknown>;
			if (typeof filter.eq === "string" && path !== filter.eq) return false;
			if (
				Array.isArray(filter.in) &&
				!filter.in.some((value) => typeof value === "string" && value === path)
			)
				return false;
			if (
				typeof filter.contains === "string" &&
				!path.includes(filter.contains)
			)
				return false;
			if (
				typeof filter.startsWith === "string" &&
				!path.startsWith(filter.startsWith)
			)
				return false;
			return true;
		});

		const start = params.offset;
		const end = params.offset + params.limit;

		return {
			items: jsonKeys.slice(start, end),
			totalCount: jsonKeys.length,
		};
	}
}
