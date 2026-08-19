import type { ComponentChildren, VNode } from "preact";



const INLINE_PATTERN =
	/`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<)]+)/g;

const inlineNodes = (text: string): ComponentChildren[] => {
	const nodes: ComponentChildren[] = [];
	let lastIndex = 0;
	let key = 0;

	INLINE_PATTERN.lastIndex = 0;
	for (
		let match = INLINE_PATTERN.exec(text);
		match;
		match = INLINE_PATTERN.exec(text)
	) {
		if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
		const [
			whole,
			code,
			strongStars,
			strongUnderscores,
			emStars,
			emUnderscores,
			linkText,
			linkHref,
			autoLink,
		] = match;

		if (code !== undefined) {
			nodes.push(<code key={key++}>{code}</code>);
		} else if (strongStars ?? strongUnderscores) {
			nodes.push(<strong key={key++}>{strongStars ?? strongUnderscores}</strong>);
		} else if (emStars ?? emUnderscores) {
			nodes.push(<em key={key++}>{emStars ?? emUnderscores}</em>);
		} else if (linkHref) {
			nodes.push(
				<a key={key++} href={linkHref} target="_blank" rel="noreferrer noopener">
					{linkText}
				</a>,
			);
		} else if (autoLink) {
			nodes.push(
				<a key={key++} href={autoLink} target="_blank" rel="noreferrer noopener">
					{autoLink}
				</a>,
			);
		}
		lastIndex = match.index + whole.length;
	}

	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return nodes;
};


const inline = (text: string): ComponentChildren[] => {
	const lines = text.split("\n");
	return lines.flatMap((line, index) =>
		index === 0
			? inlineNodes(line)
			: [<br key={`br-${index}`} />, ...inlineNodes(line)],
	);
};

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function renderMarkdown(source: string): VNode[] {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	const blocks: VNode[] = [];
	let index = 0;
	let key = 0;

	while (index < lines.length) {
		const line = lines[index];

		if (!line.trim()) {
			index += 1;
			continue;
		}

		if (line.trimStart().startsWith("```")) {
			const language = line.trimStart().slice(3).trim();
			const code: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
				code.push(lines[index]);
				index += 1;
			}
			index += 1; // closing fence
			blocks.push(
				<pre key={key++} class="md-code" data-language={language || undefined}>
					<code>{code.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		const heading = HEADING.exec(line);
		if (heading) {
			const Tag = `h${Math.min(heading[1].length + 2, 6)}` as "h3";
			blocks.push(
				<Tag key={key++} class="md-heading">
					{inline(heading[2])}
				</Tag>,
			);
			index += 1;
			continue;
		}

		if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
			blocks.push(<hr key={key++} class="md-rule" />);
			index += 1;
			continue;
		}

		if (LIST_ITEM.test(line)) {
			const ordered = /^\s*\d+[.)]\s+/.test(line);
			const items: string[] = [];
			while (index < lines.length && LIST_ITEM.test(lines[index])) {
				items.push(lines[index].replace(LIST_ITEM, ""));
				index += 1;
			}
			const Tag = ordered ? "ol" : "ul";
			blocks.push(
				<Tag key={key++} class="md-list">
					{items.map((item, itemIndex) => (
						<li key={itemIndex}>{inline(item)}</li>
					))}
				</Tag>,
			);
			continue;
		}

		if (line.trimStart().startsWith(">")) {
			const quoted: string[] = [];
			while (index < lines.length && lines[index].trimStart().startsWith(">")) {
				quoted.push(lines[index].trimStart().replace(/^>\s?/, ""));
				index += 1;
			}
			blocks.push(
				<blockquote key={key++} class="md-quote">
					{inline(quoted.join("\n"))}
				</blockquote>,
			);
			continue;
		}

		const paragraph: string[] = [];
		while (
			index < lines.length &&
			lines[index].trim() &&
			!LIST_ITEM.test(lines[index]) &&
			!HEADING.test(lines[index]) &&
			!lines[index].trimStart().startsWith("```") &&
			!lines[index].trimStart().startsWith(">")
		) {
			paragraph.push(lines[index]);
			index += 1;
		}
		blocks.push(
			<p key={key++} class="md-paragraph">
				{inline(paragraph.join("\n"))}
			</p>,
		);
	}

	return blocks;
}
