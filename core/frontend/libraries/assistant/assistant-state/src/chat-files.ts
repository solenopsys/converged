import type { ChatStore } from "./chat-store";
import { MessageType, type ThreadsService } from "./types";

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
	analysisPrompt?: (fileId: string, file: UploadedFileInfo) => string;
};

const defaultAnalysisPrompt = (fileId: string, file: UploadedFileInfo) =>
	`[FILE] id=${fileId} name="${file.fileName}" size=${file.fileSize} type="${file.fileType}" — запусти анализ файла`;

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
	});
};

const persistFileLink = async (
	options: ChatFilesOptions,
	fileId: string,
	file: UploadedFileInfo,
): Promise<void> => {
	const { threadsService, store } = options;
	const threadId = store.threadId;

	const rows = await threadsService.readThread(threadId).catch(() => []);
	const parent = [...rows].sort(
		(left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0),
	)[0];

	await threadsService.saveMessage({
		threadId,
		id: `file_${fileId}`,
		beforeId: parent?.id,
		user: "user",
		type: MessageType.link,
		data: JSON.stringify({
			kind: "file",
			target: "store:file",
			label: file.fileName,
			fileId,
			fileName: file.fileName,
			fileSize: file.fileSize,
			fileType: file.fileType,
		}),
	});

	await options.registry?.recordChatFile(threadId, file.fileSize);

	const prompt = options.analysisPrompt ?? defaultAnalysisPrompt;
	store.send(prompt(fileId, file));
};
