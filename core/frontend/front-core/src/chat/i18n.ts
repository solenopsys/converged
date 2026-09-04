import {
	configureI18n,
	loadMessages,
	registerMessages,
	setLocale,
	setMessageSource,
} from "i18n";
import { $activeLocale, LocaleController } from "../i18n";

// The shell has bundled chat messages. A host may additionally provide records
// at `<locale>/<namespace>.json`, but their absence must never block the chat.

export const CHAT_MESSAGES_NAMESPACE = "chat";

const LOCALES = ["en", "ru", "de", "fr", "es", "it", "pt"] as const;
const DEFAULT_LOCALE = "en";
const DEFAULT_MESSAGES = {
	step: {
		thinking: "Thinking...",
		acting: "Working...",
		route: "Understanding request...",
		search: "Finding available action...",
		select: "Choosing action...",
		describe: "Loading available filters...",
		args: "Preparing query...",
		invoke: "Running action...",
	},
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
		contextUnavailable:
			"Call is not set up: the context service is unavailable",
		policyRejected: "Call rejected by policy",
		policyProviderUnavailable: "Voice provider unavailable",
		policyActionUnsupported:
			"This route does not support calling from the browser",
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
	statistics: {
		empty: "No statistics published yet.",
		loadingSection: "Loading charts...",
		allHidden: "Every chart in this section is hidden.",
		widgetUnavailable: "This chart did not register a component.",
		hideWidget: "Hide {title}",
		loadingSummary: "Loading summary...",
		restoreHidden: "Restore {count} hidden",
	},
	toolCall: {
		kind: "Function",
		stepModule: "Section",
		stepFunction: "Function",
		noteWidened: "no match in this section — searched everything",
		noteApproximate: "no exact match — nearest offered",
		alsoOffered: "also offered: {options}",
		noAlternatives: "no alternatives",
		statusRunning: "Running",
		statusFailed: "Failed",
		statusCompleted: "Done",
	},
};

const RU_MESSAGES = {
	toolCall: {
		kind: "Функция",
		stepModule: "Раздел",
		stepFunction: "Функция",
		noteWidened: "в этом разделе совпадений нет — выполнен общий поиск",
		noteApproximate: "точного совпадения нет — выбран ближайший вариант",
		alsoOffered: "другие варианты: {options}",
		noAlternatives: "других вариантов нет",
		statusRunning: "Выполняется",
		statusFailed: "Ошибка",
		statusCompleted: "Готово",
	},
};

// The shell renders components that read this namespace (AppShell, Composer,
// table, ...) before the chat store — and its network-backed catalog — ever
// initializes (that only happens lazily, e.g. on composer focus). Configure
// the namespace with its English defaults eagerly, at import time, so those
// early renders have something to read instead of throwing. Exported so tests
// that reset the (process-wide) i18n singleton can restore this baseline
// afterward for every other module that reads this namespace.
export function bootstrapChatMessagesDefaults(): void {
	configureI18n({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE });
	registerMessages(CHAT_MESSAGES_NAMESPACE, DEFAULT_LOCALE, DEFAULT_MESSAGES);
	registerMessages(CHAT_MESSAGES_NAMESPACE, "ru", RU_MESSAGES);
}
bootstrapChatMessagesDefaults();

let messagesReader: MessagesReader | undefined;

function activateChatLocale(language: string): void {
	if (!(LOCALES as readonly string[]).includes(language)) return;
	setLocale(language);
	if (messagesReader) {
		void loadMessages(CHAT_MESSAGES_NAMESPACE, language).catch((error) =>
			console.warn("[chat] Messages unavailable:", error),
		);
	}
}

// The shell owns the active locale. Keep the older message catalog on that same
// source of truth so changing language updates both shell chrome and MF views.
$activeLocale.watch(activateChatLocale);

export type MessagesReader = (path: string) => Promise<unknown>;

function isMissingMessageRecord(error: unknown): boolean {
	if (error instanceof Error && error.message.includes("NOT_FOUND"))
		return true;
	if (!error || typeof error !== "object") return false;
	const code =
		(error as { code?: unknown; errorCode?: unknown }).code ??
		(error as { errorCode?: unknown }).errorCode;
	return code === "NOT_FOUND";
}

export function initChatMessages(
	read: MessagesReader | undefined,
	language: string,
): void {
	bootstrapChatMessagesDefaults();
	messagesReader = read;

	setMessageSource(
		read
			? async (namespace, forLocale) => {
					try {
						const record = await read(`${forLocale}/${namespace}.json`);
						return record && typeof record === "object"
							? (record as Record<string, unknown>)
							: undefined;
					} catch (error) {
						if (isMissingMessageRecord(error)) return undefined;
						throw error;
					}
				}
			: async () => undefined,
	);

	const initialLocale = LocaleController.getInstance().setLocale(language);
	if (initialLocale) activateChatLocale(initialLocale);
	else
		console.warn(
			`[chat] Unpublished locale "${language}"; using ${DEFAULT_LOCALE}`,
		);

	if (read) {
		// Needed by the first transcript render, not by page start.
		void loadMessages(CHAT_MESSAGES_NAMESPACE, $activeLocale.getState()).catch(
			(error) => console.warn("[chat] Messages unavailable:", error),
		);
	}
}
