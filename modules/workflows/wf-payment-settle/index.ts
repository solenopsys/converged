// wf-payment-settle — a delivery from the payment provider becomes a paid invoice.
//
// The producer posts to `/webhooks/<slug>` on the UI host. The gateway checks
// the signature there, at the door, because an HMAC is over the bytes that
// arrived and nothing downstream still has them — then publishes the parsed
// body on the endpoint's topic. This flow is what subscribes to that topic.
//
// So the trust boundary is the gateway, not this file: by the time a payload
// reaches here it has been verified, and `interpretEvent` says what it means
// without pretending to check anything. An endpoint configured with
// `verify: "none"` moves that boundary to nowhere, which is a deployment
// decision and a bad one.
//
// Re-running is safe and is expected — every provider retries, and a retry is
// indistinguishable from a second payment by anything except the provider's
// own reference. Safety does not come from this file being careful: it comes
// from `providerRef` being unique in rp-invoices, so the second markPaid
// answers `false` and nothing moves.
//
// Services used: lemonsqueezy.interpretEvent, invoices.markPaid / getInvoice.

import "dag-core/env";

import { createInvoicesServiceRtClient } from "g-invoices/rt";
import { createLemonSqueezyServiceRtClient } from "g-lemonsqueezy/rt";

const invoices = createInvoicesServiceRtClient();
const lemonsqueezy = createLemonSqueezyServiceRtClient();

const PROVIDER = "lemonsqueezy";

const DEFAULTS = {
	/** The bus event's payload — `{endpoint, provider, headers, body}`. */
	body: null as unknown,
	/** Report what would happen and change nothing. */
	dryRun: false,
};

type Input = Partial<typeof DEFAULTS> & Record<string, unknown>;

rt.workflow = (input: Input) => {
	const o = { ...DEFAULTS, ...(input ?? {}) };

	// The gateway wraps the delivery; a direct caller may hand the payload over
	// bare. Both shapes are accepted because the difference is an accident of
	// who invoked the flow, not something the payment means.
	const payload =
		o.body && typeof o.body === "object" && "body" in (o.body as any)
			? (o.body as any).body
			: (o.body ?? input);

	const event = rt.node("interpret", () =>
		lemonsqueezy.interpretEvent(payload),
	);

	if (event.kind !== "paid") {
		// Refunds and unrelated hooks are logged and left alone. A refund is its
		// own act with its own record — undoing a payment here would lose the
		// fact that money once arrived, which is the thing the invoice exists to
		// remember.
		rt.log(
			`payment: ${event.eventName ?? "unknown"} is ${event.kind}, nothing to settle`,
		);
		return { status: "ignored", kind: event.kind, eventName: event.eventName };
	}

	if (!event.invoiceId || !event.providerRef) {
		// Money arrived and we cannot say what for. Failing loudly is right: the
		// alternative is a payment nobody can reconcile, discovered by a member
		// who was chased for an invoice they had already paid.
		rt.log(
			`payment ${event.providerRef ?? "?"}: no invoice id in the delivery`,
		);
		return { status: "unmatched", providerRef: event.providerRef };
	}

	const invoice = rt.node(`invoice:${event.invoiceId}`, () =>
		invoices.getInvoice(event.invoiceId as string),
	);
	if (!invoice) {
		rt.log(
			`payment ${event.providerRef}: invoice ${event.invoiceId} does not exist`,
		);
		return {
			status: "unmatched",
			invoiceId: event.invoiceId,
			providerRef: event.providerRef,
		};
	}

	// Worth saying out loud, not worth refusing over. The payer may have been
	// given a checkout for a partial amount, or a currency conversion may have
	// rounded; either way the money is in and the invoice is settled, and a
	// mismatch is something a human should look at rather than something that
	// should leave an invoice open.
	if (
		event.amount !== undefined &&
		Math.abs(event.amount - invoice.total) > 0.01
	) {
		rt.log(
			`payment ${event.providerRef}: paid ${event.amount} against invoice ${invoice.number} of ${invoice.total}`,
		);
	}

	if (o.dryRun) {
		return {
			status: "dry-run",
			invoiceId: invoice.id,
			number: invoice.number,
			providerRef: event.providerRef,
		};
	}

	const settled = rt.node(`settle:${event.providerRef}`, () =>
		invoices.markPaid(invoice.id, {
			provider: PROVIDER,
			providerRef: event.providerRef as string,
			...(event.paidAt ? { paidAt: event.paidAt } : {}),
		}),
	);

	if (!settled) {
		// The reference was already recorded: an earlier delivery of this same
		// payment won. Not an error — the expected outcome of a retry.
		rt.log(`payment ${event.providerRef}: already settled`);
		return {
			status: "already-settled",
			invoiceId: invoice.id,
			number: invoice.number,
		};
	}

	rt.log(`payment ${event.providerRef}: invoice ${invoice.number} paid`);
	return {
		status: "settled",
		invoiceId: invoice.id,
		number: invoice.number,
		owner: invoice.owner,
		amount: invoice.total,
		providerRef: event.providerRef,
	};
};
