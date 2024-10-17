import { CachedAbstractCompiller } from "./abstract";
import { PathsConfig } from "./abstract";
import { join, resolve } from "path";
import { browserResolvePackage } from "../tools/resolve";
import { copyFile } from "../builds/utils";

export class LibraryCompiller extends CachedAbstractCompiller {
	constructor(
		conf: PathsConfig,
		private libName: string,
	) {
		super(conf);
	}

	async compile(production = false) {
		console.log("BUILD LOCAL");
		let brs = await browserResolvePackage(this.libName, this.conf.rootDir);
		console.log("BRS", brs);

		let founded = resolve(this.conf.rootDir, "node_modules", brs);

		// todo suprclass
		const outPath = join(
			this.conf.rootDir,
			`../${this.conf.distDir}/libraries/`,
			this.libName,
		);
		const absoluteOutPath = resolve(outPath);

		const newPathToFile = join(absoluteOutPath, "index.js");
		console.log("FOUND", founded);
		console.log("TO", newPathToFile);
		await copyFile(founded, newPathToFile);
		return newPathToFile;
	}
}
