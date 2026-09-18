/**
 * The shared actions stories are built from.
 *
 * Each one is a thing a person does in the application, expressed through what
 * they can see — roles and accessible names, not CSS classes or store state — so
 * a story keeps passing through a restyle and fails when the path itself breaks.
 * Runs inside the Playwright worker (Node).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, type Locator, type Page } from "@playwright/test";

const run = promisify(execFile);

const SESSION_SCRIPT = resolve(import.meta.dirname, "session.ts");

export const CONSOLE_PATH = "/console/";

export type Role =
	| "guest"
	| "root"
	| "owner"
	| "manager"
	| "operator"
	| "viewer";

export type SignIn = (
	role: Role,
	options?: { returnTo?: string },
) => Promise<void>;

/**
 * Sign in the way a person does after opening the letter.
 *
 * The link is minted by `session.ts` (see there for why it is a Bun child) and
 * followed in this page, so the refresh cookie lands in the story's own
 * isolated browser context and the SPA picks the session up on its own.
 */
export function signInWith(page: Page): SignIn {
	return async (role, options = {}) => {
		const returnTo = options.returnTo ?? CONSOLE_PATH;
		if (role === "guest") {
			await page.goto(returnTo);
			return;
		}
		let stdout: string;
		try {
			({ stdout } = await run(
				"bun",
				["run", SESSION_SCRIPT, "--role", role, "--return-to", returnTo],
				{ env: process.env, timeout: 60_000 },
			));
		} catch (error) {
			const stderr = (error as { stderr?: string }).stderr?.trim();
			throw new Error(
				`[verify] cannot sign in as ${role}: ${stderr || String(error)}`,
			);
		}
		// The nrpc runtime announces itself on stdout; the answer is the last line.
		const { token } = JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}");
		await navigate(page, `/auth/verify?token=${encodeURIComponent(token)}`);
		await signedIn(page);
		if (returnTo.startsWith(CONSOLE_PATH)) await consoleReady(page);
	};
}

/**
 * Load a page and stay until it has exchanged the refresh cookie.
 *
 * Every load of the SPA calls `/auth/session`, which rotates the refresh token
 * on the server. A navigation that aborts that response leaves the browser
 * holding the spent token, and the next load comes up as a guest. The shell
 * renders before the exchange ends, so no visible element is a safe signal —
 * the response itself is.
 */
async function navigate(page: Page, url: string): Promise<void> {
	const exchanged = page.waitForResponse((response) =>
		new URL(response.url()).pathname.endsWith("/auth/session"),
	);
	await page.goto(url);
	await exchanged;
}

/** The session the page holds belongs to a user, not a guest. */
async function signedIn(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const token = window.localStorage.getItem("authToken");
		if (!token) return false;
		try {
			const payload = JSON.parse(
				atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
			);
			return (
				typeof payload.sub === "string" && !payload.sub.startsWith("temp:")
			);
		} catch {
			return false;
		}
	});
}

/**
 * The console shell has mounted. Not the Sections tab row: on an empty home it
 * exists but has no tabs, and an empty row is not visible.
 */
async function consoleReady(page: Page): Promise<void> {
	await expect(
		page.getByRole("button", { name: "All sections" }),
	).toBeVisible();
}

export type Workspace = {
	/**
	 * Go to `/console/<surface>/<projection>/<objectId>` — the console is
	 * addressed by URL, so a story lands where it means to instead of clicking
	 * its way there through menus it is not testing.
	 */
	open(surface: string, ...path: string[]): Promise<void>;
	/** The top row of open surfaces. */
	sections: Locator;
	section(name: string | RegExp): Locator;
	/** The row of views inside the current surface. */
	views: Locator;
	view(name: string | RegExp): Locator;
};

export function workspaceOf(page: Page): Workspace {
	const sections = page.getByRole("tablist", { name: "Sections" });
	const views = page.getByRole("tablist", { name: "In this section" });
	return {
		async open(surface, ...path) {
			const tail = [surface.replace(/^sf-/, ""), ...path]
				.map(encodeURIComponent)
				.join("/");
			await navigate(page, `${CONSOLE_PATH}${tail}`);
			await signedIn(page);
			await consoleReady(page);
		},
		sections,
		section: (name) => sections.getByRole("tab", { name }),
		views,
		view: (name) => views.getByRole("tab", { name }),
	};
}

export function uniqueName(prefix: string, workerIndex: number): string {
	return `${prefix}-${Date.now().toString(36)}-${workerIndex}`;
}

export type Asset = (name: string) => string;

export function assetOf(specFile: string): Asset {
	return (name) => {
		const path = join(dirname(specFile), "assets", name);
		if (!existsSync(path)) throw new Error(`[verify] no asset ${path}`);
		return path;
	};
}
