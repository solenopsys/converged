import type { ExecutableTool } from "../types";

export type UploadedChatFile = {
	fileId: string;
	fileName?: string;
	fileSize?: number;
	fileType?: string;
	status?: string;
};

export const createUploadedChatFilesTool = (
	listFiles: () => UploadedChatFile[],
): ExecutableTool => ({
	name: "getUploadedChatFiles",
	description:
		"Get files uploaded in the current chat with their storage file IDs",
	parameters: {
		type: "object",
		properties: {},
		required: [],
	},
	execute: async () => ({ files: listFiles() }),
});
