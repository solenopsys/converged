import lightningcssPlugin from "@solenopsys/converged-style/plugin";
import { CachedAbstractCompiller } from "./abstract";
import { PathsConfig } from "./abstract";
import { join } from "path";

export class ModuleCompiller extends CachedAbstractCompiller {
	constructor(
		conf: PathsConfig,
		private entry: string,
	) {
		super(conf);
	}

	async compile(production = false) {
		const packagesFile = join(
			super.conf.rootDir,
			super.conf.path,
			"/package.json",
		);
		const entryPoint = join(super.conf.rootDir, super.conf.path, this.entry);

		const combinedExternal = await this.externals(packagesFile);

		const out: any = await Bun.build({
			sourcemap: "none",
			entrypoints: [entryPoint],
			outdir: super.conf.outputPath(),
			minify: production,
			external: [...combinedExternal],
			plugins: [lightningcssPlugin()],
		}).catch((e) => {
			console.log("ERROR BUILD", e);
		});

		if (!out.success) {
			console.log("RES BUILD", out);
		}
	}
}
