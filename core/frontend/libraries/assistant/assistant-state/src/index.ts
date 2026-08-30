// The machine, the conversation state and the transports live in `orchestrator`
// — no effector UI, no DOM — so the CLI runs the same engine as the tab. What
// stays here is the screen's view of it, the dump into the thread, and the
// host-shaped tools below.
export * from "orchestrator";
export type {
	ChatFileRegistry,
	ChatFilesOptions,
	ChatUploadsSource,
	UploadedFileInfo,
} from "./chat-files";
export { bindChatFiles } from "./chat-files";
export type { ChatStore, ChatStoreOptions } from "./chat-store";
export { createChatStore } from "./chat-store";
export type { ChatView, ChatViewOptions } from "./chat-view";
export { createChatView } from "./chat-view";
export { chatDomain } from "./domain";
export type {
	ChatLifecycle,
	ChatLifecycleOptions,
	ChatRegistry,
} from "./lifecycle";
export { createChatLifecycle } from "./lifecycle";
export type { ChatPersistenceOptions } from "./persistence";
export { bindChatPersistence } from "./persistence";
export type {
	AssistantEnvelope,
	AssistantSignalChannel,
	SignalAssistantOptions,
} from "./signal-client";
export { createSignalAssistantClient } from "./signal-client";
export { parseToolArgs } from "./tools/args";
export type {
	FilesProcessHooks,
	WorkflowRunner,
	WorkflowRunResult,
} from "./tools/files-process";
export { createFilesProcessTool } from "./tools/files-process";
export type {
	FunctionCatalogContext,
	FunctionCatalogOptions,
	FunctionCatalogRegistry,
	FunctionCategory,
} from "./tools/function-catalog";
export { createFunctionCatalogTools } from "./tools/function-catalog";
export type { UploadedChatFile } from "./tools/uploaded-files";
export { createUploadedChatFilesTool } from "./tools/uploaded-files";
export * from "./types";
export type {
	ActionBrief,
	ActionContextManagerLike,
	CategorySummary,
	MFLoader,
	UIActionRegistryLike,
} from "./ui-action-tools";
export { createUIActionTools } from "./ui-action-tools";
