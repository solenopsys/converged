import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { translator } from "i18n";
import { type DictationConfig, getDictationSnapshot, subscribeDictation } from "../call/dictation";
import {
	getWebsiteCallSnapshot,
	subscribeWebsiteCall,
	type WebsiteCallConfig,
} from "../call/web-call";
import { LiveAudioDiagram } from "../audio/LiveAudioDiagram";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { DictationButton, VoiceCallButton } from "./buttons";

const t = translator(CHAT_MESSAGES_NAMESPACE);


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
			? t("call.failedToStart", { reason: call.error ?? t("call.unknownError") })
			: call.status === "connecting"
				? t("call.connecting")
				: null;

	const dictationHint =
		dictation.status === "starting"
			? t("dictation.connecting")
			: dictation.status === "listening"
				? t("dictation.listening")
				: dictation.status === "finishing"
					? t("dictation.finishing")
					: dictation.status === "error"
						? t("dictation.failed", { reason: dictation.error ?? t("dictation.unknownError") })
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
				{t("composer.messageLabel")}
			</label>
			<textarea
				ref={inputRef}
				id={id}
				name="message"
				rows={1}
				maxLength={1000}
				value={draft}
				placeholder={t("composer.placeholder")}
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
