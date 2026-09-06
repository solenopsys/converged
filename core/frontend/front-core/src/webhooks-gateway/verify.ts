// How a delivery proves who sent it.
//
// `/webhooks/<slug>` is open ingress: it has to be, because the producer is a
// payment provider or a mail relay that will never hold a cluster JWT. So the
// endpoint's own configuration is the whole authentication story, and it is
// worth being exact about what each mode does and does not prove.
import type { HeaderMap } from "back-core/server-app";
import type { WebhookVerification } from "g-webhooks";

export type VerificationOutcome = { ok: boolean; reason?: string };

/** Case-insensitive header read: Bun lowercases, a proxy may not. */
function header(headers: HeaderMap, name: string): string | undefined {
	const direct = headers[name];
	if (typeof direct === "string" && direct) return direct;
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === wanted && typeof value === "string" && value) {
			return value;
		}
	}
	return undefined;
}

function presentedToken(headers: HeaderMap): string | undefined {
	const explicit = header(headers, "x-webhook-token");
	if (explicit) return explicit.trim();
	const authorization = header(headers, "authorization");
	if (!authorization) return undefined;
	return authorization.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Constant-time comparison. A `===` on a secret leaks its prefix through timing
 * to anyone who can post to the URL a few thousand times, which is exactly what
 * this endpoint invites.
 */
function timingSafeEqual(left: string, right: string): boolean {
	const a = new TextEncoder().encode(left);
	const b = new TextEncoder().encode(right);
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
	return difference === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(body),
	);
	return Array.from(new Uint8Array(signature))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * `none` accepts anything and exists for a producer behind a private network
 * that genuinely cannot sign. `secret` proves the sender knows a shared token.
 * `hmac` proves the sender knows the token *and* that this exact body is what
 * they signed, which is the only mode a replay cannot pass.
 */
export async function verifyDelivery(
	mode: WebhookVerification,
	secret: string | undefined,
	headers: HeaderMap,
	body: string,
): Promise<VerificationOutcome> {
	if (mode === "none") return { ok: true };

	// Fail closed. A configuration that asks for a check it cannot perform is a
	// mistake, and treating it as "no check" is how an endpoint quietly becomes
	// public.
	if (!secret) return { ok: false, reason: "endpoint has no secret configured" };

	if (mode === "secret") {
		const presented = presentedToken(headers);
		if (!presented) return { ok: false, reason: "missing token" };
		return timingSafeEqual(presented, secret)
			? { ok: true }
			: { ok: false, reason: "token mismatch" };
	}

	const presented = header(headers, "x-webhook-signature")
		?? header(headers, "x-hub-signature-256");
	if (!presented) return { ok: false, reason: "missing signature" };
	const expected = await hmacHex(secret, body);
	const offered = presented.replace(/^sha256=/i, "").trim().toLowerCase();
	return timingSafeEqual(offered, expected)
		? { ok: true }
		: { ok: false, reason: "signature mismatch" };
}
