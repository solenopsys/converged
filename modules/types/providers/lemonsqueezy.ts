/**
 * Lemon Squeezy as a payment provider: one hosted checkout out, one verified
 * webhook in. Nothing is stored here — the invoice is the record, and this is
 * the wire to the outside.
 */

export type LemonSqueezyCredentials = {
	apiKey: string;
	storeId: string;
	/**
	 * The variant a custom-priced checkout is attached to.
	 *
	 * Lemon Squeezy has no "arbitrary amount" checkout: every one hangs off a
	 * product variant, and an invoice's amount arrives as `custom_price` on top.
	 * So the deployment needs one throwaway variant for this to point at.
	 */
	variantId: string;
	/** Shared secret the webhook signature is computed with. */
	webhookSecret: string;
};

export type CheckoutRequest = {
	/** Whole currency units — the same unit `rp-billing` and `rp-invoices` use. */
	amount: number;
	currency?: string;
	/** Shown on the checkout page, so it should read like an invoice line. */
	description: string;
	/**
	 * Carried through the checkout and handed back on the webhook as
	 * `meta.custom_data.invoice_id`. This is the only thread connecting a
	 * payment to what it paid for: without it a webhook says money arrived and
	 * nothing else.
	 */
	invoiceId: string;
	email?: string;
	/** Where the payer lands afterwards. */
	redirectUrl?: string;
};

export type CheckoutResult = {
	success: boolean;
	/** The hosted page to send the payer to. */
	url?: string;
	/** Lemon Squeezy's id for the checkout, for support conversations. */
	checkoutId?: string;
	error?: string;
};

/**
 * What a verified webhook turned out to mean.
 *
 * `paid` is the only kind that moves money in our direction; the others are
 * reported so a caller can log or ignore them deliberately rather than by
 * falling off the end of a switch.
 */
export type PaymentEventKind = "paid" | "refunded" | "failed" | "ignored";

export type PaymentEvent = {
	kind: PaymentEventKind;
	/** Our invoice, from `meta.custom_data.invoice_id`. */
	invoiceId?: string;
	/** Lemon Squeezy's order id — what `Invoice.providerRef` gets set to. */
	providerRef?: string;
	/** Whole currency units, converted from the provider's cents. */
	amount?: number;
	currency?: string;
	paidAt?: string;
	/** The provider's own event name, kept verbatim for the log. */
	eventName?: string;
};

export type WebhookResult =
	| { verified: true; event: PaymentEvent }
	/**
	 * A failed signature is a normal answer, not an exception.
	 *
	 * This endpoint is public by construction — anybody on the internet can post
	 * to it — so an unsigned body is the expected traffic, not an incident. The
	 * caller answers 401 and moves on.
	 */
	| { verified: false; reason: string };

export interface LemonSqueezyService {
	/**
	 * `credentials` is an override, not the normal path — the lambda reads its
	 * own environment, the same way `lm-ses` does, because a credential passed
	 * as a call parameter has travelled through the browser to get here.
	 */
	createCheckout(
		request: CheckoutRequest,
		credentials?: LemonSqueezyCredentials,
	): Promise<CheckoutResult>;

	/**
	 * Verify a webhook and say what it meant.
	 *
	 * `rawBody` has to be the bytes as they arrived, before any JSON round trip:
	 * the signature covers the exact string, and re-serialising an object
	 * reorders keys and loses the match.
	 */
	handleWebhook(
		rawBody: string,
		signature: string,
		credentials?: LemonSqueezyCredentials,
	): Promise<WebhookResult>;

	/**
	 * Read an already-verified payload.
	 *
	 * The UI webhooks gateway checks the signature at the door and publishes the
	 * *parsed* body on the bus, so by the time a workflow sees a delivery the
	 * raw bytes are gone and `handleWebhook` cannot be used — an HMAC is over
	 * bytes, and re-serialising an object does not reproduce them.
	 *
	 * Calling this on something nobody verified is trusting whoever posted it.
	 * That is the caller's decision to get right, and the reason it is a
	 * separate method rather than a flag on the one above.
	 */
	interpretEvent(payload: unknown): Promise<PaymentEvent>;
}
