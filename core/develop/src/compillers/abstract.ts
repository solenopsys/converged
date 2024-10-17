import { join } from "path";
import { existsFile } from "../builds/utils";
import { mkdirSync, renameSync } from "fs";
import { DEFAULT_EXTERNAL } from "../confs";

interface Compiller {
	compile(production: boolean);
}

export class PathsConfig {
	constructor(
		public readonly rootDir: string,
		public readonly path: string,
		public readonly distDir: string,
	) {}

	public outputPath() {
		return join(this.rootDir, this.distDir, this.path);
	}

	public outputJsPath() {
		return join(this.outputPath(), "index.js");
	}

	public async makeOutPath() {
		const outPath = this.outputPath();
		if (!(await existsFile(outPath))) {
			mkdirSync(outPath, { recursive: true });
		}
	}
}

export abstract class AbstractCompiller implements Compiller {
	constructor(protected conf: PathsConfig) {}
	abstract compile(production: boolean);

	protected async externals(packagesFile) {
		const tsConfigJson: any = await Bun.file(packagesFile).json();
		let packagesFromExternal = tsConfigJson["external"];
		if (!packagesFromExternal) {
			packagesFromExternal = [];
		}

		const combinedExternal = packagesFromExternal.concat(DEFAULT_EXTERNAL);
		console.log("EXTERNAL", combinedExternal);
		return combinedExternal;
	}

	protected async run(force = false): Promise<string> {
		const start = Bun.nanoseconds();
		console.log("COMPLILE", this.conf.outputJsPath());
		this.conf.makeOutPath();
		this.compile(force);
		const end = Bun.nanoseconds();
		console.log("BUILD", (end - start) / 1000000, this.conf.outputPath());
		return this.conf.outputJsPath();
	}
}

export abstract class CachedAbstractCompiller extends AbstractCompiller {
	constructor(protected conf: PathsConfig) {
		super(conf);
	}

	async run(force = false): Promise<string> {
		this.conf.makeOutPath();
		this.compile(false);
		if (!(await existsFile(this.conf.outputJsPath())) || force) {
			return super.run();
		} else {
			console.log("From cache");
		}
		return ""; // todo error
	}
}
