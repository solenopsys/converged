import type { CacheAdapter } from "./createServer";

// Shared cache key helpers for gallery static files. Callers must resolve the
// workspace before using the cache; there is no implicit default workspace.

const IMAGE_MIME: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	svg: "image/svg+xml",
	avif: "image/avif",
	ico: "image/x-icon",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	pdf: "application/pdf",
};

export const GALERY_STATIC_CACHE_SEGMENT = "galery-static";

export function imageMimeFromPath(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return IMAGE_MIME[ext] ?? "application/octet-stream";
}

export function galeryStaticCacheKey(
	cache: CacheAdapter,
	workspace: string | undefined,
	path: string,
): string {
	const normalizedWorkspace = workspace?.trim();
	if (!normalizedWorkspace) {
		throw new Error("galery static cache key requires workspace");
	}
	return cache.buildKey(
		GALERY_STATIC_CACHE_SEGMENT,
		normalizedWorkspace,
		path,
	);
}
