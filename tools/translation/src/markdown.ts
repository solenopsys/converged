/**
 * Markdown reduced to a comparable shape.
 *
 * Markdown used to be `"other"` here, which meant hash comparison and nothing
 * else: a translation made from an older revision looked identical to a
 * correct one, and there was no secondary net at all. Since documentation is
 * markdown, that was the least protected file type in the tool.
 *
 * The shape is the heading outline — levels and their order, never the heading
 * text, which is supposed to differ. Prose blocks are extracted separately for
 * the unchanged-text check. Fenced code is skipped by both: code is meant to
 * survive translation verbatim, so comparing it would report every correct file.
 */

import { hashText } from "./fs";

export type MarkdownBlock = {
	kind: "heading" | "text";
	/** Heading level, 1–6. Absent for prose. */
	level?: number;
	text: string;
};

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Splits into headings and prose blocks. Not a markdown parser — it only needs
 * to be right about what is a heading, what is code, and where paragraphs end.
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	let paragraph: string[] = [];
	let inFence = false;

	const flush = () => {
		const text = paragraph.join(" ").trim();
		if (text) blocks.push({ kind: "text", text });
		paragraph = [];
	};

	for (const line of source.split("\n")) {
		if (FENCE.test(line)) {
			flush();
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const heading = HEADING.exec(line);
		if (heading) {
			flush();
			blocks.push({
				kind: "heading",
				level: heading[1]?.length ?? 1,
				text: (heading[2] ?? "").trim(),
			});
			continue;
		}

		if (line.trim().length === 0) {
			flush();
			continue;
		}
		paragraph.push(line.trim());
	}

	flush();
	return blocks;
}

/** Heading levels in order — the part a translation must preserve. */
export function outline(blocks: MarkdownBlock[]): string[] {
	return blocks
		.filter((block) => block.kind === "heading")
		.map((block) => `h${block.level}`);
}

export function outlineHash(blocks: MarkdownBlock[]): string {
	return hashText(outline(blocks).join("\n"));
}
