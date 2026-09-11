import { attachFileToThread } from "threads-state";
import type { ChatStore } from "./chat-store";
import type { ThreadsService } from "./types";

export type UploadedFileInfo = {
	fileName: string;
	fileSize?: number;
	fileType?: string;
};

export type ChatUploadsSource = {
	uploadCompleted: { watch(callback: (fileId: string) => void): unknown };
	getFile(fileId: string): UploadedFileInfo | undefined;
};

export type ChatFileRegistry = {
	recordChatFile(threadId: string, fileSize?: number): Promise<unknown>;
};

export type ChatFilesOptions = {
	store: ChatStore;
	threadsService: ThreadsService;
	uploads: ChatUploadsSource;
	registry?: ChatFileRegistry;
	ensureReady?: () => void;
	processFiles?: (fileIds: string[]) => Promise<unknown>;
};

export const bindChatFiles = (options: ChatFilesOptions): void => {
	options.uploads.uploadCompleted.watch((fileId) => {
		const file = options.uploads.getFile(fileId);
		if (!file) return;

		options.ensureReady?.();

		// The upload is an event in the conversation, so it goes into the same
		// timeline the screen already renders — as a user entry carrying the
		// attachment, not as a message shape of its own.
		options.store.attach({
			id: fileId,
			name: file.fileName,
			size: file.fileSize,
			type: file.fileType,
		});

		void persistFileLink(options, fileId, file).catch((error) => {
			console.warn("[assistant-state] Failed to save file message", error);
		});
		void options.processFiles?.([fileId]).catch((error) => {
			console.error("[assistant-state] File processing failed", error);
		});
	});
};

// Writing the attachment, finding its parent and encoding the payload are all
// `threads-state`'s job now — the forum, chats and support need the same three
// things, and each copy of them was drifting from the others.
const persistFileLink = async (
	options: ChatFilesOptions,
	fileId: string,
	file: UploadedFileInfo,
): Promise<void> => {
	const { threadsService, store } = options;
	const threadId = store.threadId;

	const known = await threadsService.readThread(threadId).catch(() => []);
	await attachFileToThread({
		client: threadsService,
		threadId,
		file: {
			fileId,
			fileName: file.fileName,
			fileSize: file.fileSize,
			fileType: file.fileType,
		},
		known,
	});

	await options.registry?.recordChatFile(threadId, file.fileSize);
};
