import CacheStore from "./store";
import {CacheController} from "./cache_controller";
import WorkersService from "./worker_serivice";

import { join } from "node:path";
import { rename } from "node:fs/promises";
import { getDirectoryHash } from "../tools/dirs";
import { generateHash } from "../tools/hash";
import { brotliCompressFile } from "../tools/compress";
import { fixDebugId } from "../tools/debug";

import { externalsLoad } from "../tools/external";

async function fileHash(filePath: string) {
	const fileContent = await Bun.file(filePath).arrayBuffer();
	return generateHash(Buffer.from(fileContent));
}

async function insertLink(filePath: string, hash: string) {
	const fileContent = await Bun.file(filePath).text();
	const newContent = `${fileContent}//# sourceMappingURL=/dht/${hash}\n`;
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

import { resolve,dirname } from "path";
import { fileURLToPath } from "url";



async function findPackageRoot(modulePath: string): Promise<string> {
	let currentDir = dirname(modulePath);
  
	while (true) {
	  const pkgJsonPath = join(currentDir, "package.json");
	  if (await Bun.file(pkgJsonPath).exists()) {
		return currentDir;
	  }
  
	  const parentDir = dirname(currentDir);
	  if (parentDir === currentDir) {
		throw new Error("Package root not found");
	  }
	  currentDir = parentDir;
	}
  }

export default class BuildController {
	public readonly ws: WorkersService;
	public  readonly cc: CacheController;

	constructor(
		private rootDir: string,
		private cacheDir: string,
	) {
		this.cc = new CacheController(cacheDir);
		const buildWorker = new Worker("./develop/compile/workers/build.ts");
		this.ws = new WorkersService(buildWorker);
	}

	 

	

	async runBuildTaskPack(packName: string): Promise<string| undefined> {
		console.log("FIND PACKAGE",packName)
		// todo убрато этот костыль нужно переделать конфигурацию
		const context=import.meta.url;
		const packDir = (await Bun.resolve(packName, context)) ;
		const packageRoot = await findPackageRoot(packDir);
		console.log("FIND DIR",packageRoot)

		try {
			// const stats = await Bun.file(packDir).exists();
			// if (!stats) {
			// 	throw new Error(`Pack directory not found: ${packDir}`);
			// }
			const hash=await this.runBuildTask(packageRoot,true)
			return hash;
		} catch (error:any) {
			throw new Error(`Failed to build pack ${packName}: ${error.message}`);
		}
	}


	async runBuildTask(packDir: string, fullPath=false): Promise<string| undefined> {

		const targetDir = fullPath? packDir : this.rootDir + packDir;
		const srcDir = targetDir + "/src";

		const dirHash = await getDirectoryHash(srcDir);

		
		// todo refactoring move to cacheController
		const libHash=await this.cc.cs.getHashDir(dirHash)
		const libPath=join(this.cacheDir, `/store/${libHash}`);
		// check exists

		// console.log("libPath",libPath)
		if(await Bun.file(libPath).exists()){
			console.log("allready compiled",libPath)
			return libHash;
		}
		
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
			const { jsHash,mapHash } = await hashRename(tempPath, script, map);
			await this.cc.cs.setMeta(jsHash, "js", true);
			await this.cc.cs.setMeta(mapHash, "json", true);

			const fileContent = JSON.stringify(externalsConfig);
			const configHash = generateHash(Buffer.from(fileContent));
			const inportConfig = join(this.cacheDir, `/store/${configHash}`);
					// todo refactoring move to cacheController

			await Bun.write(inportConfig, fileContent);
			await this.cc.cs.setMeta(configHash, "json", false);

			this.cc.cs.setHashDir(externalsConfig.package, configHash, dirHash, jsHash);
			return jsHash;
		} 
	}

	async terminate() {
		this.ws.terminate();
	}
}
