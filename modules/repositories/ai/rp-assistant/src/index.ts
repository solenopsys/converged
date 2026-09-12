import type { Chat, PaginatedResult, PaginationParams } from "g-assistant";
import { getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-assistant";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) throw new Error("Authenticated caller is required");
	return actor;
}

type ConversationRecord = {
	id: string;
	title: string;
	messagesCount: number | string;
	filesCount?: number | string;
	filesSize?: number | string;
	createdAt: number | string;
	updatedAt: number | string;
};

class AssistantMetadataService {
	private stores!: StoresController;
	private readonly initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.init();
	}

	private async init(): Promise<void> {
		this.stores = new StoresController(REPOSITORY_ID);
		await this.stores.init();
	}

	private async ensureInit(): Promise<void> {
		await this.initPromise;
	}

	private toChat(conversation: ConversationRecord): Chat {
		return {
			id: conversation.id,
			name: conversation.title,
			threadId: conversation.id,
			description: conversation.title,
			messagesCount: Number(conversation.messagesCount ?? 0),
			filesCount: Number(conversation.filesCount ?? 0),
			filesSize: Number(conversation.filesSize ?? 0),
			createdAt: Number(conversation.createdAt),
			updatedAt: Number(conversation.updatedAt),
		};
	}

	async listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>> {
		await this.ensureInit();
		const conversations = await this.stores.metadataService.listConversations({
			limit: params.limit,
			offset: params.offset,
			filter: params.filter,
		});
		const totalCount = await this.stores.metadataService.countConversations(
			params.filter,
		);

		return {
			items: conversations.map((conversation) => this.toChat(conversation)),
			totalCount,
		};
	}

	async registerChat(threadId: string, title?: string): Promise<Chat> {
		await this.ensureInit();
		const conversation = await this.stores.metadataService.registerConversation(
			threadId,
			title || `Chat ${threadId.slice(0, 8)}`,
			requireActor(),
		);
		return this.toChat(conversation);
	}

	async recordChatMessage(threadId: string): Promise<Chat> {
		await this.ensureInit();
		return this.toChat(
			await this.stores.metadataService.recordMessage(threadId, requireActor()),
		);
	}

	async recordChatFile(threadId: string, fileSize?: number): Promise<Chat> {
		await this.ensureInit();
		return this.toChat(
			await this.stores.metadataService.recordFile(
				threadId,
				fileSize,
				requireActor(),
			),
		);
	}

	async deleteChat(chatId: string): Promise<void> {
		await this.ensureInit();
		await this.stores.metadataService.access.requireWrite(chatId);
		await this.stores.metadataService.conversationRepo.delete({ id: chatId });
		await this.stores.metadataService.access.dropObject(chatId);
	}

	/**
	 * Someone else's conversation reports as missing rather than as forbidden:
	 * the title alone is most of what the chat was about.
	 */
	async getChat(chatId: string): Promise<Chat> {
		await this.ensureInit();
		const conversation = (await this.stores.metadataService.access.canRead(
			chatId,
		))
			? await this.stores.metadataService.conversationRepo.findById({
					id: chatId,
				})
			: undefined;
		if (!conversation) throw new Error(`Chat not found: ${chatId}`);
		return this.toChat(conversation);
	}
}

export default AssistantMetadataService;
