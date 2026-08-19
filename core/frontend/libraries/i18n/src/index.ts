// Localization mechanism: current locale, message catalog, key -> string.
// Where messages come from is not its business — the source is plugged in from
// outside (setMessageSource), so a JSON store like ms-struct is one option.
// A library, not part of the shell core: the widget and microfrontends need it too.

export type { MessageParams } from "./format";
export { interpolate } from "./format";
export type { MessageSource, Messages } from "./catalog";
export {
	$messages,
	$translation,
	loadMessages,
	registerMessages,
	setMessageSource,
	translate,
	translator,
} from "./catalog";
export type { LocaleConfig } from "./locale";
export {
	$locale,
	configureI18n,
	defaultLocale,
	isSupported,
	locale,
	localeChanged,
	setLocale,
	supportedLocales,
} from "./locale";
