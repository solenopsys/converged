import React from "preact/compat";
import { cn } from "../../lib/utils";
import { ThreadedChat } from "./ThreadedChat";
import type { ThreadMessageBase } from "./types";

// Styling lives in ThreadView.css, layered into assets/sf.css by
// spa/src/build/styles.ts (buildSurfaceStyles).

export type ThreadViewMessage = ThreadMessageBase & {
	user?: string;
	data?: string;
	content?: string;
};

type ThreadViewProps<TMessage extends ThreadViewMessage> = {
	messages: TMessage[];
	isLoading?: boolean;
	currentUserId?: string;
	className?: string;
	emptyText?: string;
	loadingText?: string;
	getContent?: (message: TMessage) => string;
	getUserId?: (message: TMessage) => string | undefined;
	getParentId?: (message: TMessage) => string | undefined;
	getTimestamp?: (message: TMessage) => number | undefined;
};

export function ThreadView<TMessage extends ThreadViewMessage>({
	messages,
	isLoading = false,
	currentUserId,
	className,
	emptyText = "No messages yet.",
	loadingText = "Loading messages...",
	getContent = (message) => message.content ?? message.data ?? "",
	getUserId = (message) => message.user,
	getParentId,
	getTimestamp,
}: ThreadViewProps<TMessage>) {
	return (
		<ThreadedChat
			className={cn("tv-container", className)}
			messages={messages}
			isLoading={isLoading}
			currentResponse=""
			send={() => {}}
			showComposer={false}
			getParentId={getParentId}
			getTimestamp={getTimestamp}
			renderMessage={(message) => {
				const userId = getUserId(message);
				const own = Boolean(currentUserId) && userId === currentUserId;
				const content = getContent(message);

				return (
					<div className={cn("tv-message-row", own ? "tv-message-row-own" : "tv-message-row-peer")}>
						<div className={own ? "tv-own-bubble" : "tv-peer-bubble"}>
							{!own && userId ? <div className="tv-author">{userId}</div> : null}
							<div className="tv-content">{content}</div>
						</div>
					</div>
				);
			}}
			renderLoading={() => <div className="tv-loading">{loadingText}</div>}
			intro={<div className="tv-empty">{emptyText}</div>}
		/>
	);
}

export type { ThreadViewProps };
