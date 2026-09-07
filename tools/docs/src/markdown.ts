/** Small markdown transforms shared by the readme, html and pdf emitters. */

/**
 * Removes a document's own top-level heading. Emitters supply the title from
 * the index, so keeping the file's `# ...` would print it twice; a `#` that is
 * not on the first non-empty line is left alone, it belongs to the body.
 */
export function stripLeadingHeading(content: string): {
	heading?: string;
	body: string;
} {
	const lines = content.split("\n");
	let first = 0;
	while (first < lines.length && (lines[first] ?? "").trim() === "") first += 1;

	const match = lines[first]?.match(/^#\s+(.*)$/);
	if (!match) return { body: content };

	return {
		heading: (match[1] ?? "").trim(),
		body: lines
			.slice(first + 1)
			.join("\n")
			.replace(/^\n+/, ""),
	};
}

/** Pushes every ATX heading down by `levels`, capped at h6. */
export function demoteHeadings(content: string, levels: number): string {
	if (levels <= 0) return content;
	let inFence = false;

	return content
		.split("\n")
		.map((line) => {
			if (/^\s*(```|~~~)/.test(line)) {
				inFence = !inFence;
				return line;
			}
			if (inFence) return line;
			const match = line.match(/^(#{1,6})(\s+)/);
			if (!match) return line;
			const depth = Math.min((match[1] ?? "").length + levels, 6);
			return `${"#".repeat(depth)}${match[2]}${line.slice(match[0].length)}`;
		})
		.join("\n");
}

/** GitHub's heading anchor: lowercased, punctuation dropped, spaces hyphenated. */
export function githubAnchor(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.replace(/\s+/g, "-");
}

/** Stable id for in-page navigation; ascii-only so it survives URLs and PDFs. */
export function anchorId(slug: string, index: number): string {
	const normalized = slug
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9\-_]/g, "");
	return normalized || `section-${index + 1}`;
}
