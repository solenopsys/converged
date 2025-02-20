import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

export class CacheStore {
	db: Low<{
		meta: Record<string, { type: string; compressed: boolean }>;
		compileMapping: Record<string, string>;
		packMapping: Record<string, string>;
		importconfMapping: Record<string, string>;
	}>;
	constructor(filePath:string) {
		const defaultData = {
			importconfMapping: {},
			compileMapping: {},
			packMapping: {},
			meta: {},
		};

		this.db = new Low(new JSONFile(filePath), defaultData);
	}

	async setMeta(hash:string, type: string, compressed: boolean) {
		this.db.data.meta[hash] = { type, compressed };
		await this.db.write();
	}

	async getMeta(hash:string): Promise<{ type: string; compressed: boolean }> {
		return await this.db.data.meta[hash];
	}

	async init() {
		await this.db.read();
	}

	async getHashDir(hashKey:string) { 
		return this.db.data.compileMapping[hashKey];
	}



	async setHashDir(packName:string, importConfHash:string, hashKey:string, hashValue:string) {
		this.db.data.compileMapping[hashKey] = hashValue;
		this.db.data.packMapping[packName] = hashValue;
		this.db.data.importconfMapping[hashValue] = importConfHash;
		await this.db.write();
	}

	async getImportConf(hash:string){
		return this.db.data.importconfMapping[hash]
	}
}

export default CacheStore;
