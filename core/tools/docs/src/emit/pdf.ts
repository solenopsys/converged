/**
 * The PDF target: the same preact-rendered page as the HTML target, printed by
 * a headless browser.
 *
 * The browser is whatever is already on the machine. Puppeteer is used when the
 * workspace has it, and otherwise a Chrome or Chromium binary is driven through
 * `--print-to-pdf`; page geometry lives in the stylesheet's `@page` rule either
 * way, so both paths produce the same document. Nothing here is a dependency of
 * the workspace — a headless browser download is a steep price for one target.
 */

import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Writer } from "../fs";
import { renderBook } from "../render/shell";
import type { Book, Config } from "../types";

const CHROME_CANDIDATES = [
	"chromium",
	"chromium-browser",
	"google-chrome-stable",
	"google-chrome",
	"chrome",
];

type Printer = (html: string, target: string) => Promise<void>;

type PuppeteerPage = {
	setContent(html: string, options?: unknown): Promise<void>;
	pdf(options?: unknown): Promise<Uint8Array>;
	close(): Promise<void>;
};

type PuppeteerModule = {
	default?: PuppeteerModule;
	launch(options?: unknown): Promise<{ newPage(): Promise<PuppeteerPage> }>;
};

async function puppeteerPrinter(): Promise<Printer | null> {
	let puppeteer: PuppeteerModule;
	try {
		puppeteer = (await import("puppeteer")) as unknown as PuppeteerModule;
	} catch {
		return null;
	}

	const browser = await (puppeteer.default ?? puppeteer).launch({
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	return async (html, target) => {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: "networkidle0" });
		// `preferCSSPageSize` hands size and margins to the `@page` rule, which is
		// also what the CLI path obeys; setting them here too would fight it.
		await Bun.write(
			target,
			await page.pdf({ printBackground: true, preferCSSPageSize: true }),
		);
		await page.close();
	};
}

function findChrome(): string | null {
	const configured = Bun.env.DOCS_CHROME;
	if (configured) return existsSync(configured) ? configured : null;
	for (const name of CHROME_CANDIDATES) {
		const path = Bun.which(name);
		if (path) return path;
	}
	return null;
}

function chromePrinter(binary: string, scratch: string): Printer {
	mkdirSync(scratch, { recursive: true });
	let counter = 0;

	return async (html, target) => {
		// Chrome prints a URL, not a string, so the page goes to disk first.
		const page = join(scratch, `page-${counter++}.html`);
		await Bun.write(page, html);

		const result = Bun.spawnSync([
			binary,
			"--headless",
			"--disable-gpu",
			"--no-sandbox",
			"--no-pdf-header-footer",
			`--print-to-pdf=${target}`,
			`file://${page}`,
		]);

		if (!existsSync(target)) {
			const stderr = new TextDecoder().decode(result.stderr).trim();
			throw new Error(`${binary} produced no PDF for ${target}\n${stderr}`);
		}
	};
}

async function resolvePrinter(scratch: string): Promise<Printer> {
	const viaPuppeteer = await puppeteerPrinter();
	if (viaPuppeteer) return viaPuppeteer;

	const chrome = findChrome();
	if (chrome) return chromePrinter(chrome, scratch);

	throw new Error(
		"PDF output needs a headless browser: install chromium, or set DOCS_CHROME to a Chrome binary, or `bun add -d puppeteer` in core/tools/docs",
	);
}

export async function emitPdf(books: Book[], config: Config, writer: Writer) {
	if (books.length === 0) return;

	// Resolved even on a dry run: an unprintable machine is worth reporting.
	const print = await resolvePrinter(join(tmpdir(), "docs-builder-pages"));

	for (const book of books) {
		const target = join(config.out.pdf, book.lang, `${book.section}.pdf`);
		writer.claim(target);
		if (writer.dryRun) continue;
		mkdirSync(join(config.out.pdf, book.lang), { recursive: true });
		await print(await renderBook(book), target);
	}
}
