import lightningcssPlugin from "./lightningcss-plugin.ts";

export async function bindleLibrary(
	libName: string,
	unicId: string,
	entryPoint: string,
	outPutPath: string,
	external: string[],
) {
	const outNameJS = `${libName}.${unicId}.js`;

	//console.log("EXTERNAL", external);
	await Bun.build({
		sourcemap: "external",
		entrypoints: [entryPoint],
		target: "browser",
		outdir: outPutPath,
		naming: {
			entry: outNameJS, //this problem
		},
		minify: true,
		external,
		plugins: [lightningcssPlugin()],
	}).catch((e) => {
		console.log("ERROR BUILD", e);
	});

	return { script: outNameJS, map: `${outNameJS}.map` };
}
