export type PaginationParams = {
	offset: number;
	limit: number;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type Chat = {
	id: string;
	name: string;
	description: string;
	threadId?: string;
	messagesCount?: number;
	filesCount?: number;
	filesSize?: number;
	createdAt?: number;
	updatedAt?: number;
};

export interface AssistantService {
	listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
	registerChat(threadId: string, title?: string): Promise<Chat>;
	recordChatMessage(threadId: string): Promise<Chat>;
	recordChatFile(threadId: string, fileSize?: number): Promise<Chat>;
	deleteChat(chatId: string): Promise<void>;
	getChat(chatId: string): Promise<Chat>;
}
