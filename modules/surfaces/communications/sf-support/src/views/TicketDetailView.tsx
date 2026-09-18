import { useUnit } from "effector-preact";
import {
	authToken,
	HeaderPanel,
	ThreadedChat,
	useSurfaceTranslation,
} from "front-core";
import type { Ticket, TicketStatus } from "g-support";
import { type Message, MessageType } from "g-threads";
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
import {
	STATUS_CLASSES,
	SURFACE_ID,
	TICKET_STATUSES,
	TYPE_CLASSES,
} from "../config";
import { $support, ticketChanged } from "../domain-support";
import { supportClient, threadsClient } from "../services";

/**
 * One ticket: its number, what it is, who likes it, and the whole conversation.
 *
 * Everything a ticket carries beyond those fields is a message in the thread —
 * the description, every reply, every file, and the note the system writes when
 * somebody changes the status. There is no attachment table and no event table
 * because there is nothing they would hold that a message does not.
 */
export const TicketDetailView = ({ ticketId }: { ticketId?: string }) => {
	const { t } = useSurfaceTranslation(SURFACE_ID);
	const { isTeam } = useUnit($support);
	const userId = useMemo(() => authToken.payload()?.sub ?? "guest", []);
	const [ticket, setTicket] = useState<Ticket | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const threadRef = useRef("");

	const loadThread = useCallback(async (threadId: string) => {
		threadRef.current = threadId;
		setMessages(await readThreadMessages(threadsClient, threadId));
	}, []);

	const load = useCallback(async () => {
		if (!ticketId) return;
		setLoading(true);
		try {
			const loaded = await supportClient.getTicket(ticketId);
			// `undefined` here is not "missing" — it is also what somebody else's
			// bug looks like, because the service narrows rather than refuses.
			// Both end in the same screen, and saying which it was would leak the
			// existence of a ticket the reader may not see.
			if (!loaded) return;
			setTicket(loaded);
			await loadThread(loaded.threadId);
		} finally {
			setLoading(false);
		}
	}, [loadThread, ticketId]);

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
			if (!ticket) return;
			const posted = await postThreadMessage({
				client: threadsClient,
				threadId: ticket.threadId,
				user: userId,
				text: data,
				known: messages,
			});
			if (!posted) return;
			await loadThread(ticket.threadId);
			// A ticket thread has no membership list — its readers are whoever the
			// ticket is visible to — so this is the unaddressed case, like a forum
			// topic rather than a chat room.
			await publishThreadActivity({
				threadId: ticket.threadId,
				messageId: posted,
				kind: "comment",
				ownerId: ticket.id,
				audience: "scope",
			});
		},
		[loadThread, messages, ticket, userId],
	);

	const toggleVote = useCallback(async () => {
		if (!ticket || busy) return;
		setBusy(true);
		try {
			// There is no "did I vote" question to ask, so the button drives off
			// what came back: `vote` on an already-liked ticket is a no-op that
			// answers with the same count, which reads as "nothing happened".
			const before = ticket.votes;
			const after = await supportClient.vote(ticket.id);
			const next =
				after === before ? await supportClient.unvote(ticket.id) : after;
			const updated = { ...ticket, votes: next };
			setTicket(updated);
			ticketChanged(updated);
		} finally {
			setBusy(false);
		}
	}, [busy, ticket]);

	const setStatus = useCallback(
		async (status: TicketStatus) => {
			if (!ticket || busy) return;
			setBusy(true);
			try {
				const updated = await supportClient.setStatus(ticket.id, status);
				setTicket(updated);
				ticketChanged(updated);
				// The status change is written into the same thread as everything
				// else, so the conversation reads in order instead of being a
				// conversation with an invisible audit log beside it.
				await threadsClient.saveMessage({
					threadId: ticket.threadId,
					user: userId,
					type: MessageType.message,
					data: String(t(`systemMessage.${status}`)),
					timestamp: Date.now(),
				});
				await loadThread(ticket.threadId);
			} finally {
				setBusy(false);
			}
		},
		[busy, loadThread, t, ticket, userId],
	);

	if (!ticket && !loading) {
		return (
			<div class="flex flex-col gap-2 p-4">
				<h2 class="text-sm font-semibold">{String(t("detail.notFound"))}</h2>
				<p class="text-sm text-muted-foreground">
					{String(t("detail.notFoundHint"))}
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{
					title: ticket
						? `#${ticket.number} ${ticket.title}`
						: String(t("detail.loading")),
					actions: [],
				}}
			/>

			{ticket ? (
				<div class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
					<span
						class={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_CLASSES[ticket.type] ?? ""}`}
					>
						{String(t(`type.${ticket.type}`))}
					</span>
					<span
						class={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[ticket.status] ?? ""}`}
					>
						{String(t(`status.${ticket.status}`))}
					</span>

					{/* Only features are voted on. A like on a bug would be a number
					    that orders nothing: bugs are worked in the queue, not ranked. */}
					{ticket.type === "feature" ? (
						<button
							type="button"
							onClick={toggleVote}
							disabled={busy}
							class="rounded border border-border px-2 py-0.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
						>
							{String(t("detail.like"))} · {ticket.votes}
						</button>
					) : null}

					{/* The team's controls. They are hidden rather than disabled for
					    everybody else, because `setStatus` will refuse them anyway and
					    a button that always fails is worse than no button. */}
					{isTeam ? (
						<div class="ml-auto flex items-center gap-1">
							{TICKET_STATUSES.map((status) => (
								<button
									key={status}
									type="button"
									onClick={() => void setStatus(status)}
									disabled={busy || status === ticket.status}
									class="rounded border border-border px-2 py-0.5 text-xs transition-colors hover:bg-accent disabled:opacity-40"
								>
									{String(t(`status.${status}`))}
								</button>
							))}
						</div>
					) : null}
				</div>
			) : null}

			<div className="min-h-0 flex-1">
				<ThreadedChat
					messages={entries}
					isLoading={loading}
					currentResponse=""
					send={send}
					showComposer={Boolean(ticket)}
					placeholder={String(t("composer.reply"))}
					getParentId={(message) => message.beforeId}
					renderMessage={(message: ThreadEntry) => (
						<div class="block w-full space-y-1 text-left">
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
