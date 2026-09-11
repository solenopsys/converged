import type { Message, ThreadsService } from "g-threads";
import { MessageType } from "g-threads";
import { encodeFileLink, type FileLink } from "./link-codec";
import { resolveParentId } from "./messages";

/** The subset of the generated threads client this library needs. */
export type ThreadsClient = Pick<
	ThreadsService,
	"readThread" | "saveMessage" | "registerThread"
>;

/**
 * Reads a thread the way every screen should.
 *
 * `readThread`, never `readThreadAllVersions`: the latter returns every version
 * of every message, so an edited post renders once per edit. Three of the four
 * existing views got this wrong.
 */
export async function readThreadMessages(
	client: Pick<ThreadsClient, "readThread">,
	threadId: string,
): Promise<Message[]> {
	if (!threadId) return [];
	const messages = await client.readThread(threadId);
	return [...messages].sort(
		(left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0),
	);
}

export type PostMessageOptions = {
	client: ThreadsClient;
	threadId: string;
	user: string;
	text: string;
	/** Explicit reply target; defaults to the tail of `known`. */
	beforeId?: string;
	/** Messages already on screen, used to find the tail without a re-read. */
	known?: readonly Message[];
};

export async function postThreadMessage({
	client,
	threadId,
	user,
	text,
	beforeId,
	known,
}: PostMessageOptions): Promise<string | null> {
	const body = text.trim();
	if (!body || !threadId) return null;
	return client.saveMessage({
		threadId,
		beforeId: beforeId ?? (known ? resolveParentId(known) : undefined),
		user,
		type: MessageType.message,
		data: body,
		timestamp: Date.now(),
	});
}

export type AttachFileOptions = {
	client: ThreadsClient;
	threadId: string;
	user?: string;
	file: FileLink;
	known?: readonly Message[];
};

/**
 * Attaches an uploaded file to a thread. Generalised out of `bindChatFiles`,
 * which did the same thing but only for the assistant's own store.
 *
 * The id is derived from `fileId` so that re-emitting the same upload
 * overwrites its own message instead of adding a second card for one file.
 */
export async function attachFileToThread({
	client,
	threadId,
	user = "user",
	file,
	known,
}: AttachFileOptions): Promise<string | null> {
	if (!threadId || !file.fileId) return null;
	return client.saveMessage({
		threadId,
		id: `file_${file.fileId}`,
		beforeId: known ? resolveParentId(known) : undefined,
		user,
		type: MessageType.link,
		data: encodeFileLink(file),
		timestamp: Date.now(),
	});
}
