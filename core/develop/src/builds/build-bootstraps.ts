import { join } from "path";
import { indexHtmlTransform } from "../tools/html.ts";
import { PRO_DIST } from "../confs.ts";
import { genMap } from "../tools/bootstraps.ts";
import { existsSync } from "fs";
import { mkdirSync } from "fs";

process.chdir("../");

async function buildHtml(dirBs: string) {
	const dirPath = "./configuration/";
	const htmlStrng = await Bun.file(join(dirPath, "/index.html")).text();
	const scriptString = await Bun.file(join(dirPath, "/index.js")).text();
	const entryString = await Bun.file(join(dirBs, "/entry.json")).text();

	const CONFIG_MAP = await genMap();

	const htmlContent = await indexHtmlTransform(
		htmlStrng,
		scriptString,
		CONFIG_MAP,
		entryString,
	);

	return htmlContent;
}

const name_parameter = process.argv[2];

buildHtml("./bootstraps/solenopsys/" + name_parameter).then((ht) => {
	//console.log("HTML", ht);
	console.log("DONE");
	const dir = `./${PRO_DIST}`;
	// make dirs
	if (!existsSync(dir)) {
		mkdirSync(dir);
	}
	Bun.write(`${dir}/index.html`, ht);
});
