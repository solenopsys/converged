import type { ChatConfig } from "./config";
import { type Chat, type ChatCatalog, initChatStore } from "./store";

export {
	$slashSections,
	registerSlashSection,
	slashSections,
} from "./commands/registry";
export type {
	SlashCommand,
	SlashHandler,
	SlashSection,
} from "./commands/types";
export type { ChatConfig } from "./config";
export type { Chat, ChatCatalog } from "./store";
export { Transcript } from "./ui/Transcript";
export type { MagicPrompt } from "./ui/MagicPrompts";

export async function initChat(
	config: ChatConfig,
	mountStyles: () => Promise<void>,
	catalog?: ChatCatalog,
): Promise<Chat> {
	const chat = initChatStore(config, catalog);
	await mountStyles();
	return chat;
}
