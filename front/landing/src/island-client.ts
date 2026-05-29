import {
	bus,
	ensureSsrCenterRuntime,
	mountSsrMenuShell,
	registry,
	setCenterView,
	switchToAppMode,
	StateStreamView,
	authToken,
} from "front-core";
import { registerIsland } from "front-core";

// ── Landing block islands ─────────────────────────────────────────────────────
// Each island is a lazy ES module that attaches interactivity to SSR-rendered
// DOM without hydration or React.

registerIsland("section-rail", () => import("./islands/section-rail"));
registerIsland("warmup", () => import("./islands/warmup"));
import { createRuntimeGatesServiceClient } from "g-rt-gates";

// App-level bus handlers — registered before any UI mounts
const gatesClient = createRuntimeGatesServiceClient({ baseUrl: "/runtime" });
bus.register({
	id: "auth.send-magic-link",
	description: "Send magic link via runtime",
	invoke: (params: { email: string; returnTo?: string }) =>
		gatesClient.sendMagicLink(params),
});

const OPEN_REQUEST_ACTION = "requests.open";
const REQUESTS_RUNTIME = "mf-requests";
const SSR_RAIL_RESIZER_ID = "ssr-rail-resizer";
const SSR_RAIL_WIDTH_STORAGE_KEY = "ssr_rail_width";
const SSR_RAIL_MIN_WIDTH = 280;
const SSR_RAIL_MAX_WIDTH = 680;
const SSR_RAIL_DEFAULT_WIDTH = 380;
let requestsRuntimePromise: Promise<void> | null = null;

function clampSsrRailWidth(width: number): number {
	return Math.round(
		Math.max(SSR_RAIL_MIN_WIDTH, Math.min(SSR_RAIL_MAX_WIDTH, width)),
	);
}

function getCurrentSsrRailWidth(): number {
	const rail = document.getElementById("ssr-right-rail");
	const rectWidth = rail?.getBoundingClientRect().width ?? 0;
	if (Number.isFinite(rectWidth) && rectWidth > 0) {
		return clampSsrRailWidth(rectWidth);
	}

	const shell = document.getElementById("ssr-shell");
	const raw = window.getComputedStyle(shell ?? document.documentElement)
		.getPropertyValue("--ssr-rail-width")
		.trim();
	const parsed = Number.parseFloat(raw);
	return clampSsrRailWidth(
		Number.isFinite(parsed) ? parsed : SSR_RAIL_DEFAULT_WIDTH,
	);
}

function applySsrRailWidth(width: number, persist = false): number {
	const nextWidth = clampSsrRailWidth(width);
	const value = `${nextWidth}px`;
	document.documentElement.style.setProperty("--ssr-rail-width", value);
	document.getElementById("ssr-shell")?.style.setProperty(
		"--ssr-rail-width",
		value,
	);
	document.getElementById("app-shell")?.style.setProperty(
		"--ssr-rail-width",
		value,
	);

	if (persist) {
		try {
			window.localStorage.setItem(
				SSR_RAIL_WIDTH_STORAGE_KEY,
				String(nextWidth),
			);
		} catch {
			// ignore storage errors
		}
	}

	return nextWidth;
}

function restoreSsrRailWidth(): void {
	try {
		const stored = window.localStorage.getItem(SSR_RAIL_WIDTH_STORAGE_KEY);
		if (!stored) return;
		const parsed = Number.parseFloat(stored);
		if (!Number.isFinite(parsed)) return;
		applySsrRailWidth(parsed);
	} catch {
		// ignore storage errors
	}
}

function installSsrRailResizerFallback(): void {
	const resizer = document.getElementById(
		SSR_RAIL_RESIZER_ID,
	) as HTMLButtonElement | null;
	if (!resizer) return;

	restoreSsrRailWidth();

	if (resizer.dataset.resizeBound === "1") return;
	resizer.dataset.resizeBound = "1";

	resizer.addEventListener("pointerdown", (event) => {
		const shell = document.getElementById("ssr-shell");
		if (!shell || window.matchMedia("(max-width: 980px)").matches) return;
		if (shell.dataset.railOpen !== "1" && shell.dataset.chatFocus !== "1") {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const startX = event.clientX;
		const startWidth = getCurrentSsrRailWidth();
		const previousUserSelect = document.body.style.userSelect;
		const previousCursor = document.body.style.cursor;
		const appShell = document.getElementById("app-shell");

		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";
		shell.dataset.railResizing = "1";
		appShell?.setAttribute("data-rail-resizing", "1");

		try {
			resizer.setPointerCapture(event.pointerId);
		} catch {
			// ignore unsupported pointer capture cases
		}

		const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
			moveEvent.preventDefault();
			applySsrRailWidth(startWidth + moveEvent.clientX - startX);
		};

		const cleanup = () => {
			applySsrRailWidth(getCurrentSsrRailWidth(), true);
			document.body.style.userSelect = previousUserSelect;
			document.body.style.cursor = previousCursor;
			delete shell.dataset.railResizing;
			appShell?.removeAttribute("data-rail-resizing");
			try {
				resizer.releasePointerCapture(event.pointerId);
			} catch {
				// ignore
			}
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
		};

		const onPointerUp = () => cleanup();
		const onPointerCancel = () => cleanup();

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
	});
}

function extractRequestId(pathname: string): string | null {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] === "request" && segments[1]) {
		return decodeURIComponent(segments[1]);
	}
	if (segments[1] === "request" && segments[2]) {
		return decodeURIComponent(segments[2]);
	}
	return null;
}

async function ensureRequestsRuntime(): Promise<void> {
	if (registry.get(OPEN_REQUEST_ACTION)) return;
	if (!requestsRuntimePromise) {
		requestsRuntimePromise = import(REQUESTS_RUNTIME)
			.then((runtime) => {
				if (!registry.get(OPEN_REQUEST_ACTION)) {
					runtime.default?.plug?.(bus);
				}
			})
			.catch((error) => {
				requestsRuntimePromise = null;
				console.error("[landing] failed to load mf-requests", error);
			});
	}
	await requestsRuntimePromise;
}

async function openRequestFromLocation(): Promise<void> {
	const requestId = extractRequestId(window.location.pathname);
	if (!requestId) return;
	await ensureRequestsRuntime();
	await ensureSsrCenterRuntime();
	if (!registry.get(OPEN_REQUEST_ACTION)) return;
	registry.run(OPEN_REQUEST_ACTION, {
		requestId,
		syncUrl: false,
	});
}

async function initStateStream(): Promise<void> {
	if (!authToken.isAuthenticated()) return;
	switchToAppMode();
	setCenterView({ view: StateStreamView as any });
	await ensureSsrCenterRuntime();
}

mountSsrMenuShell();
installSsrRailResizerFallback();
void initStateStream();
window.addEventListener("auth-token-changed", () => { void initStateStream(); });
void openRequestFromLocation();
window.addEventListener("popstate", () => {
	void openRequestFromLocation();
});
