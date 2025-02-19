import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

export class CacheStore {
	db: Low<{
		meta: Record<string, { type: string; compressed: boolean }>;
		compileMapping: Record<string, string>;
		packMapping: Record<string, string>;
		importconfMapping: Record<string, string>;
	}>;
	constructor(filePath) {
		const defaultData = {
			importconfMapping: {},
			compileMapping: {},
			packMapping: {},
			meta: {},
		};

		this.db = new Low(new JSONFile(filePath), defaultData);
	}

	async setMeta(hash, type: string, compressed: boolean) {
		this.db.data.meta[hash] = { type, compressed };
		await this.db.write();
	}

	async getMeta(hash): Promise<{ type: string; compressed: boolean }> {
		return await this.db.data.meta[hash];
	}

	async init() {
		await this.db.read();
	}

	async getHashDir(hashKey) {
		await this.init();
		return this.db.data.compileMapping[hashKey];
	}

	async setHashDir(packName, importConfHash, hashKey, hashValue) {
		await this.init();
		this.db.data.compileMapping[hashKey] = hashValue;
		this.db.data.packMapping[packName] = hashValue;
		this.db.data.importconfMapping[hashValue] = importConfHash;
		await this.db.write();
	}
}

export default CacheStore;
