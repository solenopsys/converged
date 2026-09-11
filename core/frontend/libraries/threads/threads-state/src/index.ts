// Everything a screen needs to show a thread, in one place, because the three
// screens that already do it had each grown their own copy — see the comments
// on `parseFileLink`, `mapThreadMessages` and `resolveParentId`.
export type { FileLink } from "./link-codec";
export { encodeFileLink, parseFileLink } from "./link-codec";
export type { ThreadActivity, WatchThreadOptions } from "./live";
export {
	publishThreadActivity,
	THREAD_MESSAGE_EVENT,
	watchThread,
} from "./live";
export type { ThreadEntry } from "./messages";
export { mapThreadMessages, resolveParentId } from "./messages";
export type {
	AttachFileOptions,
	PostMessageOptions,
	ThreadsClient,
} from "./read";
export {
	attachFileToThread,
	postThreadMessage,
	readThreadMessages,
} from "./read";
