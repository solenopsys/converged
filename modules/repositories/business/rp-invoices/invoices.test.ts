import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import invoicesMigrations from "./src/stores/invoices/migrations";
import { InvoicesStoreService, statusOf } from "./src/stores/invoices/service";

const PAST = "2001-01-01T00:00:00.000Z";
const FAR = "2099-01-01T00:00:00.000Z";

const period = { periodFrom: "2026-09-01", periodTo: "2026-09-30" };

describe("invoices", () => {
	let store: SqlStore;
	let invoices: InvoicesStoreService;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			invoicesMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		invoices = new InvoicesStoreService(store);
	});

	const draft = (
		owner = "acme",
		lines = [
			{
				description: "Membership",
				category: "membership" as const,
				amount: 99,
			},
		],
	) => invoices.createInvoice({ owner, ...period, lines });

	it("sums the lines into the total", async () => {
		const invoice = await draft("acme", [
			{ description: "Membership", category: "membership", amount: 99 },
			{ description: "Tokens", category: "tokens", amount: 1.5 },
		]);

		expect(invoice.total).toBe(100.5);
		expect(invoice.lines).toHaveLength(2);
	});

	it("hands out human numbers that do not repeat", async () => {
		const first = await draft();
		const second = await draft();

		expect(second.number).toBe(first.number + 1);
	});

	it("is a draft until it is issued", async () => {
		const invoice = await draft();
		expect(invoice.status).toBe("draft");

		const issued = await invoices.issueInvoice(invoice.id, FAR);
		expect(issued?.status).toBe("issued");
	});

	it("calls an issued invoice overdue once its due date has passed", async () => {
		const invoice = await draft();
		const issued = await invoices.issueInvoice(invoice.id, PAST);

		expect(issued?.status).toBe("overdue");
	});

	it("keeps the first issue date when issued twice", async () => {
		const invoice = await draft();
		const first = await invoices.issueInvoice(invoice.id, FAR);
		const second = await invoices.issueInvoice(invoice.id, PAST);

		expect(second?.issuedAt).toBe(first?.issuedAt);
		expect(second?.dueAt).toBe(FAR);
	});

	it("records a payment and stops being overdue", async () => {
		const invoice = await draft();
		await invoices.issueInvoice(invoice.id, PAST);

		expect(
			await invoices.markPaid(invoice.id, {
				provider: "lemonsqueezy",
				providerRef: "ord_1",
			}),
		).toBe(true);
		expect((await invoices.getInvoice(invoice.id))?.status).toBe("paid");
	});

	// The one that matters: every provider retries its webhooks, and a retry is
	// indistinguishable from a second payment by anything but the reference.
	it("ignores the same payment delivered twice", async () => {
		const invoice = await draft();
		await invoices.issueInvoice(invoice.id, FAR);

		expect(
			await invoices.markPaid(invoice.id, {
				provider: "lemonsqueezy",
				providerRef: "ord_1",
			}),
		).toBe(true);
		expect(
			await invoices.markPaid(invoice.id, {
				provider: "lemonsqueezy",
				providerRef: "ord_1",
			}),
		).toBe(false);
	});

	it("refuses to reuse one payment reference on a second invoice", async () => {
		const first = await draft();
		const second = await draft();
		await invoices.markPaid(first.id, {
			provider: "lemonsqueezy",
			providerRef: "ord_1",
		});

		expect(
			await invoices.markPaid(second.id, {
				provider: "lemonsqueezy",
				providerRef: "ord_1",
			}),
		).toBe(false);
		expect((await invoices.getInvoice(second.id))?.status).toBe("draft");
	});

	it("finds an invoice by the provider's own reference", async () => {
		const invoice = await draft();
		await invoices.markPaid(invoice.id, {
			provider: "lemonsqueezy",
			providerRef: "ord_42",
		});

		expect((await invoices.findByProviderRef("ord_42"))?.id).toBe(invoice.id);
	});

	it("withdraws an unpaid invoice", async () => {
		const invoice = await draft();
		const voided = await invoices.voidInvoice(invoice.id, "issued in error");

		expect(voided?.status).toBe("void");
	});

	// Money moved. Saying it never did loses the only record that it happened.
	it("refuses to withdraw a paid invoice", async () => {
		const invoice = await draft();
		await invoices.markPaid(invoice.id, {
			provider: "lemonsqueezy",
			providerRef: "ord_7",
		});

		expect((await invoices.voidInvoice(invoice.id))?.status).toBe("paid");
	});

	it("will not mark a withdrawn invoice paid", async () => {
		const invoice = await draft();
		await invoices.voidInvoice(invoice.id);

		expect(
			await invoices.markPaid(invoice.id, {
				provider: "lemonsqueezy",
				providerRef: "ord_9",
			}),
		).toBe(false);
	});

	// What stops a charge being invoiced twice: the assembler asks instead of
	// trusting a date range it worked out itself.
	it("reports which ledger entries are already on an invoice", async () => {
		await draft("acme", [
			{
				description: "Tokens",
				category: "tokens",
				amount: 3,
				sourceEntryId: "e1",
			},
			{
				description: "Bytes",
				category: "resources",
				amount: 2,
				sourceEntryId: "e2",
			},
		]);

		expect((await invoices.billedEntryIds(["e1", "e3"])).sort()).toEqual([
			"e1",
		]);
		expect(await invoices.billedEntryIds([])).toEqual([]);
	});

	it("shows a member only their own invoices", async () => {
		await draft("acme");
		await draft("globex");

		const listed = await invoices.listInvoices({
			offset: 0,
			limit: 10,
			owner: "acme",
		});
		expect(listed.items).toHaveLength(1);
		expect(listed.items[0].owner).toBe("acme");
	});

	it("derives void over paid and paid over overdue", () => {
		expect(
			statusOf({ voidedAt: PAST, paidAt: PAST, issuedAt: PAST }, FAR),
		).toBe("void");
		expect(statusOf({ paidAt: PAST, issuedAt: PAST, dueAt: PAST }, FAR)).toBe(
			"paid",
		);
		expect(statusOf({ issuedAt: PAST, dueAt: PAST }, FAR)).toBe("overdue");
		expect(statusOf({ issuedAt: PAST, dueAt: FAR }, PAST)).toBe("issued");
		expect(statusOf({}, FAR)).toBe("draft");
	});
});
