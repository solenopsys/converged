/** Publishes product-owned content into the service-specific runtime stores. */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Writer } from "../fs";
import type { Config } from "../types";

function files(root: string): string[] {
	if (!existsSync(root)) return [];
	const found: string[] = [];
	const visit = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) continue;
			const path = join(dir, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile()) found.push(path);
		}
	};
	visit(root);
	return found.sort();
}

async function publishLocale(
	root: string,
	lang: string,
	output: string,
	writer: Writer,
	allowed?: Set<string>,
) {
	for (const source of files(root)) {
		const rel = relative(root, source);
		if (allowed && !allowed.has(rel)) continue;
		// This is generator input, not a directly served content document.
		if (rel === "ecosystem/landing.json") continue;
		await writer.copy(join(output, lang, rel), source);
	}
}

export async function emitContent(
	config: Config,
	writer: Writer,
	langs: string[] = [],
) {
	if (!config.content || !existsSync(config.content)) return;
	const sourceLocale = config.translation.sourceLocale;
	const requested = langs.length ? new Set(langs) : null;

	for (const { store, output } of [
		{ store: "struct", output: config.out.struct },
		{ store: "markdown", output: config.out.markdown },
	]) {
		const sourceRoot = join(config.content, store, sourceLocale);
		const sourceFiles = new Set(
			files(sourceRoot).map((path) => relative(sourceRoot, path)),
		);
		if (!requested || requested.has(sourceLocale)) {
			await publishLocale(sourceRoot, sourceLocale, output, writer);
		}

		const cacheRoot = join(config.contentCache, store);
		if (!config.contentCache || !existsSync(cacheRoot)) continue;
		for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
			if (!entry.isDirectory() || !/^[a-z]{2,3}$/.test(entry.name)) continue;
			if (requested && !requested.has(entry.name)) continue;
			await publishLocale(
				join(cacheRoot, entry.name),
				entry.name,
				output,
				writer,
				sourceFiles,
			);
		}
	}

	for (const source of files(join(config.content, "static"))) {
		await writer.copy(
			join(config.out.static, relative(join(config.content, "static"), source)),
			source,
		);
	}
}
