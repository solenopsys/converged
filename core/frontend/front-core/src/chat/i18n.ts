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
