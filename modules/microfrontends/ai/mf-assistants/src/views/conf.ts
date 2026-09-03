import type { ChatState } from "../components/ChatDetail";

export const mockChatStore: {
	$chat: ChatState;
	send: (content: string) => void;
} = {
	$chat: {
		messages: [
			{
				id: "1",
				type: "user",
				content: "Hi! How are you?",
				timestamp: Date.now() - 60000,
			},
			{
				id: "2",
				type: "assistant",
				content: "Hi! I'm doing great, ready to help with any questions.",
				timestamp: Date.now() - 30000,
			},
		],
		isLoading: false,
		currentResponse: "",
	},
	send: (content: string) => {
		mockChatStore.$chat.messages.push({
			id: String(Date.now()),
			type: "user",
			content,
			timestamp: Date.now(),
		});
	},
};
