import type { Message } from "g-threads";
import { MessageType } from "g-threads";
import { type FileLink, parseFileLink } from "./link-codec";

/**
 * One thread message as a screen renders it. `ThreadedChat` in `front-core`
 * needs exactly this and nothing else; the file below is what three surfaces
 * were each deriving on their own.
 */
export type ThreadEntry = {
	id: string;
	beforeId?: string;
	user: string;
	content: string;
	timestamp: number;
	type: MessageType;
	/** Present only when this entry is a file attachment. */
	file?: FileLink;
};

/**
 * `Message[]` → feed entries, in one order, with one id default.
 *
 * Copied verbatim into `CommunityView.tsx` and `ChatView.tsx` before this
 * existed. Messages without an id are dropped rather than rendered under a
 * synthetic one: `beforeId` points at real ids, and a made-up parent silently
 * reparents a whole branch.
 */
export function mapThreadMessages(messages: readonly Message[]): ThreadEntry[] {
	return messages
		.filter((message) => Boolean(message.id))
		.map((message) => ({
			id: message.id as string,
			beforeId: message.beforeId,
			user: message.user || "user",
			content: message.data ?? "",
			timestamp: message.timestamp ?? 0,
			type: message.type,
			file:
				message.type === MessageType.link
					? (parseFileLink(message.data ?? "") ?? undefined)
					: undefined,
		}))
		.sort((left, right) => left.timestamp - right.timestamp);
}

/**
 * The id a new message should hang off — the latest message in the thread.
 *
 * This was written three times in three ways (a sort in `ChatView`, a reduce in
 * `ChatRoomView`, another sort in `chat-files.ts`). A reduce, because sorting a
 * thread to read one element off the end is the expensive way to do it.
 */
export function resolveParentId(
	messages: readonly Message[] | readonly ThreadEntry[],
): string | undefined {
	let latest: { id?: string; timestamp?: number } | undefined;
	for (const message of messages) {
		if (!message.id) continue;
		if (!latest || (message.timestamp ?? 0) >= (latest.timestamp ?? 0)) {
			latest = message;
		}
	}
	return latest?.id;
}
