import { extname, join, normalize, resolve } from "node:path";
import type { ServerApp, ServerPlugin } from "back-core/server-app";



export interface SpaPluginConfig {
	production?: boolean;

	distDir?: string;
}

const contentTypes: Record<string, string> = {
	".css": "text/css; charset=utf-8",
	".png": "image/png",
	".webmanifest": "application/manifest+json; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".svg": "image/svg+xml; charset=utf-8",
};


const servedRoutes = [
	"/assets/*",
	"/vendor/*",
	"/mf/*",
	"/icons/*",
	"/widget/*",
	"/sw.js",
	"/manifest.webmanifest",
	"/import-map.json",
	"/build-report.json",
	"/embed.html",
];

export default function spaPlugin(config: SpaPluginConfig = {}): ServerPlugin {
	const isProd = config.production ?? (process.env.NODE_ENV === "production");
	// The container passes distDir explicitly. This fallback is for the source
	// dev server only, where this module lives in front/spa/src.
	const root = config.distDir ?? resolve(import.meta.dir, "..", "dist");

	const cacheControl = isProd
		? "public, max-age=31536000, immutable"
		: "no-store";

	let signature = "";
	let pendingBuild: Promise<void> | null = null;

	async function sourceSignature(): Promise<string> {
		const { sourceFiles } = await import("./build");
		return (
			await Promise.all(
				sourceFiles().map(async (path) => {
					const file = Bun.file(path);
					return `${path}:${file.size}:${file.lastModified}`;
				}),
			)
		).join("|");
	}

	async function rebuild(): Promise<void> {
		const nextSignature = await sourceSignature();
		if (nextSignature === signature) return;

		// The slot must be cleared on failure too: otherwise every later request
		// awaits the same rejected promise, and one bad build wedges the dev
		// server until the process is restarted.
		pendingBuild ??= import("./build")
			.then(({ buildApp }) => buildApp())
			.then(() => {
				signature = nextSignature;
			})
			.finally(() => {
				pendingBuild = null;
			});
		await pendingBuild;
	}

	function resolveFile(pathname: string): string | null {
		const target = normalize(join(root, decodeURIComponent(pathname.slice(1))));
		return target.startsWith(`${root}/`) ? target : null;
	}

	return (app: ServerApp) => {
		app.onStart(async () => {
			if (isProd) {
				if (!(await Bun.file(join(root, "build-report.json")).exists())) {
					throw new Error(`[spa] missing prebuilt delivery in ${root}`);
				}
				return;
			}
			await rebuild();
		});

		const serve = async ({ request, set }: { request: Request; set: { status?: number } }) => {
			const url = new URL(request.url);

			if (!isProd) await rebuild();

			const target = resolveFile(url.pathname);
			if (!target) {
				set.status = 403;
				return "Forbidden";
			}

			const file = Bun.file(target);
			if (!(await file.exists())) {
				set.status = 404;
				return "Not Found";
			}

			const supportsBrotli = request.headers.get("accept-encoding")?.includes("br");
			const compressed = Bun.file(`${target}.br`);
			const useBrotli = Boolean(supportsBrotli && (await compressed.exists()));
			const headers = new Headers({
				"cache-control": url.pathname === "/sw.js" ? "no-store" : cacheControl,
				"content-type": contentTypes[extname(target)] ?? "application/octet-stream",
			});
			if (useBrotli) {
				headers.set("content-encoding", "br");
				headers.set("vary", "accept-encoding");
			}

			return new Response(request.method === "HEAD" ? null : useBrotli ? compressed : file, {
				headers,
			});
		};

		for (const route of servedRoutes) app.get(route, serve);

		return app;
	};
}
