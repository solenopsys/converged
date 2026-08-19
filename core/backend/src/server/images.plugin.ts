import { createGaleryServiceClient } from "g-galery";
import { createServerNrpcClientConfig } from "./fujin-services";
import { resolveRequestScopeFromRequest } from "../request-context";
import type { CacheAdapter } from "./createServer";
import { imageMimeFromPath } from "./galery-cache";
import { ServerApp, tryServeStatic } from "./server-app";

export type ImagesPluginOptions = {
	cache?: CacheAdapter;
	cacheControl?: string;
	// The pinned storage scope for mono/multi deployments, where no edge scope
	// middleware exists. Used when the request carries no scope header.
	fallbackScope?: string;
	// Local public assets take precedence over gallery storage. This keeps
	// bundled SVGs and images available in dev and in a production UI image.
	fallbackDir?: string;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

const parseRange = (
	rangeHeader: string | null,
	size: number,
): { start: number; end: number } | "invalid" | null => {
	if (!rangeHeader) return null;

	const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
	if (!match) return "invalid";

	const [, rawStart, rawEnd] = match;
	if (!rawStart && !rawEnd) return "invalid";

	if (!rawStart) {
		const suffixLength = Number.parseInt(rawEnd, 10);
		if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid";
		return { start: Math.max(size - suffixLength, 0), end: size - 1 };
	}

	const start = Number.parseInt(rawStart, 10);
	const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;
	if (
		!Number.isFinite(start) ||
		!Number.isFinite(end) ||
		start < 0 ||
		end < start ||
		start >= size
	) {
		return "invalid";
	}

	return { start, end: Math.min(end, size - 1) };
};

function responseForBytes(
	bytes: Uint8Array,
	path: string,
	rangeHeader: string | null,
	cacheControl: string,
): Response {
	const range = parseRange(rangeHeader, bytes.byteLength);
	const headers = new Headers({
		"Content-Type": imageMimeFromPath(path),
		"Cache-Control": cacheControl,
		"Accept-Ranges": "bytes",
	});

	if (range === "invalid") {
		headers.set("Content-Range", `bytes */${bytes.byteLength}`);
		headers.set("Content-Length", "0");
		return new Response(new Uint8Array(), { status: 416, headers });
	}

	if (range) {
		const chunk = bytes.slice(range.start, range.end + 1);
		headers.set(
			"Content-Range",
			`bytes ${range.start}-${range.end}/${bytes.byteLength}`,
		);
		headers.set("Content-Length", String(chunk.byteLength));
		return new Response(toArrayBuffer(chunk), { status: 206, headers });
	}

	headers.set("Content-Length", String(bytes.byteLength));
	return new Response(toArrayBuffer(bytes), { headers });
}

export function createRuntimeImagesPlugin(options: ImagesPluginOptions) {
	const imageCacheControl = options.cacheControl || "public, max-age=300";

	return new ServerApp().get("/images/*", async ({ request, set }) => {
		if (options.fallbackDir) {
			const local = await tryServeStatic(options.fallbackDir, new URL(request.url).pathname, {
				"Cache-Control": imageCacheControl,
			});
			if (local) return local;
		}

		const pathname = new URL(request.url).pathname;
		const rest = decodeURIComponent(pathname.slice("/images/".length));
		if (!rest || rest.includes("..")) {
			set.status = 400;
			return "Bad request";
		}

		const workspace = resolveRequestScopeFromRequest(
			request,
			options.fallbackScope,
		);
		if (!workspace) {
			set.status = 421;
			return `Unknown storage: missing storage scope header for host "${new URL(request.url).host}"`;
		}

		if (!options.cache) {
			set.status = 503;
			return "Cache is not configured";
		}

		const galery = createGaleryServiceClient(
			createServerNrpcClientConfig(),
		);
		let ref: Awaited<ReturnType<typeof galery.ensureStaticCached>>;
		try {
			ref = await galery.ensureStaticCached(rest);
		} catch (error) {
			console.error(`[images] galery.ensureStaticCached failed for ${rest}`, error);
			set.status = 502;
			return "Gallery service is unavailable";
		}
		if (
			!ref ||
			typeof ref.cacheKey !== "string" ||
			!ref.cacheKey.startsWith(`${options.cache.keyPrefix}:`)
		) {
			set.status = 502;
			return "Gallery returned an invalid cache reference";
		}

		const bytes = await options.cache.getBytes(ref.cacheKey).catch(() => null);
		if (!bytes) {
			set.status = 404;
			return "Cache entry not found";
		}
		return responseForBytes(
			bytes,
			rest,
			request.headers.get("range"),
			imageCacheControl,
		);
	});
}
