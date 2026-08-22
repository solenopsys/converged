/**
 * Stylesheet for the static targets.
 *
 * `MarkdownRenderer` is written in the site's utility classes, so the docsite
 * has to resolve them the same way the product build does: the microfrontend
 * UnoCSS config plus the token file that gives `--ui-*` their values. Scanning
 * the rendered markup rather than a source glob keeps the sheet to what these
 * pages actually use.
 */

import { join } from "node:path";
import { createGenerator } from "unocss";
import unoMicrofrontendConfig from "../../../../frontend/spa/uno.mf.config";

const TOKENS = join(
	import.meta.dir,
	"../../../../frontend/front-core/src/styles/mf-tokens.css",
);

/** Layout the utility classes do not cover, plus the print rules for PDF. */
const DOCS_CSS = `
html { color-scheme: light; }
body {
  margin: 0;
  background: var(--ui-background);
  color: var(--ui-foreground);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.docs-layout { display: flex; align-items: flex-start; min-height: 100vh; }
.docs-menu { position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }
.docs-section + .docs-section { margin-top: 3rem; }

@page { size: A4; margin: 18mm 16mm; }

@media print {
  .docs-menu { display: none; }
  .docs-content { max-width: none; padding: 0; }
  .docs-section { break-before: page; }
  .docs-section:first-child { break-before: auto; }
  h1, h2, h3, h4 { break-after: avoid; }
  pre, table, blockquote, img { break-inside: avoid; }
}
`;

let cachedTokens: string | undefined;

export async function buildStyles(markup: string): Promise<string> {
	cachedTokens ??= await Bun.file(TOKENS).text();
	const uno = await createGenerator(unoMicrofrontendConfig);
	const { css } = await uno.generate(markup, { preflights: true });
	// Utilities last: they must win over the layout rules above, not the reverse.
	return [cachedTokens, DOCS_CSS, css].join("\n");
}
