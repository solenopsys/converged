// Mock lm-lemonsqueezy / rp-invoices for the settlement tests (test-only, never
// bundled into a workflow). `markPaid` behaves like the real unique index on
// `providerRef`: the first reference wins and every later one is told no,
// whichever invoice it arrives against.
//
// Parameters arrive named, not positional — the rt client turns a call's
// arguments into an object keyed by the contract's parameter names.

export type MockInvoice = {
	id: string;
	number: number;
	owner: string;
	total: number;
	paidAt?: string;
	providerRef?: string;
};

export function createPaymentUniverse(invoices: MockInvoice[] = []) {
	const seenRefs = new Set<string>();
	const settled: Array<{
		invoiceId: string;
		providerRef: string;
		provider: string;
	}> = [];

	const interpret = (payload: any) => {
		const eventName = String(payload?.meta?.event_name ?? "");
		const attributes = payload?.data?.attributes ?? {};
		const invoiceId = payload?.meta?.custom_data?.invoice_id;
		const providerRef = payload?.data?.id ? String(payload.data.id) : undefined;
		const base: any = { kind: "ignored", eventName, invoiceId, providerRef };
		if (eventName === "order_created") {
			if (String(attributes.status) !== "paid")
				return { ...base, kind: "failed" };
			return {
				...base,
				kind: "paid",
				amount: Number(attributes.total ?? 0) / 100,
				currency: attributes.currency,
				paidAt: attributes.created_at,
			};
		}
		if (eventName === "order_refunded") return { ...base, kind: "refunded" };
		return base;
	};

	const handler = (service: string, method: string, params: any) => {
		if (service === "lemonsqueezy" && method === "interpretEvent") {
			return interpret(params.payload);
		}
		if (service === "invoices" && method === "getInvoice") {
			return invoices.find((invoice) => invoice.id === params.id);
		}
		if (service === "invoices" && method === "markPaid") {
			const ref = params.input?.providerRef;
			// The unique index, in one line: a reference already recorded loses,
			// against this invoice or any other.
			if (!ref || seenRefs.has(ref)) return false;
			const invoice = invoices.find((item) => item.id === params.id);
			if (!invoice || invoice.paidAt) return false;
			seenRefs.add(ref);
			invoice.paidAt = params.input.paidAt ?? new Date().toISOString();
			invoice.providerRef = ref;
			settled.push({
				invoiceId: params.id,
				providerRef: ref,
				provider: params.input.provider,
			});
			return true;
		}
		throw new Error(`unexpected call ${service}.${method}`);
	};

	return { handler, settled, invoices };
}

export const orderPaid = (
	invoiceId: string,
	orderId: string,
	totalCents: number,
) => ({
	meta: { event_name: "order_created", custom_data: { invoice_id: invoiceId } },
	data: {
		id: orderId,
		attributes: {
			status: "paid",
			total: totalCents,
			currency: "USD",
			created_at: "2026-09-18T10:00:00.000Z",
		},
	},
});
