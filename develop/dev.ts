import { readdirSync, fstatSync, openSync, existsSync } from "node:fs";
import { Elysia } from "elysia";
import { join } from "node:path";
import { indexHtmlTransform } from "./compile/html.ts";
import { CacheController } from "./services/cache_controller.ts";
import { hash } from "node:crypto";

const cacheController = new CacheController("./cache");
 

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

async function startServer(port: number, bsDir: string, rootDir: string) {
	const html: string = await indexBuild(rootDir, bsDir);

 

	const currentHash = await cacheController.saveFile(html, "html", true);

	new Elysia()
	.get("/", async ({ set }) => {
		console.log("READ ",currentHash)
		// Read the cached file
		const { buffer, type, compressed } =
			await cacheController.readFile(currentHash);

			console.log("read",type,compressed,hash )

		// Set response headers
		set.headers = {
			"Content-Type": type,
		};

		// Add compression header if content is compressed
		if (compressed) {
			set.headers["Content-Encoding"] = "br";
		}

		return buffer;
	})

		.listen(port, () => {
			console.log(`🦊 Server is running on http://localhost:${port}`);
		});
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
