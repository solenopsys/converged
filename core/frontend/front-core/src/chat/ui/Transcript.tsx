import { useUnit } from "effector-preact";
import { useEffect, useRef } from "preact/hooks";
import { chat } from "../store";
import { toolActionLabel } from "./labels";
import { Message, StreamingMessage } from "./Message";
import { Uploads } from "./Uploads";


export function Transcript() {
	const { messages, isLoading, currentResponse, lastToolCallName } = useUnit(
		chat().store.$chat,
	);
	const listRef = useRef<HTMLDivElement>(null);
	const stickToBottomRef = useRef(true);

	useEffect(() => {
		const node = listRef.current;
		if (node && stickToBottomRef.current) {
			node.scrollTop = node.scrollHeight;
		}
	}, [messages, currentResponse, isLoading]);

	const empty = messages.length === 0 && !isLoading && !currentResponse;

	return (
		<>
			<div
				ref={listRef}
				aria-live="polite"
				aria-relevant="additions"
				class="panel-messages"
				onScroll={(event) => {
					const node = event.currentTarget;
					stickToBottomRef.current =
						node.scrollHeight - node.scrollTop - node.clientHeight < 24;
				}}
			>
				{empty ? <p class="empty-message">ready when you are</p> : null}
				{messages.map((message) => (
					<Message key={message.id} message={message} />
				))}
				{currentResponse ? <StreamingMessage content={currentResponse} /> : null}
				{isLoading && !currentResponse ? (
					<div class="panel-message assistant pending">
						<span class="pending-dots" aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
						{toolActionLabel(lastToolCallName)}
					</div>
				) : null}
			</div>
			<Uploads />
		</>
	);
}
