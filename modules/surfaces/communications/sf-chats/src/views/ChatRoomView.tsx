import { createEvent } from "effector";
import {
	authToken,
	HeaderPanel,
	ThreadedChat,
	useSurfaceTranslation,
} from "front-core";
import { executeOperation } from "front-core/object-runtime";
import type { ChatRoom } from "g-chats";
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
import { chatsClient, threadsClient } from "../services";

type Props = { roomId?: string };

/**
 * `HeaderPanel` actions fire an effector event rather than a callback, so the
 * button is declared once here instead of rebuilt on every render.
 */
const membersRequested = createEvent<{ roomId: string; title?: string }>();

membersRequested.watch(({ roomId, title }) => {
	void executeOperation({
		operationId: "chats.chat.members",
		references: [{ kind: "object", type: "chats.chat", id: roomId, title }],
		source: "user",
	});
});

/**
 * One room's conversation and nothing else. Members are a tab of their own,
 * reached by the header action below; the room list is the tab this was opened
 * from.
 *
 * Messages arrive over Fujin's business channel. The writer addresses the
 * room's members by name, because it is the only party that knows them:
 * `rp-threads` does not know whose thread it holds, and asking `rp-chats` from
 * inside it would be a call between repositories.
 */
export const ChatRoomView = ({ roomId }: Props) => {
	const { t } = useSurfaceTranslation("sf-chats");
	const userId = useMemo(() => authToken.payload()?.sub ?? "guest", []);
	const [room, setRoom] = useState<ChatRoom | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(true);
	const threadRef = useRef("");
	/** Who to notify. Loaded once with the room, refreshed when membership changes. */
	const membersRef = useRef<string[]>([]);

	const loadThread = useCallback(async (threadId: string) => {
		threadRef.current = threadId;
		setMessages(await readThreadMessages(threadsClient, threadId));
	}, []);

	const load = useCallback(async () => {
		if (!roomId) return;
		setLoading(true);
		try {
			const loaded = await chatsClient.getRoom(roomId);
			if (!loaded) return;
			setRoom(loaded);
			const members = await chatsClient.listRoomUsers(roomId).catch(() => []);
			membersRef.current = members.map((member) => member.userId);
			await loadThread(loaded.threadId);
		} finally {
			setLoading(false);
		}
	}, [loadThread, roomId]);

	useEffect(() => {
		void load();
	}, [load]);

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
			if (!room) return;
			const posted = await postThreadMessage({
				client: threadsClient,
				threadId: room.threadId,
				user: userId,
				text: data,
				known: messages,
			});
			if (!posted) return;
			await loadThread(room.threadId);
			// One push per member, and never to the whole tenant: a room's
			// existence is not public even when its contents stay behind the read
			// predicate. The author is skipped — this tab already has the message.
			await publishThreadActivity({
				threadId: room.threadId,
				messageId: posted,
				kind: "chat",
				ownerId: room.id,
				audience: membersRef.current,
				self: userId,
			});
		},
		[loadThread, messages, room, userId],
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{
					title: room?.title || String(t("title")),
					actions: roomId
						? [
								{
									id: "chats.chat.members",
									label: String(t("members")),
									event: membersRequested,
									payload: { roomId, title: room?.title },
									variant: "outline" as const,
								},
							]
						: [],
				}}
			/>
			<div className="min-h-0 flex-1">
				<ThreadedChat
					messages={entries}
					isLoading={loading}
					currentResponse=""
					send={send}
					showComposer={Boolean(room)}
					placeholder={String(t("composer.placeholder"))}
					getParentId={() => undefined}
					renderMessage={(message: ThreadEntry) => (
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
