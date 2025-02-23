import { readdirSync, fstatSync, openSync, existsSync } from "node:fs";

import { join } from "node:path";
import { indexHtmlTransform } from "./compile/html";
import buildController from "./init";
import { serverInit } from "./server";

import BuildController from "./services/build_controller";
import { JsonFieldProcessor } from "./bootstraps/processor";
import { wrapTarget } from "./tools/urls";

async function configMapConvert(conf: {
	package: string;
	external: Record<string, string>;
}) {
	console.log("obj", conf);
	const libHash = await buildController.cc.cs.getPackHash(conf.package);
	console.log("libHash", libHash);

	await Promise.all(Object.keys(conf.external).map(async (key) => {
		let packHash = await buildController.cc.cs.getPackHash(key);
		if (packHash === undefined) {
			packHash = await buildController.runBuildTaskPack(key);
		}
		conf.external[key] = wrapTarget(packHash);
	}));

	const map: any = {};
	map[wrapTarget(libHash)] = conf.external;
	return map;
}

async function startServer(port: number, bsDir: string, rootDir: string) {
	const html: string = await indexBuild(rootDir, bsDir);

	const currentHash = await buildController.cc.saveFile(html, "html", true);

	serverInit(
		port,
		bsDir,
		rootDir,
		currentHash,
		buildController,
		configMapConvert,
	);
}

async function buildIndexJs(external: string[]) {
	await Bun.build({
		entryPoints: ["./develop/html/entry.ts"],
		outdir: "./templates",
		minify: true,
		target: "browser",
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		external,
	});
}

export async function indexBuild(
	dirPath: string,
	dirBs: string,
): Promise<string> {
	const htmlStrng = await Bun.file(
		join(dirPath, "./templates/index.html"),
	).text();
	const scriptString = await Bun.file(
		join(dirPath, "./templates/entry.js"),
	).text();

	const bc = new BuildController("./", "./cache");

	const processor = new JsonFieldProcessor(bc, dirBs);
	const result: any = await processor.processDir();

	const jsHashUri = result?.layout?.module["_uri"];

	const externals = Object.keys(buildController.ws.defaultExternal);
	const imports: Record<string, string> = {};
	for (const e of externals) {
		let hash = await buildController.cc.cs.getPackHash(e);
		if (hash === undefined) {
			hash = await buildController.runBuildTaskPack(e);
		}
		if (hash !== undefined) {  // Добавляем проверку перед сохранением
			imports[e] = wrapTarget(hash);
		}
	}
	let map = {};
	if (jsHashUri) {
		const hash= jsHashUri.split("/").pop();
		const conf = await buildController.cc.getImportConf(hash);

		map = {
			imports: imports,
			scopes: await configMapConvert(conf),
		};
	}

	console.log("MAP", map);
	await buildIndexJs(externals);

	const htmlContent = await indexHtmlTransform(
		htmlStrng,
		scriptString,
		map,
		result,
	);
	return htmlContent;
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
