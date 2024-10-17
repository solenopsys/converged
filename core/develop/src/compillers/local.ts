import { join } from "path";
import { CachedAbstractCompiller } from "./abstract";
import { PathsConfig } from "./abstract";

export class LocalCompiller extends CachedAbstractCompiller {
	constructor(
		conf: PathsConfig,
		private entry: string,
		private libName: string,
	) {
		super(conf);
	}

	async compile(production = false) {
		const packagesFile = join(
			super.conf.rootDir,
			this.libName,
			"/package.json",
		);
		const entryPoint = join(super.conf.rootDir, this.libName, this.entry);
		const combinedExternal = await this.externals(packagesFile);

		console.log("ENTRY", entryPoint);
		const out: any = await Bun.build({
			sourcemap: "none",
			entrypoints: [entryPoint],
			outdir: super.conf.outputPath(),
			minify: production,
			external: [...combinedExternal],
			plugins: [],
		}).catch((e) => {
			console.log("ERROR BUILD", e);
		});

		if (!out.success) {
			console.log("RES BUILD", out);
		}
	}
}
