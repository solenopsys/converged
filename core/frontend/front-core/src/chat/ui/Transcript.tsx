import { useUnit } from "effector-preact";
import { useEffect, useRef } from "preact/hooks";
import { chat } from "../store";
import { plannerStepLabel, toolActionLabel } from "./labels";
import { type MagicPrompt, MagicPrompts } from "./MagicPrompts";
import { Message, StreamingMessage } from "./Message";
import { Uploads } from "./Uploads";

export function Transcript({
	magicPrompts = [],
	onMagicPrompt,
}: {
	magicPrompts?: readonly MagicPrompt[];
	onMagicPrompt?: (message: string) => void;
}) {
	const { messages, isLoading, currentResponse, lastToolCallName, activeStep } =
		useUnit(chat().store.$chat);
	const listRef = useRef<HTMLDivElement>(null);
	const stickToBottomRef = useRef(true);

	useEffect(() => {
		const node = listRef.current;
		if (node && stickToBottomRef.current) {
			node.scrollTop = node.scrollHeight;
		}
	}, [messages, currentResponse, isLoading]);

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
				{onMagicPrompt ? (
					<MagicPrompts prompts={magicPrompts} onSubmit={onMagicPrompt} />
				) : null}
				{messages.map((message) => (
					<Message key={message.id} message={message} />
				))}
				{currentResponse ? (
					<StreamingMessage content={currentResponse} />
				) : null}
				{isLoading && !currentResponse ? (
					<div class="panel-message assistant pending">
						<span class="pending-dots" aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
						{activeStep
							? plannerStepLabel(activeStep)
							: toolActionLabel(lastToolCallName)}
					</div>
				) : null}
			</div>
			<Uploads />
		</>
	);
}
