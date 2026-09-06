import { describe, expect, test } from "bun:test";
import { verifyDelivery } from "./verify";

const secret = "shhh";

async function signature(body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const raw = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return Array.from(new Uint8Array(raw))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

describe("webhook delivery verification", () => {
	test("a shared token is accepted from either header", async () => {
		expect(await verifyDelivery("secret", secret, { "x-webhook-token": secret }, "")).toEqual({ ok: true });
		expect(await verifyDelivery("secret", secret, { authorization: `Bearer ${secret}` }, "")).toEqual({ ok: true });
		expect(await verifyDelivery("secret", secret, { Authorization: `Bearer ${secret}` }, "")).toEqual({ ok: true });
	});

	test("a wrong or missing token is refused with a reason", async () => {
		expect((await verifyDelivery("secret", secret, {}, "")).ok).toBe(false);
		const wrong = await verifyDelivery("secret", secret, { "x-webhook-token": "nope!" }, "");
		expect(wrong).toEqual({ ok: false, reason: "token mismatch" });
	});

	test("an hmac covers the exact body, so a replay against another one fails", async () => {
		const body = '{"amount":10}';
		const headers = { "x-webhook-signature": `sha256=${await signature(body)}` };
		expect(await verifyDelivery("hmac", secret, headers, body)).toEqual({ ok: true });
		expect((await verifyDelivery("hmac", secret, headers, '{"amount":1000}')).ok).toBe(false);
	});

	test("an endpoint that asks for a check it cannot perform fails closed", async () => {
		// The dangerous reading would be "no secret, no check, let it through".
		expect((await verifyDelivery("secret", undefined, { "x-webhook-token": "x" }, "")).ok).toBe(false);
		expect((await verifyDelivery("hmac", undefined, {}, "")).ok).toBe(false);
		expect(await verifyDelivery("none", undefined, {}, "")).toEqual({ ok: true });
	});
});
