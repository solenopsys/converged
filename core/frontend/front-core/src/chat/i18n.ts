import {
	configureI18n,
	loadMessages,
	registerMessages,
	setLocale,
	setMessageSource,
} from "i18n";

// Plugs the i18n mechanism into a concrete source: ms-struct records
// `<locale>/<namespace>.json`. Swapping the store means changing this file only.

export const CHAT_MESSAGES_NAMESPACE = "chat";

const LOCALES = ["en", "ru", "de", "fr", "es", "it", "pt"] as const;
const DEFAULT_LOCALE = "en";
const DEFAULT_MESSAGES = {
	step: { thinking: "Thinking...", acting: "Working..." },
	tool: { checkUploads: "Checking uploads" },
	shell: {
		guestStatus: "Guest",
		authenticatedStatus: "Signed in",
		logout: "Log out",
	},
	tab: {
		pin: "Pin",
		unpin: "Unpin",
		close: "Close",
		closeUnpinned: "Close unpinned",
		pinTab: "Pin tab",
		unpinTab: "Unpin tab",
		closeTab: "Close tab",
		closeNamed: "Close {title}",
		hiddenCount: "{label}: {count} more",
		hiddenTabs: "Hidden tabs: {count}",
	},
	topbar: {
		interfaceLanguage: "Interface language",
	},
	composer: {
		placeholder: "Write a message",
		messageLabel: "Message",
	},
	call: {
		connecting: "Connecting call…",
		failedToStart: "Call failed to start: {reason}",
		unknownError: "unknown error",
		contextRequired: "Call is not set up: this workspace has no context",
		contextUnavailable: "Call is not set up: the context service is unavailable",
		policyRejected: "Call rejected by policy",
		policyProviderUnavailable: "Voice provider unavailable",
		policyActionUnsupported: "This route does not support calling from the browser",
		missingApiKey: "Voice service is not configured",
		dataChannelUnavailable: "Voice service unavailable",
		buttonConnecting: "Connecting call",
		buttonEnd: "End call",
		buttonRetry: "Retry call",
		buttonStart: "Call",
		levelsCall: "Call audio levels",
		levelsMic: "Microphone level",
		diagramCall: "Call diagram",
		diagramDictation: "Dictation diagram",
	},
	dictation: {
		micUnavailable: "Microphone unavailable in this browser",
		connectionFailed: "Could not establish audio connection",
		noAnswerSdp: "Resonus did not return dictation SDP",
		connecting: "Connecting microphone…",
		listening: "Listening",
		finishing: "Recognizing…",
		failed: "Dictation failed: {reason}",
		unknownError: "unknown error",
		buttonStop: "Stop dictation",
		buttonCancel: "Recording, channel connecting — cancel",
		buttonBusy: "Recognizing",
		buttonRetry: "Retry dictation: {reason}",
		buttonStart: "Dictate message",
	},
	panel: {
		collapseChat: "Collapse chat",
		openChat: "Open chat",
		attachFile: "Attach file",
	},
	uploads: {
		statusUploading: "Uploading",
		statusPaused: "Paused",
		statusError: "Error",
		statusUploaded: "Done",
		pause: "Pause",
		resume: "Resume",
		retry: "Retry",
		cancel: "Cancel",
	},
	table: {
		openMenu: "Open menu",
		yes: "Yes",
		no: "No",
		noData: "No data found",
		loading: "Loading...",
		selected: "Selected: {selected} of {total}",
		clearSelection: "Clear selection",
		actions: "Actions",
		select: "Select",
	},
	model3d: {
		loadingViewer: "Loading viewer...",
		loadingModel: "Loading model...",
	},
	statCard: {
		loadingConfig: "Loading card configuration...",
		configNotFound: "Card configuration not found",
	},
};

export type MessagesReader = (path: string) => Promise<unknown>;

function isMissingMessageRecord(error: unknown): boolean {
	if (error instanceof Error && error.message.includes("NOT_FOUND")) return true;
	if (!error || typeof error !== "object") return false;
	const code = (error as { code?: unknown; errorCode?: unknown }).code ??
		(error as { errorCode?: unknown }).errorCode;
	return code === "NOT_FOUND";
}

export function initChatMessages(read: MessagesReader, language: string): void {
	configureI18n({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE });
	registerMessages(CHAT_MESSAGES_NAMESPACE, DEFAULT_LOCALE, DEFAULT_MESSAGES);

	setMessageSource(async (namespace, forLocale) => {
		try {
			const record = await read(`${forLocale}/${namespace}.json`);
			return record && typeof record === "object"
				? (record as Record<string, unknown>)
				: undefined;
		} catch (error) {
			if (isMissingMessageRecord(error)) return undefined;
			throw error;
		}
	});

	if ((LOCALES as readonly string[]).includes(language)) setLocale(language);
	else console.warn(`[chat] Unpublished locale "${language}"; using ${DEFAULT_LOCALE}`);

	// Needed by the first transcript render, not by page start.
	void loadMessages(CHAT_MESSAGES_NAMESPACE).catch((error) =>
		console.warn("[chat] Messages unavailable:", error),
	);
}
