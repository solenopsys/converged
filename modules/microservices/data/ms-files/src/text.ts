// Plain-text extraction from a stored file's bytes. This used to live in the
// sales-import workflow node (`extractTextFromBytes`); unzipping a spreadsheet
// and running XML regexes over it is exactly the kind of byte work that must
// not happen in the VM, so it belongs in the service that owns the bytes.

import { unzipSync } from "fflate";

const decoder = new TextDecoder("utf-8", { fatal: false });

function xmlDecode(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

/** Every <t>…</t> run in an OOXML/SVG part, tags stripped. */
function extractXmlText(xml: string): string[] {
	return Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (match) =>
		xmlDecode(match[1]?.replace(/<[^>]+>/g, "") ?? "").trim(),
	);
}

/** An .xlsx is a zip of XML parts: shared strings plus one part per sheet.
 *  Rows come out tab-separated so the delimited-lead parser can read them. */
function extractXlsxText(bytes: Uint8Array): string {
	const files = unzipSync(bytes);
	const sharedStrings = files["xl/sharedStrings.xml"]
		? extractXmlText(decoder.decode(files["xl/sharedStrings.xml"]))
		: [];
	const sheets = Object.entries(files)
		.filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
		.sort(([left], [right]) => left.localeCompare(right));
	const lines: string[] = [];

	for (const [, data] of sheets) {
		const xml = decoder.decode(data);
		for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
			const rowXml = rowMatch[1] ?? "";
			const cells: string[] = [];
			for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
				const attrs = cellMatch[1] ?? "";
				const body = cellMatch[2] ?? "";
				const type = attrs.match(/\bt="([^"]+)"/)?.[1];
				const rawValue =
					body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ??
					body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ??
					"";
				const value =
					type === "s"
						? (sharedStrings[Number(rawValue)] ?? "")
						: xmlDecode(rawValue);
				cells.push(value.trim());
			}
			if (cells.some(Boolean)) lines.push(cells.join("\t"));
		}
	}

	return lines.join("\n");
}

function extractSvgText(bytes: Uint8Array): string {
	const raw = decoder.decode(bytes);
	const textNodes = extractXmlText(raw);
	const titleNodes = Array.from(
		raw.matchAll(/<(title|desc)[^>]*>([\s\S]*?)<\/\1>/g),
		(match) => xmlDecode(match[2]?.replace(/<[^>]+>/g, "") ?? "").trim(),
	);
	return [...titleNodes, ...textNodes, raw.replace(/<[^>]+>/g, " ")]
		.filter(Boolean)
		.join("\n");
}

/** Best-effort text of a file, chosen by its name. Anything unrecognised is
 *  decoded as UTF-8, which is right for csv/tsv/txt/json and harmless
 *  otherwise. */
export function extractTextFromBytes(name: string, bytes: Uint8Array): string {
	const lower = name.toLowerCase();
	if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm"))
		return extractXlsxText(bytes);
	if (lower.endsWith(".svg")) return extractSvgText(bytes);
	return decoder.decode(bytes);
}
