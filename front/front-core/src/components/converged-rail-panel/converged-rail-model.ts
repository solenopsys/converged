import { createEvent, createStore } from "effector";

export const themeToggled = createEvent();
export const langChanged = createEvent<string>();

export const $theme = createStore<"light" | "dark">("dark")
	.on(themeToggled, (current) => (current === "dark" ? "light" : "dark"));

export const $lang = createStore<string>("en")
	.on(langChanged, (_, code) => code);

$theme.watch((theme) => {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark", theme === "dark");
	document.documentElement.style.colorScheme = theme;
	try { localStorage.setItem("theme", theme); } catch {}
});
