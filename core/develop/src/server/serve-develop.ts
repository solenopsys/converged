import { existsSync } from "fs";
import { join } from "path";
import { LocalCompiller } from "../compillers/local";
import { ModuleCompiller } from "../compillers/module";
import { PathsConfig } from "../compillers/abstract";

import { extractBootstrapsDirs } from "../tools/dirs";

process.chdir("../");
const CONF_DIR = "./configuration";
import { fileResponse, jsToResponse, indexResponse } from "./responses";

interface HendlerFunc {
	(req: { path: string }): Promise<Response>;
}

function startServer(
	rootDir: string,
	name: string,
	bsDir: string,
	port: number,
) {
	const hendlers: { [key: string]: HendlerFunc } = {};

	hendlers["/library/*"] = async (req: { path: string }) => {
		let libName = req.path.replace("/library/", "").replace(".mjs", "");
		let libNameCompile = req.path
			.replace("/library/", "/libraries/")
			.replace(".mjs", "");

		const pc = new PathsConfig(rootDir, libNameCompile, "dist");
		const jsPath = await new LocalCompiller(pc, "/src/index.ts", libName).run();

		// local
		return jsToResponse(jsPath);
	};
	hendlers["/packages/*"] = async (req: { path: string }) => {
		const pc = new PathsConfig(rootDir, req.path, "dist");
		const jsPath = await new ModuleCompiller(pc, "/src/index.tsx").run();
		return jsToResponse(jsPath);
	};

	hendlers["/images/*"] = async (req: { path: string }) => {
		console.log("IMAGES", req.path);
		return await fileResponse("./configuration" + req.path);
	};

	// hendlers["/assets/scipts/**"] = async (req: { path: string }) => {
	// 	return await fileResponse(join("./configuration",  req.path));
	// };

	hendlers["/assets/*"] = async (req: { path: string }) => {
		return await fileResponse(join("./configuration", req.path));
	};

	hendlers["*/"] = async (req: { path: string }) => {
		return await indexResponse(join(rootDir, CONF_DIR), join(rootDir, bsDir));
	};

	hendlers["*/*"] = async (req: { path: string }) => {
		return await indexResponse(join(rootDir, CONF_DIR), join(rootDir, bsDir));
	};

	const server = Bun.serve({
		port: port,
		async fetch(request) {
			const url = new URL(request.url);
			const path = url.pathname + url.search;

			const handlerKey: string | undefined = Object.keys(hendlers).find(
				(item) => {
					const pattern = "^" + item.replace("*", ".*") + "$";
					return path.match(pattern);
				},
			);

			if (handlerKey) {
				const h: HendlerFunc = hendlers[handlerKey];
				return h({ path });
			}
			let filePath = CONF_DIR + path;
			return fileResponse(filePath);
		},
	});

	console.log(`Start server ${name}: ${server.port}`, Bun.nanoseconds());
}

export function runServers(rootDir: string) {
	const bootstaps = extractBootstrapsDirs(rootDir);
	let port = 8080;
	for (const name of Object.keys(bootstaps)) {
		port++;
		const bsDir = bootstaps[name];
		console.log("START", name, bsDir, port);

		if (existsSync(bsDir)) {
			startServer(rootDir, name, bsDir, port);
		}
	}
}

runServers("./");
