/**
 * The one place that knows what a `MessageType.link` attachment looks like.
 *
 * There used to be no such place: `assistant-state/chat-files.ts` wrote the
 * shape and a private `parseLinkData` in `sf-assistants` read it. With exactly
 * one producer and one consumer the format had already forked into two — a flat
 * `fileId` and a nested `file.fileId` — which is what a codec split across
 * layers does. Both are still accepted on read; only the flat one is written.
 */

export type FileLink = {
	fileId: string;
	fileName: string;
	fileSize?: number;
	fileType?: string;
	/** Human-readable fallback shown when the file itself is gone. */
	label?: string;
};

/** The wire shape, kept byte-compatible with what the assistant already wrote. */
export function encodeFileLink(link: FileLink): string {
	return JSON.stringify({
		kind: "file",
		target: "store:file",
		label: link.label ?? link.fileName,
		fileId: link.fileId,
		fileName: link.fileName,
		fileSize: link.fileSize,
		fileType: link.fileType,
	});
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;
}

function text(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Returns `null` for anything that is not a file attachment — a `link` message
 * may legitimately be a plain hyperlink, and callers render that from `label`.
 */
export function parseFileLink(data: string): FileLink | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(data);
	} catch {
		return null;
	}
	const root = asRecord(parsed);
	if (!root) return null;
	// The nested variant is the historical one; read it, never write it.
	const source = asRecord(root.file) ?? root;
	const fileId = text(source.fileId);
	if (!fileId) return null;
	const size = source.fileSize;
	return {
		fileId,
		fileName: text(source.fileName) ?? text(root.label) ?? fileId,
		fileSize: typeof size === "number" && size > 0 ? size : undefined,
		fileType: text(source.fileType),
		label: text(root.label),
	};
}
