import { CORE_LIBS, PRO_DIST } from "../confs";
import { getDirs } from "../tools/dirs";
import { ModuleCompiller } from "../compillers/module";
import { PathsConfig } from "../compillers/abstract";
import { LibraryCompiller } from "../compillers/library";

process.chdir("../");

const packagesDirs = getDirs("./packages/solenopsys/");

async function compileModules() {
	for (const dir of packagesDirs) {
		const clearDir = dir.replace(".", "");

		console.log("COMPILE", dir);
		const pathConf = new PathsConfig(dir, clearDir, PRO_DIST);

		await new ModuleCompiller(pathConf, "src/index.tsx").compile();
	}
}

async function compileCoreLibs() {
	for (const lib of CORE_LIBS) {
		const pathConf = new PathsConfig("./configuration", lib, PRO_DIST);
		await new LibraryCompiller(pathConf, lib).compile();
	}
}

async function buildAll() {
	await compileModules();
	await compileCoreLibs();
	//await scanDirs();
}

let start = Bun.nanoseconds();

buildAll().then(() => {
	const end = Bun.nanoseconds();
	console.log("DONE ", (end - start) / 1000000000, "s");
});
