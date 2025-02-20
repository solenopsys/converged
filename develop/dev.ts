import { readdirSync, fstatSync, openSync, existsSync } from "node:fs";

import { join } from "node:path";
import { indexHtmlTransform } from "./compile/html";
import { hash } from "node:crypto";
import buildController from "./init";
import { serverInit } from "./server";

import BuildController from "./services/build_controller"
import { JsonFieldProcessor } from "./bootstraps/processor";



async function configMapConvert(conf: {
	package: string;
	external: Record<string, string>;
}) {
	console.log("obj", conf);
	const libHash = await buildController.cc.cs.getPackHash(conf.package);
	console.log("libHash", libHash);

	Object.keys(conf.external).forEach(async (key) => {
		let packHash = await buildController.cc.cs.getPackHash(key);
		if(!packHash){
			
			 const hash = await buildController.runBuildTaskPack(key);
			 //@ts-ignore
			 packHash=hash;
		}
		conf.external[key] = wrapTarget(packHash);
	});

	const map: any = {};
	map[wrapTarget(libHash)] = conf.external;
	return map;
}

async function startServer(port: number, bsDir: string, rootDir: string) {
	const html: string = await indexBuild(rootDir, bsDir);

	const currentHash = await buildController.cc.saveFile(html, "html", true);
 
	 
	const bc = new BuildController("./","./cache");

	const processor=new JsonFieldProcessor(bc,bsDir);
	const result = await processor.processDir( );
	console.log(JSON.stringify(result, null, 2));

    serverInit(	port,bsDir,rootDir,currentHash,buildController,configMapConvert)
}

export async function indexBuild(
	dirPath: string,
	dirBs: string,
): Promise<string> {
	const htmlStrng = await Bun.file(
		join(dirPath, "./templates/index.html"),
	).text();
	const scriptString = await Bun.file(
		join(dirPath, "./templates/index.js"),
	).text();
	const entryString = await Bun.file(join(dirBs, "/entry.json")).json();

	const importMap = {};
	const htmlContent = await indexHtmlTransform(
		htmlStrng,
		scriptString,
		importMap,
		entryString,
	);
	return htmlContent;
}



function wrapTarget(target: string) {
	return `/kvs/http/${target}`;
}


export function extractBootstrapsDirs(rootDir: string): {
	[name: string]: string;
} {
	console.log("rootDir", rootDir);
	const dirs: { [name: string]: string } = {};

	// Добавлена проверка на существование директории
	if (!existsSync(rootDir)) {
		console.error(`Directory not found: ${rootDir}`);
		return dirs;
	}
	const files = readdirSync(rootDir);
	console.log(files);
	for (const file of files) {
		const filePath = `${rootDir}/${file}`;
		console.log(filePath);
		const fileDescriptor = openSync(filePath, "r");
		const idDirectory = fstatSync(fileDescriptor).isDirectory();
		if (idDirectory) {
			dirs[file] = filePath;
		}
	}
	return dirs;
}

export function runServers(rootDir: string) {
	const bootstaps = extractBootstrapsDirs(`${rootDir}bootstraps`);
	console.log("dirs", bootstaps);
	let port = 8080;
	for (const name of Object.keys(bootstaps)) {
		port++;
		const bsDir = bootstaps[name];
		console.log("START", name, bsDir, port);
		startServer(port, bsDir, rootDir);
	}
}

runServers("./");
