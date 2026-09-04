import { notFoundError } from "back-core";
import { mdToJson } from "cruller-md4c";
import type {
	MarkdownService,
	MdFile,
	PaginatedResult,
	PaginationParams,
} from "g-markdown";
import { Access } from "nrpc";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-markdown";

export class MarkdownServiceImpl implements MarkdownService {
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

	async saveMd(mdFile: MdFile): Promise<string> {
		const data = new TextEncoder().encode(mdFile.content);
		await this.stores.fileStore.put(mdFile.path, data);
		return mdFile.path;
	}

	// Raw markdown is consumed by server-side landing SSR. Keep it off the
	// browser API while allowing the UI process's narrowly scoped service JWT.
	@Access("internal")
	async readMd(filePath: string): Promise<MdFile> {
		const data = await this.readFile(filePath);
		if (!data) {
			throw notFoundError(`File not found: ${filePath}`, { path: filePath });
		}
		const content = new TextDecoder().decode(data);
		return {
			path: filePath,
			content,
		};
	}

	async readMdJson(filePath: string): Promise<any> {
		const mdFile = await this.readMd(filePath);
		const ast = mdToJson(mdFile.content);
		return {
			path: mdFile.path,
			content: ast,
		};
	}

	async readMdJsonBatch(paths: string[]): Promise<any[]> {
		const results = await Promise.allSettled(
			paths.map((p) => this.readMdJson(p)),
		);
		return results.map((r) => (r.status === "fulfilled" ? r.value : null));
	}

	async listOfMd(params: PaginationParams): Promise<PaginatedResult<MdFile>> {
		const allKeys = await this.stores.fileStore.listKeys();
		const mdKeys = allKeys.filter((k) => k.endsWith(".md"));

		const start = params.offset;
		const end = params.offset + params.limit;
		// List endpoint must be lightweight: return only paths, not file bodies.
		const items: MdFile[] = mdKeys
			.slice(start, end)
			.map((path) => ({ path, content: "" }));

		return {
			items,
			totalCount: mdKeys.length,
		};
	}
}
