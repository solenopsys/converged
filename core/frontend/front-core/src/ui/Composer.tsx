import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { type DictationConfig, getDictationSnapshot, subscribeDictation } from "../call/dictation";
import {
	getWebsiteCallSnapshot,
	subscribeWebsiteCall,
	type WebsiteCallConfig,
} from "../call/web-call";
import { LiveAudioDiagram } from "../audio/LiveAudioDiagram";
import { DictationButton, VoiceCallButton } from "./buttons";


export function Composer({
	id,
	draft,
	inputRef,
	callConfig,
	dictationConfig,
	attach,
	action,
	onDraftChange,
	onFiles,
	onSubmit,
	onFocus,
}: {
	id: string;
	draft: string;
	inputRef: { current: HTMLTextAreaElement | null };
	callConfig: WebsiteCallConfig;
	dictationConfig: DictationConfig;

	attach: (props: { onClick: () => void }) => ComponentChildren;

	action: ComponentChildren;
	onDraftChange: (value: string) => void;
	onFiles: (files: File[]) => void;
	onSubmit: () => void;
	onFocus?: () => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [expanded, setExpanded] = useState(false);

	const dictationBase = useRef("");

	const resize = (target: HTMLTextAreaElement) => {
		target.style.height = "";
		const maxHeight = Number.parseFloat(getComputedStyle(target).maxHeight);
		target.style.height = `${Math.min(target.scrollHeight, maxHeight)}px`;
	};

	const [dictation, setDictation] = useState(getDictationSnapshot);
	// A refused call used to fail in silence: the handset simply never
	// connected and the reason stayed in the gate's log.
	const [call, setCall] = useState(getWebsiteCallSnapshot);
	useEffect(() => subscribeWebsiteCall(setCall), []);

	useEffect(
		() =>
			subscribeDictation((next) => {
				setDictation(next);
				if (next.status === "error" || !next.text) return;
				const base = dictationBase.current;
				onDraftChange(base ? `${base.replace(/\s+$/, "")} ${next.text}` : next.text);
				const input = inputRef.current;
				if (!input) return;
				requestAnimationFrame(() => resize(input));
			}),
		[onDraftChange, inputRef],
	);

	const callHint =
		call.status === "error"
			? `Звонок не начался: ${call.error ?? "неизвестная ошибка"}`
			: call.status === "connecting"
				? "Соединяю звонок…"
				: null;

	const dictationHint =
		dictation.status === "starting"
			? "Подключаю микрофон…"
			: dictation.status === "listening"
				? "Слушаю"
				: dictation.status === "finishing"
					? "Распознаю…"
					: dictation.status === "error"
						? `Диктовка не удалась: ${dictation.error ?? "неизвестная ошибка"}`
						: null;

	// The call owns the line while it is failing: its message is the one the
	// user is waiting for, and dictation is idle in that moment anyway.
	const hint = callHint ?? dictationHint;
	const isError = call.status === "error" || dictation.status === "error";

	return (
		<form
			class={expanded ? "composer is-expanded" : "composer"}
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit();
			}}
		>
			<LiveAudioDiagram />
			{hint ? (
				<p
					class={isError ? "composer-status is-error" : "composer-status"}
					role={isError ? "alert" : "status"}
				>
					{hint}
				</p>
			) : null}
			<VoiceCallButton config={callConfig} />
			<label class="sr-only" for={id}>
				Message
			</label>
			<textarea
				ref={inputRef}
				id={id}
				name="message"
				rows={1}
				maxLength={1000}
				value={draft}
				placeholder="Напиши сообщение"
				autoComplete="off"
				class="composer-input"
				onFocus={onFocus}
				onInput={(event) => {
					const input = event.currentTarget;
					const value = input.value;
					const needsExpandedLayout =
						value.length > 0 &&
						(expanded || value.includes("\n") || input.scrollHeight > input.clientHeight + 1);

					onDraftChange(value);
					setExpanded(needsExpandedLayout);
					requestAnimationFrame(() => resize(input));
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
						event.preventDefault();
						onSubmit();
					}
				}}
			/>
			<DictationButton
				config={dictationConfig}
				onStart={() => {
					dictationBase.current = draft;
				}}
			/>
			{attach({ onClick: () => fileInputRef.current?.click() })}
			<input
				ref={fileInputRef}
				type="file"
				multiple
				class="sr-only"
				onChange={(event) => {
					const input = event.currentTarget;
					onFiles(Array.from(input.files ?? []));
					input.value = "";
				}}
			/>
			{action}
		</form>
	);
}
