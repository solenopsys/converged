"use client";

import { KeyRound } from "lucide-react";

const COPY: Record<string, { title: string; subtitle: string }> = {
	en: {
		title: "Sign in to continue",
		subtitle: "Use the panel on the side to sign in and open the console.",
	},
	ru: {
		title: "Войдите, чтобы продолжить",
		subtitle: "Авторизуйтесь на панели сбоку, чтобы открыть консоль.",
	},
};

function resolveLocale(): string {
	if (typeof document === "undefined") return "en";
	const fromPath = window.location.pathname.match(
		/^\/([a-z]{2})(?:\/|$)/i,
	)?.[1];
	const lang = (
		fromPath ||
		document.documentElement.lang ||
		"en"
	).toLowerCase();
	return COPY[lang] ? lang : "en";
}

/**
 * Center placeholder shown on /console when the visitor is not authenticated.
 * The actual sign-in form is presented in the side panel; this is just a splash.
 */
export function ConsoleAuthSplash() {
	const copy = COPY[resolveLocale()] ?? COPY.en;
	return (
		<div className="flex h-full w-full items-center justify-center p-8">
			<div className="flex max-w-sm flex-col items-center gap-4 text-center">
				<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<KeyRound size={24} />
				</div>
				<h2 className="font-semibold text-foreground text-xl">{copy.title}</h2>
				<p className="text-muted-foreground text-sm">{copy.subtitle}</p>
			</div>
		</div>
	);
}
