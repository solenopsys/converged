export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const listeners = new Set<(theme: Theme) => void>();

function readTheme(): Theme {
	if (typeof document === "undefined") return "light";
	if (document.documentElement.classList.contains("dark")) return "dark";
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "light" || stored === "dark") return stored;
	} catch {}
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let currentTheme = readTheme();

function applyTheme(theme: Theme): void {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
	root.dataset.theme = theme;
	root.style.colorScheme = theme;
	document.querySelector('meta[name="theme-color"]')?.setAttribute(
		"content",
		theme === "dark" ? "#090a09" : "#f7f7f5",
	);
}

export function getTheme(): Theme {
	if (typeof document !== "undefined") currentTheme = readTheme();
	return currentTheme;
}

export function setTheme(theme: Theme): void {
	currentTheme = theme;
	applyTheme(theme);
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {}
	listeners.forEach((listener) => listener(theme));
}

export function toggleTheme(): void {
	setTheme(currentTheme === "dark" ? "light" : "dark");
}

export function subscribeTheme(listener: (theme: Theme) => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}


export const themeBootstrapScript = `(function(){try{var stored=localStorage.getItem("${STORAGE_KEY}");var dark=stored==="dark"||(stored!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.dataset.theme=dark?"dark":"light";root.style.colorScheme=dark?"dark":"light";}catch(_){}})();`;
