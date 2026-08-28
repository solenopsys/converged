import { ArrowDown, Mic, PanelRightClose, PanelRightOpen, Phone, PhoneOff, Square, Upload } from "../icons";
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import {
	type DictationConfig,
	cancelDictation,
	getDictationSnapshot,
	startDictation,
	stopDictation,
	subscribeDictation,
	subscribeDictationLevel,
} from "../call/dictation";
import {
	getWebsiteCallSnapshot,
	hangupWebsiteCall,
	startWebsiteCall,
	subscribeWebsiteCall,
	type WebsiteCallConfig,
} from "../call/web-call";

export { ArrowDown };

const t = translator(CHAT_MESSAGES_NAMESPACE);


export function DictationButton({
	config,
	onStart,
}: {
	config: DictationConfig;

	onStart: () => void;
}) {
	const [dictation, setDictation] = useState(getDictationSnapshot);
	const [level, setLevel] = useState(0);
	// Capture begins on click — the queue in dictation.ts holds everything said
	// while the transport comes up — so the level ring is lit from "starting".
	// The extra spinner only says the channel is not open yet; it stays
	// clickable, a stuck connection has to be escapable.
	const connecting = dictation.status === "starting";
	const recording = dictation.status === "listening";
	const capturing = recording || connecting;
	const busy = dictation.status === "finishing";

	useEffect(() => subscribeDictationLevel(setLevel), []);
	useEffect(() => subscribeDictation(setDictation), []);

	const label = recording
		? t("dictation.buttonStop")
		: connecting
			? t("dictation.buttonCancel")
			: busy
				? t("dictation.buttonBusy")
				: dictation.status === "error"
					? t("dictation.buttonRetry", { reason: dictation.error ?? t("dictation.unknownError") })
					: t("dictation.buttonStart");
	const Icon = capturing ? Square : Mic;

	return (
		<button
			type="button"
			class={
				capturing
					? connecting
						? "composer-cell icon-button dictation-button is-recording is-connecting"
						: "composer-cell icon-button dictation-button is-recording"
					: "composer-cell icon-button dictation-button"
			}
			style={capturing ? { "--hw-mic-level": level.toFixed(2) } : undefined}
			aria-label={label}
			title={label}
			disabled={busy}
			onClick={() => {
				if (recording) void stopDictation();
				else if (connecting) void cancelDictation();
				else {
					onStart();
					void startDictation(config);
				}
			}}
		>
			<Icon aria-hidden="true" size={14} />
		</button>
	);
}


export function VoiceCallButton({ config }: { config: WebsiteCallConfig }) {
	const [call, setCall] = useState(getWebsiteCallSnapshot);
	const active = call.status === "connecting" || call.status === "connected";
	const Icon = active ? PhoneOff : Phone;
	const label =
		call.status === "connecting"
			? t("call.buttonConnecting")
			: active
				? t("call.buttonEnd")
				: call.status === "error"
					? t("call.buttonRetry")
					: t("call.buttonStart");

	useEffect(() => subscribeWebsiteCall(setCall), []);

	return (
		<button
			type="button"
			class={active ? "composer-cell icon-button voice-button is-active" : "composer-cell icon-button voice-button"}
			aria-label={label}
			title={label}
			disabled={call.status === "connecting"}
			onClick={() => {
				if (active) hangupWebsiteCall();
				else void startWebsiteCall(config);
			}}
		>
			<Icon aria-hidden="true" size={14} />
		</button>
	);
}


export function PanelToggle({
	open,
	onClick,
}: {
	open: boolean;
	onClick: () => void;
}) {
	const label = open ? t("panel.collapseChat") : t("panel.openChat");
	const Icon = open ? PanelRightClose : PanelRightOpen;

	return (
		<button
			type="button"
			class="panel-toggle"
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			<Icon aria-hidden="true" size={14} />
		</button>
	);
}


export function AttachButton({
	onClick,
	triggerProps,
}: {
	onClick: () => void;
	triggerProps?: JSX.HTMLAttributes<HTMLButtonElement>;
}) {
	return (
		<button
			{...triggerProps}
			type="button"
			class="composer-cell icon-button"
			aria-label={t("panel.attachFile")}
			onClick={onClick}
		>
			<Upload aria-hidden="true" size={14} />
		</button>
	);
}
