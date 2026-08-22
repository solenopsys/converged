/**
 * Pack the ptah chart into `core/tools/install/install.sh`.
 *
 * The installer is served over plain HTTP and piped straight into a shell, so
 * it has to be one file: a chart fetched separately at install time is a
 * second thing that can be unavailable, stale, or replaced. The chart travels
 * as a base64 tarball with its digest next to it, and the script refuses to
 * install a payload whose digest does not match.
 *
 * The tarball is built with fixed names, times and ownership so that an
 * unchanged chart produces an unchanged installer — otherwise every rebuild
 * would look like a release.
 */

import { createHash } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);
const CHART_DIR = resolve(HERE, "chart");
const TEMPLATE = resolve(HERE, "install.sh.tmpl");
const OUTPUT = resolve(HERE, "install.sh");

/** Reproducible tar: same chart in, same bytes out. */
async function packChart(): Promise<Buffer> {
	const proc = Bun.spawn(
		[
			"tar",
			"--sort=name",
			"--mtime=@0",
			"--owner=0",
			"--group=0",
			"--numeric-owner",
			"-czf",
			"-",
			"-C",
			CHART_DIR,
			".",
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [code, bytes, stderr] = await Promise.all([
		proc.exited,
		new Response(proc.stdout as ReadableStream).arrayBuffer(),
		new Response(proc.stderr as ReadableStream).text(),
	]);
	if (code !== 0) throw new Error(`tar failed: ${stderr.trim()}`);
	return Buffer.from(bytes);
}

// A shell heredoc would not survive `curl | sh`, so the payload sits in a
// single-quoted variable. Base64 has no quote to break out of, which is what
// makes that safe rather than merely convenient.
const chart = await packChart();
const digest = createHash("sha256").update(chart).digest("hex");
const template = await readFile(TEMPLATE, "utf8");

const script = template
	.replaceAll("@CHART_TGZ_B64@", chart.toString("base64"))
	.replaceAll("@CHART_TGZ_SHA256@", digest)
	.replaceAll("@BUILT_AT@", new Date().toISOString().slice(0, 10));

for (const placeholder of ["@CHART_TGZ_B64@", "@CHART_TGZ_SHA256@", "@BUILT_AT@"]) {
	if (script.includes(placeholder)) throw new Error(`unsubstituted ${placeholder}`);
}

await writeFile(OUTPUT, script);
await chmod(OUTPUT, 0o755);

console.log(`chart   ${CHART_DIR}`);
console.log(`payload ${(chart.length / 1024).toFixed(1)} KiB  sha256:${digest.slice(0, 12)}`);
console.log(`wrote   ${OUTPUT} (${(script.length / 1024).toFixed(1)} KiB)`);
