import { HeaderPanel, ThreadedChat } from "front-core";
import { type Message, MessageType } from "g-threads";
import { useCallback, useEffect, useMemo, useState } from "preact/compat";
import { chatsClient, threadsClient } from "../services";

type Props = { roomId?: string };

function currentUserId(): string {
	const environment = (globalThis as { __MF_ENV__?: Record<string, unknown> })
		.__MF_ENV__;
	const chats = (environment?.["mf-chats"] ?? {}) as { userId?: string };
	return chats.userId ?? "guest";
}

export const ChatRoomView = ({ roomId }: Props) => {
	const userId = useMemo(currentUserId, []);
	const [title, setTitle] = useState("Chat");
	const [threadId, setThreadId] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		if (!roomId) return;
		setLoading(true);
		try {
			const room = await chatsClient.getRoom(roomId);
			if (!room) return;
			setTitle(room.title || "Chat");
			setThreadId(room.threadId);
			setMessages(await threadsClient.readThread(room.threadId));
		} finally {
			setLoading(false);
		}
	}, [roomId]);

	useEffect(() => {
		void load();
	}, [load]);

	const send = useCallback(
		async (data: string) => {
			const text = data.trim();
			if (!text || !threadId) return;
			const last = messages.reduce<Message | undefined>(
				(latest, message) =>
					!latest || (message.timestamp ?? 0) > (latest.timestamp ?? 0)
						? message
						: latest,
				undefined,
			);
			await threadsClient.saveMessage({
				threadId,
				beforeId: last?.id,
				user: userId,
				type: MessageType.message,
				data: text,
			});
			await load();
		},
		[load, messages, threadId, userId],
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel config={{ title, actions: [] }} />
			<div className="min-h-0 flex-1">
				<ThreadedChat
					messages={messages.map((message) => ({
						id: message.id ?? "",
						user: message.user,
						content: message.data,
						timestamp: message.timestamp ?? 0,
					}))}
					isLoading={loading}
					currentResponse=""
					send={send}
					showComposer={Boolean(threadId)}
					placeholder="Write a message..."
					getParentId={() => undefined}
					renderMessage={(message) => (
						<div className="space-y-1">
							<div className="text-xs text-muted-foreground">
								{message.user}
							</div>
							<div>{message.content}</div>
						</div>
					)}
				/>
			</div>
		</div>
	);
};
