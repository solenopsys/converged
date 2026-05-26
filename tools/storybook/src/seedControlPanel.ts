import {
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	PackageCheck,
	Ruler,
	Upload,
	Activity,
	Wrench,
} from "lucide-react";
import { createElement } from "react";
import {
	authStateChanged,
	brandingSet,
	langChanged,
	languagesSet,
	loginEnabledSet,
	menuLinksSet,
	panelActionsSet,
	screensSet,
	themeSet,
	type PanelAction,
	type RailScreen,
} from "front-core";

export const defaultActions: PanelAction[] = [
	{ id: "check", icon: createElement(BadgeCheck, { size: 16 }), label: "Check drawing", prompt: "Check this drawing: " },
	{ id: "upload", icon: createElement(Upload, { size: 16 }), label: "Upload file", prompt: "I want to upload a file for review." },
	{ id: "deadline", icon: createElement(CalendarClock, { size: 16 }), label: "Estimate deadline", prompt: "Estimate deadline: " },
	{ id: "quote", icon: createElement(ClipboardCheck, { size: 16 }), label: "Request quote", prompt: "Prepare a quote: " },
	{ id: "material", icon: createElement(PackageCheck, { size: 16 }), label: "Choose material", prompt: "Help me choose material: " },
	{ id: "tolerances", icon: createElement(Ruler, { size: 16 }), label: "Check tolerances", prompt: "Check tolerances: " },
];

export const defaultScreens: RailScreen[] = [
	{ id: "feed", label: "Feed", icon: createElement(Activity, { size: 18 }) },
	{ id: "orders", label: "Orders", icon: createElement(PackageCheck, { size: 18 }) },
	{ id: "ivanov", label: "Ivanov", detail: "turning", icon: createElement(Wrench, { size: 18 }) },
];

export interface SeedOptions {
	theme?: "light" | "dark";
	loginEnabled?: boolean;
	isAuthenticated?: boolean;
}

export function seedControlPanel(opts: SeedOptions = {}) {
	themeSet(opts.theme ?? "dark");
	langChanged("en");
	languagesSet([
		{ code: "en", label: "EN" },
		{ code: "ru", label: "RU" },
	]);
	loginEnabledSet(opts.loginEnabled ?? true);
	authStateChanged(opts.isAuthenticated ?? false);
	brandingSet({
		logoLight: "/landing/header-logo-black.svg",
		logoDark: "/landing/header-logo-white.svg",
		phone: "+7 (800) 555-35-35",
		statusText: "OPEN · UNTIL 18:00",
	});
	menuLinksSet([
		{ label: "Services", href: "#services" },
		{ label: "Pricing", href: "#pricing" },
		{ label: "Contacts", href: "#contacts" },
	]);
	panelActionsSet(defaultActions);
	screensSet(defaultScreens);
}
