import { describe, expect, test } from "bun:test";
import { bindChatFiles } from "./chat-files";
import type { ChatStore } from "./chat-store";
import type { ThreadsService } from "./types";

describe("chat file uploads", () => {
	test("starts files processing after a file is stored", async () => {
		let completed: ((fileId: string) => void) | undefined;
		const attached: unknown[] = [];
		const processed: string[][] = [];
		const store = {
			threadId: "thread-1",
			attach: (file: unknown) => attached.push(file),
		} as ChatStore;

		bindChatFiles({
			store,
			threadsService: {
				readThread: async () => [],
				saveMessage: async () => {},
			} as unknown as ThreadsService,
			uploads: {
				uploadCompleted: {
					watch: (callback) => {
						completed = callback;
					},
				},
				getFile: () => ({
					fileName: "part.stl",
					fileSize: 42,
					fileType: "model/stl",
				}),
			},
			processFiles: async (fileIds) => {
				processed.push(fileIds);
			},
		});

		completed?.("file-1");
		await Bun.sleep(0);

		expect(attached).toEqual([
			{ id: "file-1", name: "part.stl", size: 42, type: "model/stl" },
		]);
		expect(processed).toEqual([["file-1"]]);
	});
});
