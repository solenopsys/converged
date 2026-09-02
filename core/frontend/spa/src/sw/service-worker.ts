/// <reference lib="webworker" />



declare const self: ServiceWorkerGlobalScope;


declare const __BUILD_ID__: string;
declare const __PRECACHE__: string[];

const CACHE = `hw-${__BUILD_ID__}`;
const OFFLINE_DOCUMENT = "/";

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await Promise.all(
				__PRECACHE__.map((url) =>
					cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
				),
			);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name.startsWith("hw-") && name !== CACHE)
					.map((name) => caches.delete(name)),
			);
			await self.clients.claim();
		})(),
	);
});


function isImmutable(pathname: string): boolean {
	return (
		pathname.startsWith("/vendor/") ||
		pathname.startsWith("/assets/")
	);
}

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
}


async function networkFirstDocument(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(OFFLINE_DOCUMENT, response.clone());
		return response;
	} catch (error) {
		const cached =
			(await cache.match(request)) ?? (await cache.match(OFFLINE_DOCUMENT));
		if (cached) return cached;
		throw error;
	}
}

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (request.headers.has("range")) return;
	if (url.pathname.startsWith("/services/") || url.pathname.startsWith("/cache/"))
		return;

	if (request.mode === "navigate") {
		event.respondWith(networkFirstDocument(request));
		return;
	}

	if (isImmutable(url.pathname)) {
		event.respondWith(cacheFirst(request));
	}
});
