import { HeaderPanel, ThreadedChat } from "front-core";
import { type Message, MessageType } from "g-threads";
import { useCallback, useEffect, useMemo, useState } from "preact/compat";
import { communityClient, threadsClient } from "../services";

function currentUserId(): string {
	const environment = (globalThis as { __MF_ENV__?: Record<string, unknown> })
		.__MF_ENV__;
	const community = (environment?.["mf-community"] ?? {}) as {
		userId?: string;
	};
	return community.userId ?? "guest";
}

export const TopicView = ({ topicId }: { topicId?: string }) => {
	const userId = useMemo(currentUserId, []);
	const [title, setTitle] = useState("Forum topic");
	const [threadId, setThreadId] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [replyTo, setReplyTo] = useState<string>();
	const [loading, setLoading] = useState(true);
	const load = useCallback(async () => {
		if (!topicId) return;
		setLoading(true);
		try {
			const topic = await communityClient.readTopic(topicId);
			if (!topic) return;
			setTitle(topic.title);
			setThreadId(topic.threadId);
			setMessages(await threadsClient.readThreadAllVersions(topic.threadId));
		} finally {
			setLoading(false);
		}
	}, [topicId]);
	useEffect(() => {
		void load();
	}, [load]);
	const send = useCallback(
		async (data: string) => {
			const text = data.trim();
			if (!text || !threadId) return;
			await threadsClient.saveMessage({
				threadId,
				beforeId: replyTo,
				user: userId,
				type: MessageType.message,
				data: text,
			});
			setReplyTo(undefined);
			await load();
		},
		[load, replyTo, threadId, userId],
	);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel config={{ title, actions: [] }} />
			<div className="min-h-0 flex-1">
				<ThreadedChat
					messages={messages.map((message) => ({
						id: message.id ?? "",
						beforeId: message.beforeId,
						user: message.user,
						content: message.data,
						timestamp: message.timestamp ?? 0,
					}))}
					isLoading={loading}
					currentResponse=""
					send={send}
					showComposer={Boolean(threadId)}
					placeholder={replyTo ? "Write a reply..." : "Write a post..."}
					renderMessage={(message) => (
						<button
							type="button"
							className="block w-full space-y-1 text-left"
							onClick={() => setReplyTo(message.id)}
						>
							<div className="text-xs text-muted-foreground">
								{message.user}
							</div>
							<div>{message.content}</div>
						</button>
					)}
				/>
			</div>
		</div>
	);
};
