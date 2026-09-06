// UI webhooks gateway: the outside world's way into the event bus.
//
// A payment provider, a mail relay or a shipping API cannot hold a cluster JWT
// and cannot speak ZMQ, so they get what they do speak: an HTTP endpoint on the
// UI host. This file is the whole translation — resolve the slug, check the
// signature, publish one business event, answer. It deliberately does no work
// of its own beyond that: whatever the delivery means is decided by whoever
// subscribed to the topic.
//
// The route lives at the server root next to the auth gateway, because a
// producer's configured URL is `/webhooks/<slug>` and nothing else.
import type { PluginConfig } from "back-core";
import type { RouteContext, ServerApp } from "back-core/server-app";
import type { WebhookResolution } from "g-webhooks";
import { busClient, webhooksClient } from "./clients";
import { verifyDelivery } from "./verify";

/** Anything larger is a producer's mistake or an attack, never a webhook. */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * How long a resolved endpoint may be reused without asking the repository.
 *
 * Deliberately short. The window is what a disabled endpoint keeps answering
 * for, and it exists only so a burst from one producer does not become one
 * storage round-trip per delivery.
 */
const RESOLUTION_TTL_SECONDS = 10;

/** Headers worth keeping: routing and signature metadata, never credentials. */
const RECORDED_HEADERS = [
	"content-type",
	"user-agent",
	"x-forwarded-for",
	"x-request-id",
	"x-webhook-signature",
	"x-hub-signature-256",
	"x-github-event",
	"x-amz-sns-message-type",
];

type Cache = {
	buildKey: (...segments: Array<string | number>) => string;
	getJson: <T>(key: string) => Promise<T | null>;
	setJson: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function recordedHeaders(context: RouteContext): Record<string, string> {
	const kept: Record<string, string> = {};
	for (const [key, value] of Object.entries(context.headers)) {
		if (RECORDED_HEADERS.includes(key.toLowerCase())) kept[key.toLowerCase()] = value;
	}
	return kept;
}

function clientIp(context: RouteContext): string | undefined {
	const forwarded = context.headers["x-forwarded-for"];
	return forwarded ? forwarded.split(",")[0]?.trim() : undefined;
}

async function resolveEndpoint(
	slug: string,
	cache: Cache | undefined,
): Promise<WebhookResolution | null> {
	const key = cache?.buildKey("webhook-endpoint", slug);
	if (cache && key) {
		// `null` is cached as well as a hit: an unknown slug is the shape a
		// scanner produces, and it must not cost a lookup every time.
		const cached = await cache
			.getJson<{ value: WebhookResolution | null }>(key)
			.catch(() => null);
		if (cached) return cached.value;
	}

	const resolved = await webhooksClient().resolveEndpoint(slug);
	const value = (resolved ?? null) as WebhookResolution | null;
	if (cache && key) {
		await cache.setJson(key, { value }, RESOLUTION_TTL_SECONDS).catch(() => {});
	}
	return value;
}

/**
 * The delivery log is written after the producer already has its answer, and a
 * failure to write it never changes that answer: a webhook that 500s because
 * the log was busy is a webhook the producer will send again.
 */
function record(
	endpoint: { id: string; provider: string },
	context: RouteContext,
	body: string,
	status: number,
	error?: string,
): void {
	void webhooksClient()
		.recordDelivery({
			endpointId: endpoint.id,
			provider: endpoint.provider,
			method: context.request.method,
			path: new URL(context.request.url).pathname,
			headers: recordedHeaders(context),
			body: body.slice(0, 8192),
			ip: clientIp(context),
			status,
			error,
		})
		.catch((failure) => {
			console.error("[webhooks-gateway] delivery not recorded:", failure);
		});
}

export default function webhooksGatewayPlugin(config: PluginConfig = {} as PluginConfig) {
	const cache = (config as { cache?: Cache }).cache;

	return (app: ServerApp) => {
		app.all("/webhooks/:slug", async (context) => {
			const slug = context.params.slug?.trim();
			if (!slug) return jsonResponse({ error: "not found" }, 404);

			// The raw text, not context.body: an HMAC is over the bytes that
			// arrived, and a parsed-then-restringified body is not those bytes.
			const body = await context.request.clone().text();
			if (body.length > MAX_BODY_BYTES) {
				return jsonResponse({ error: "payload too large" }, 413);
			}

			let endpoint: WebhookResolution | null;
			try {
				endpoint = await resolveEndpoint(slug, cache);
			} catch (error) {
				// The repository being down is our fault, not the producer's:
				// 503 is what makes a well-behaved producer retry later.
				console.error(`[webhooks-gateway] resolve ${slug} failed:`, error);
				return jsonResponse({ error: "unavailable" }, 503);
			}

			if (!endpoint) return jsonResponse({ error: "not found" }, 404);
			if (!endpoint.enabled) {
				record(endpoint, context, body, 403, "endpoint disabled");
				return jsonResponse({ error: "endpoint disabled" }, 403);
			}

			const verified = await verifyDelivery(
				endpoint.verify,
				endpoint.secret,
				context.headers,
				body,
			);
			if (!verified.ok) {
				console.warn(`[webhooks-gateway] ${slug} refused: ${verified.reason}`);
				record(endpoint, context, body, 401, verified.reason);
				return jsonResponse({ error: "unauthorized" }, 401);
			}

			// A body that is not JSON still reaches the bus — as text. Plenty of
			// producers post form data or XML, and dropping those at the door
			// would make the endpoint useless for them.
			let payload: unknown = body;
			try {
				if (body) payload = JSON.parse(body);
			} catch {
				payload = { raw: body };
			}

			try {
				const published = await busClient().publish({
					name: endpoint.topic,
					source: "webhook",
					payload: {
						endpoint: endpoint.slug,
						provider: endpoint.provider,
						method: context.request.method,
						query: context.query,
						headers: recordedHeaders(context),
						body: payload,
					},
				});
				record(endpoint, context, body, 202);
				return jsonResponse({ ok: true, eventId: published.id }, 202);
			} catch (error) {
				console.error(`[webhooks-gateway] publish ${endpoint.topic} failed:`, error);
				record(endpoint, context, body, 503, String(error));
				return jsonResponse({ error: "unavailable" }, 503);
			}
		});

		return app;
	};
}

// Producer-facing route: it lives at the server root, not under /services.
webhooksGatewayPlugin.mount = "root" as const;
