import { combine, createEvent, createStore } from "effector";
import { interpolate, type MessageParams } from "./format";
import { $locale, defaultLocale, locale } from "./locale";

export type Messages = Record<string, unknown>;

export type MessageSource = (
	namespace: string,
	forLocale: string,
) => Promise<Messages | undefined>;

// namespace -> locale -> messages. A namespace is a unit of ownership: the
// shell has one, every surface has its own, and none can clobber another.
type Catalog = Record<string, Record<string, Messages>>;

const messagesRegistered = createEvent<{
	namespace: string;
	locale: string;
	messages: Messages;
}>("MESSAGES_REGISTERED");

const catalogCleared = createEvent<void>("CATALOG_CLEARED");

export const $messages = createStore<Catalog>({}, { name: "MESSAGES" })
	.on(messagesRegistered, (catalog, { namespace, locale: forLocale, messages }) => ({
		...catalog,
		[namespace]: {
			...catalog[namespace],
			[forLocale]: { ...catalog[namespace]?.[forLocale], ...messages },
		},
	}))
	.reset(catalogCleared);

// One subscription for both redraw reasons: locale switch and late namespace.
export const $translation = combine($locale, $messages, (current, catalog) => ({
	locale: current,
	catalog,
}));

let source: MessageSource | null = null;
const pending = new Map<string, Promise<void>>();

export function setMessageSource(next: MessageSource): void {
	source = next;
}

export function registerMessages(
	namespace: string,
	forLocale: string,
	messages: Messages,
): void {
	messagesRegistered({ namespace, locale: forLocale, messages });
}

export function loadMessages(namespace: string, forLocale = locale()): Promise<void> {
	const key = `${forLocale}/${namespace}`;
	let load = pending.get(key);
	if (load) return load;

	if (!source) {
		return Promise.reject(
			new Error("[i18n] No message source: call setMessageSource before loadMessages"),
		);
	}

	load = source(namespace, forLocale)
		.then((messages) => {
			if (messages) registerMessages(namespace, forLocale, messages);
		})
		.catch((error) => {
			pending.delete(key);
			throw error;
		});
	pending.set(key, load);
	return load;
}

function readPath(messages: Messages | undefined, path: string): string | undefined {
	if (!messages) return undefined;
	let current: unknown = messages;
	for (const segment of path.split(".")) {
		if (!current || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return typeof current === "string" ? current : undefined;
}

// Returns the key when nothing matches: an untranslated string must be visible.
export function translate(
	namespace: string,
	key: string,
	params?: MessageParams,
): string {
	const catalog = $messages.getState()[namespace];
	const template =
		readPath(catalog?.[locale()], key) ?? readPath(catalog?.[defaultLocale()], key);
	if (template === undefined) {
		console.warn(`[i18n] Missing message: ${namespace}:${key} (${locale()})`);
		return key;
	}
	return interpolate(template, params);
}

export function translator(namespace: string) {
	return (key: string, params?: MessageParams): string =>
		translate(namespace, key, params);
}

export function resetCatalogForTests(): void {
	source = null;
	pending.clear();
	catalogCleared();
}
