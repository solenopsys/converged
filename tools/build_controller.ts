import CacheStore from "./db.ts";
import WorkersService from "./worker_serivice.ts";
import { createHash } from "crypto";
import { join } from "path";
import { rename } from "fs/promises";
import { getDirectoryHash } from "./dir_hash.ts";

import { externalsLoad } from "./external_tool.ts";

function generateSha256Hash(content: Buffer) {
	return createHash("sha256").update(content).digest("hex");
}

export async function fixDebugId(
	dir: string,
	scriptFileName: string,
	mapFileName: string,
) {
	const fullPathJs = join(dir, scriptFileName);
	const fullPathMap = join(dir, mapFileName);

	// Читаем map файл с явным указанием utf-8 кодировки
	const mapContent = await Bun.file(fullPathMap).text();
	let jsonMap;

	try {
		jsonMap = JSON.parse(mapContent);
	} catch (error) {
		console.error("Ошибка парсинга JSON:", error);
		throw error;
	}

	const debugId = jsonMap.debugId;

	// Читаем js файл
	const fullFileContent = await Bun.file(fullPathJs).text();
	const fileContent = fullFileContent.split("//# debugId=")[0];
	const newDebugId = generateSha256Hash(Buffer.from(fileContent));
	const newFileContent = fullFileContent.replace(debugId, newDebugId);

	// Обновляем debugId
	jsonMap.debugId = newDebugId;

	try {
		// Сохраняем map файл
		await Bun.write(fullPathMap, JSON.stringify(jsonMap, null, 2));

		// Сохраняем js файл
		await Bun.write(fullPathJs, newFileContent);
	} catch (error) {
		console.error("Ошибка сохранения файлов:", error);
		throw error;
	}
}

async function fileHash(filePath: string) {
	const fileContent = await Bun.file(filePath).arrayBuffer();
	return generateSha256Hash(Buffer.from(fileContent));
}

async function insertLink(filePath: string, hash: string) {
	const fileContent = await Bun.file(filePath).text();
	const newContent = `${fileContent}//# sourceMappingURL=/kvs/http/${hash}\n`;
	await Bun.write(filePath, newContent);
}

import { brotliCompressSync, brotliDecompressSync } from "node:zlib";

 

async function brotliCompress(filePath: string): Promise<void> {
	try {
		 const startTime = performance.now();
		 
		 const file = Bun.file(filePath);
		 const content = await file.arrayBuffer();
		 const inputSize = content.byteLength;
		 
		 const compressed = brotliCompressSync(new Uint8Array(content));
		 const outputSize = compressed.byteLength;
		 
		 await Bun.write(filePath, compressed);
		 
		 const endTime = performance.now();
		 const compressionTime = endTime - startTime;
		 
		 console.log(`Compression completed successfully:${filePath}`);
		 console.log(` - Input size: ${(inputSize / 1024).toFixed(2)}->${(outputSize / 1024).toFixed(2)} KB`);
		 console.log(` - Compression ratio: ${(outputSize / inputSize * 100).toFixed(1)}%`);
		 console.log(` - Compression time: ${compressionTime.toFixed(2)} ms`);
	} catch (err) {
		 console.error('An error occurred:', err);
		 throw err;
	}
}

 

export async function hashRename(
	dir: string,
	scriptFileName: string,
	mapFileName: string,
) {
	try {

		


		const fullPathMap = join(dir, mapFileName);
		await brotliCompress(fullPathMap);
		const mapHash = await fileHash(fullPathMap);
		console.log("MAP HASH", fullPathMap, mapHash);

		const fullPathJs = join(dir, scriptFileName);
		await insertLink(fullPathJs, mapHash); // вставляется ссылка на map файл
		await brotliCompress(fullPathJs);
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

export default class BuildController {
	public readonly ws: WorkersService;
	private cs: CacheStore;

	constructor(
		private rootDir: string,
		private cacheDir: string,
	) {
		this.cs = new CacheStore(`${cacheDir}/meta.json`);
		const buildWorker = new Worker("./tools/compile/workers/build.ts");
		this.ws = new WorkersService(buildWorker);
	}

	async init() {
		await this.cs.init();
	}

	async runBuildTask(packDir: string): Promise<any> {
		//this.cs.getHashDir(packDir); dsfsd


		const targetDir = this.rootDir + packDir;
		const srcDir = targetDir + "/src";
		const externalsConfig = await externalsLoad(packDir + "/package.json");

		const externals = Object.keys(externalsConfig.external);
		 const defaultExternals = Object.keys(this.ws.defaultExternal);
		 const joined = [...defaultExternals, ...externals];
		const result = await this.ws.runBuildTask(targetDir, joined);
		console.log("Build completed:", result);

		if (result.success) {
			const { script, map } = result;
			const tempPath = this.cacheDir + "/temp/";
			await fixDebugId(tempPath, script, map);
			const { jsHash } = await hashRename(tempPath, script, map);

			const dirHash = await getDirectoryHash(srcDir);

			
			const fileContent = JSON.stringify(externalsConfig);

			const configHash = generateSha256Hash(Buffer.from(fileContent));

			const inportConfig = join(this.cacheDir, `/store/${configHash}`);
			await Bun.write(inportConfig, fileContent);

			this.cs.setHashDir(externalsConfig.package,configHash, dirHash, jsHash);

		}
		return result;
	}

	async terminate() {
		this.ws.terminate();
	}
}
