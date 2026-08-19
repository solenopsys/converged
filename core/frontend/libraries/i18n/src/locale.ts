import { createEvent, createStore } from "effector";

export type LocaleConfig = {
	locales: readonly string[];
	defaultLocale: string;
};

let config: LocaleConfig | null = null;

export const localeChanged = createEvent<string>("LOCALE_CHANGED");

export const $locale = createStore<string>("", { name: "LOCALE" }).on(
	localeChanged,
	(_, next) => next,
);

function settings(): LocaleConfig {
	if (!config) {
		throw new Error("[i18n] Not configured: call configureI18n({ locales, defaultLocale })");
	}
	return config;
}

// Which locales exist is delivery config, not a library default.
export function configureI18n(next: LocaleConfig): void {
	if (next.locales.length === 0) {
		throw new Error("[i18n] configureI18n: locales must not be empty");
	}
	if (!next.locales.includes(next.defaultLocale)) {
		throw new Error(
			`[i18n] configureI18n: defaultLocale "${next.defaultLocale}" is not in locales`,
		);
	}
	config = next;
	if (!$locale.getState()) localeChanged(next.defaultLocale);
}

export function supportedLocales(): readonly string[] {
	return settings().locales;
}

export function defaultLocale(): string {
	return settings().defaultLocale;
}

export function isSupported(value: string | undefined | null): boolean {
	return typeof value === "string" && settings().locales.includes(value);
}

export function setLocale(value: string): void {
	if (!isSupported(value)) {
		throw new Error(
			`[i18n] Unsupported locale "${value}"; published: ${supportedLocales().join(", ")}`,
		);
	}
	localeChanged(value);
}

export function locale(): string {
	return $locale.getState() || settings().defaultLocale;
}

export function resetI18nForTests(): void {
	config = null;
	localeChanged("");
}
