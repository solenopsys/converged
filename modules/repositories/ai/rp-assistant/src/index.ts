import type { Chat, PaginatedResult, PaginationParams } from "g-assistant";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-assistant";

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
		const conversations =
			await this.stores.metadataService.conversationRepo.findAll({
				limit: params.limit,
				offset: params.offset,
				orderBy: [{ field: "updatedAt", direction: "desc" }],
			});
		const totalCount =
			await this.stores.metadataService.conversationRepo.count();

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
		);
		return this.toChat(conversation);
	}

	async recordChatMessage(threadId: string): Promise<Chat> {
		await this.ensureInit();
		return this.toChat(
			await this.stores.metadataService.recordMessage(threadId),
		);
	}

	async recordChatFile(threadId: string, fileSize?: number): Promise<Chat> {
		await this.ensureInit();
		return this.toChat(
			await this.stores.metadataService.recordFile(threadId, fileSize),
		);
	}

	async deleteChat(chatId: string): Promise<void> {
		await this.ensureInit();
		await this.stores.metadataService.conversationRepo.delete({ id: chatId });
	}

	async getChat(chatId: string): Promise<Chat> {
		await this.ensureInit();
		const conversation =
			await this.stores.metadataService.conversationRepo.findById({ id: chatId });
		if (!conversation) throw new Error(`Chat not found: ${chatId}`);
		return this.toChat(conversation);
	}
}

export default AssistantMetadataService;
