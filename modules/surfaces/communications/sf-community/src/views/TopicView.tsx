import {
	authToken,
	HeaderPanel,
	ThreadedChat,
	useSurfaceTranslation,
} from "front-core";
import type { CommunityTopic } from "g-community";
import type { Message } from "g-threads";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/compat";
import {
	mapThreadMessages,
	postThreadMessage,
	publishThreadActivity,
	readThreadMessages,
	type ThreadEntry,
	watchThread,
} from "threads-state";
import { communityClient, threadsClient } from "../services";

/**
 * One topic: its posts and a box to add one. Nothing else — the section tree
 * and the topic table are their own tabs.
 *
 * The feed is live over Fujin's business channel rather than polled. The page
 * it replaced ran two five-second `setInterval`s, which is both a visible delay
 * and steady background load on every open tab.
 */
export const TopicView = ({ topicId }: { topicId?: string }) => {
	// The author is whoever the token says, and the server stamps it anyway.
	// This is only for rendering "you" correctly; the previous view read it out
	// of `__SF_ENV__`, a browser global, and sent it as the message author.
	const { t } = useSurfaceTranslation("sf-community");
	const userId = useMemo(() => authToken.payload()?.sub ?? "guest", []);
	const [topic, setTopic] = useState<CommunityTopic | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [replyTo, setReplyTo] = useState<string>();
	const [loading, setLoading] = useState(true);
	// Kept in a ref so the live subscription below does not have to be torn
	// down and re-established every time a message lands.
	const threadRef = useRef("");

	const loadThread = useCallback(async (threadId: string) => {
		threadRef.current = threadId;
		setMessages(await readThreadMessages(threadsClient, threadId));
	}, []);

	const load = useCallback(async () => {
		if (!topicId) return;
		setLoading(true);
		try {
			const loaded = await communityClient.readTopic(topicId);
			if (!loaded) return;
			setTopic(loaded);
			await loadThread(loaded.threadId);
		} finally {
			setLoading(false);
		}
	}, [loadThread, topicId]);

	useEffect(() => {
		void load();
	}, [load]);

	// A push tells us a thread moved; it never carries the text. We re-read the
	// thread, where the server decides what this reader may see. `null` is the
	// reconnect signal, which re-reads for the same reason.
	useEffect(
		() =>
			watchThread({
				threadId: () => threadRef.current,
				onChange: () => {
					if (threadRef.current) void loadThread(threadRef.current);
				},
			}),
		[loadThread],
	);

	const entries = useMemo(() => mapThreadMessages(messages), [messages]);

	const send = useCallback(
		async (data: string) => {
			if (!topic || topic.isLocked) return;
			const posted = await postThreadMessage({
				client: threadsClient,
				threadId: topic.threadId,
				user: userId,
				text: data,
				beforeId: replyTo,
				known: messages,
			});
			if (!posted) return;
			setReplyTo(undefined);
			// Bumps the topic so the section list orders by real activity, and
			// refuses a locked topic — the one place a lock can be enforced,
			// since `rp-threads` does not know topics exist.
			await communityClient.touchTopicActivity(topic.id);
			await loadThread(topic.threadId);
			// A forum topic has no membership list — its readers are whoever has
			// it open — so this is the unaddressed case the push router provides
			// for. A chat room is not: there the members are named one by one.
			await publishThreadActivity({
				threadId: topic.threadId,
				messageId: posted,
				kind: "forum",
				ownerId: topic.id,
				audience: "scope",
			});
		},
		[loadThread, messages, replyTo, topic, userId],
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{ title: topic?.title ?? String(t("title")), actions: [] }}
			/>
			<div className="min-h-0 flex-1">
				<ThreadedChat
					messages={entries}
					isLoading={loading}
					currentResponse=""
					send={send}
					showComposer={Boolean(topic) && !topic?.isLocked}
					placeholder={String(
						t(
							topic?.isLocked
								? "composer.locked"
								: replyTo
									? "composer.reply"
									: "composer.post",
						),
					)}
					getParentId={(message) => message.beforeId}
					renderMessage={(message: ThreadEntry) => (
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
