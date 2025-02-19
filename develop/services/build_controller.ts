import CacheStore from "./store.ts";
import WorkersService from "./worker_serivice.ts";

import { join } from "node:path";
import { rename } from "node:fs/promises";
import { getDirectoryHash } from "../tools/dirs.ts";
import { generateHash } from "../tools/hash.ts";
import { brotliCompressFile } from "../tools/compress.ts";
import { fixDebugId } from "../tools/debug.ts";

import { externalsLoad } from "../tools/external.ts";

async function fileHash(filePath: string) {
	const fileContent = await Bun.file(filePath).arrayBuffer();
	return generateHash(Buffer.from(fileContent));
}

async function insertLink(filePath: string, hash: string) {
	const fileContent = await Bun.file(filePath).text();
	const newContent = `${fileContent}//# sourceMappingURL=/kvs/http/${hash}\n`;
	await Bun.write(filePath, newContent);
}

export async function hashRename(
	dir: string,
	scriptFileName: string,
	mapFileName: string,
) {
	try {
		const fullPathMap = join(dir, mapFileName);
		await brotliCompressFile(fullPathMap);
		const mapHash = await fileHash(fullPathMap);
		//console.log("MAP HASH", fullPathMap, mapHash);

		const fullPathJs = join(dir, scriptFileName);
		await insertLink(fullPathJs, mapHash); // вставляется ссылка на map файл
		await brotliCompressFile(fullPathJs);
		const jsHash = await fileHash(fullPathJs);

		const jsName = join(dir, `../store/${jsHash}`);
		const jsMapName = join(dir, `../store/${mapHash}`);
		await rename(fullPathJs, jsName);
		await rename(fullPathMap, jsMapName);
		return { jsHash, mapHash };
	} catch (error) {
		console.error("Error renaming file:", error);
		throw error;
	}
}

import { resolve } from "path";

export default class BuildController {
	public readonly ws: WorkersService;
	private cs: CacheStore;

	constructor(
		private rootDir: string,
		private cacheDir: string,
	) {
		this.cs = new CacheStore(`${cacheDir}/meta.json`);
		const buildWorker = new Worker("./develop/compile/workers/build.ts");
		this.ws = new WorkersService(buildWorker);
	}

	async init() {
		await this.cs.init();
	}

	async runBuildTaskPack(packName: string): Promise<string| undefined> {
		const packDir = resolve(packName);

		try {
			const stats = await Bun.file(packDir).exists();
			if (!stats) {
				throw new Error(`Pack directory not found: ${packDir}`);
			}
			return await this.runBuildTask(packDir);
		} catch (error) {
			throw new Error(`Failed to build pack ${packName}: ${error.message}`);
		}
	}
	async runBuildTask(packDir: string): Promise<string| undefined> {
		const targetDir = this.rootDir + packDir;
		const srcDir = targetDir + "/src";
		const externalsConfig = await externalsLoad(packDir + "/package.json");

		const externals = Object.keys(externalsConfig.external);
		const defaultExternals = Object.keys(this.ws.defaultExternal);
		const joined = [...defaultExternals, ...externals];
		const result = await this.ws.runBuildTask(targetDir, joined);
		//console.log("Build completed:", result);

		if (result.success) {
			const { script, map } = result;
			const tempPath = this.cacheDir + "/temp/";
			await fixDebugId(tempPath, script, map);
			const { jsHash } = await hashRename(tempPath, script, map);

			const dirHash = await getDirectoryHash(srcDir);

			const fileContent = JSON.stringify(externalsConfig);

			const configHash = generateHash(Buffer.from(fileContent));

			const inportConfig = join(this.cacheDir, `/store/${configHash}`);
			await Bun.write(inportConfig, fileContent);

			this.cs.setHashDir(externalsConfig.package, configHash, dirHash, jsHash);
			return jsHash;
		} 
	}

	async terminate() {
		this.ws.terminate();
	}
}
