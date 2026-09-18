import { generateULID, type SqlStore } from "back-core";
import type {
	CreateInvoiceInput,
	Invoice,
	InvoiceLine,
	InvoiceListParams,
	InvoiceStatus,
	InvoiceWithLines,
	MarkPaidInput,
	PaginatedResult,
} from "../../types";

/**
 * The status, from the four timestamps and nothing else.
 *
 * Order matters and is not alphabetical: a withdrawn invoice is withdrawn even
 * if it was somehow paid, and a paid one is never overdue however late the
 * money was.
 */
export function statusOf(row: Partial<Invoice>, now: string): InvoiceStatus {
	if (row.voidedAt) return "void";
	if (row.paidAt) return "paid";
	if (!row.issuedAt) return "draft";
	if (row.dueAt && row.dueAt < now) return "overdue";
	return "issued";
}

export class InvoicesStoreService {
	constructor(private store: SqlStore) {}

	private row(row: any, now: string): Invoice {
		return {
			id: row.id,
			number: Number(row.number),
			owner: row.owner,
			currency: row.currency,
			total: Number(row.total),
			status: statusOf(row, now),
			periodFrom: row.periodFrom,
			periodTo: row.periodTo,
			...(row.issuedAt ? { issuedAt: row.issuedAt } : {}),
			...(row.dueAt ? { dueAt: row.dueAt } : {}),
			...(row.paidAt ? { paidAt: row.paidAt } : {}),
			...(row.voidedAt ? { voidedAt: row.voidedAt } : {}),
			...(row.provider ? { provider: row.provider } : {}),
			...(row.providerRef ? { providerRef: row.providerRef } : {}),
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	/**
	 * The next human number.
	 *
	 * `max + 1`, the same way a ticket gets its "#142". Two invoices created in
	 * the same instant would collide here; the unique index on `number` turns
	 * that into a failed insert rather than two invoices with one number, and
	 * invoices are created by a nightly job rather than by a crowd.
	 */
	private async nextNumber(): Promise<number> {
		const row: any = await this.store.db
			.selectFrom("invoices")
			.select(({ fn }) => fn.max("number").as("max"))
			.executeTakeFirst();
		return Number(row?.max ?? 0) + 1;
	}

	async createInvoice(
		input: CreateInvoiceInput & { owner: string },
	): Promise<InvoiceWithLines> {
		const now = new Date().toISOString();
		const id = generateULID();
		const currency = input.currency || "USD";
		// The total is the sum of the lines and is stored so a listing does not
		// have to join. It is written once, here, and no operation later changes
		// a line — an invoice that has been sent out does not get edited, it gets
		// voided and replaced.
		const total = input.lines.reduce((sum, line) => sum + line.amount, 0);

		await this.store.db
			.insertInto("invoices")
			.values({
				id,
				number: await this.nextNumber(),
				owner: input.owner,
				currency,
				total,
				periodFrom: input.periodFrom,
				periodTo: input.periodTo,
				dueAt: input.dueAt ?? null,
				issuedAt: null,
				paidAt: null,
				voidedAt: null,
				provider: null,
				providerRef: null,
				createdAt: now,
				updatedAt: now,
			} as any)
			.execute();

		for (const line of input.lines) {
			await this.store.db
				.insertInto("invoice_lines")
				.values({
					id: generateULID(),
					invoiceId: id,
					description: line.description,
					category: line.category,
					amount: line.amount,
					sourceEntryId: line.sourceEntryId ?? null,
				} as any)
				.execute();
		}

		return (await this.getInvoice(id))!;
	}

	async getInvoice(id: string): Promise<InvoiceWithLines | undefined> {
		const row = await this.store.db
			.selectFrom("invoices")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		if (!row) return undefined;
		const lines = await this.store.db
			.selectFrom("invoice_lines")
			.selectAll()
			.where("invoiceId", "=", id)
			.execute();
		return {
			...this.row(row, new Date().toISOString()),
			lines: lines as unknown as InvoiceLine[],
		};
	}

	async findByProviderRef(providerRef: string): Promise<Invoice | undefined> {
		const row = await this.store.db
			.selectFrom("invoices")
			.selectAll()
			.where("providerRef", "=", providerRef)
			.executeTakeFirst();
		return row ? this.row(row, new Date().toISOString()) : undefined;
	}

	async billedEntryIds(entryIds: string[]): Promise<string[]> {
		if (entryIds.length === 0) return [];
		const rows = await this.store.db
			.selectFrom("invoice_lines")
			.select("sourceEntryId")
			.where("sourceEntryId", "in", entryIds)
			.execute();
		return rows
			.map((row: any) => row.sourceEntryId)
			.filter((value: unknown): value is string => typeof value === "string");
	}

	async listInvoices(
		params: InvoiceListParams & { owner?: string },
	): Promise<PaginatedResult<Invoice>> {
		const now = new Date().toISOString();
		let query = this.store.db.selectFrom("invoices").selectAll();
		let countQuery = this.store.db
			.selectFrom("invoices")
			.select(({ fn }) => fn.countAll().as("count"));

		if (params.owner) {
			query = query.where("owner", "=", params.owner);
			countQuery = countQuery.where("owner", "=", params.owner);
		}
		if (params.from) {
			query = query.where("createdAt", ">=", params.from);
			countQuery = countQuery.where("createdAt", ">=", params.from);
		}
		if (params.to) {
			query = query.where("createdAt", "<=", params.to);
			countQuery = countQuery.where("createdAt", "<=", params.to);
		}

		const rows = await query
			.orderBy("createdAt", "desc")
			.limit(params.limit ?? 50)
			.offset(params.offset ?? 0)
			.execute();
		const counted = await countQuery.executeTakeFirst();

		const items = rows.map((row) => this.row(row, now));
		// Status is computed, so it cannot be a `WHERE`. Filtering after the page
		// means a filtered page can come back short — which is the honest
		// trade for not storing a second copy of the dates, and invoices are
		// counted in tens per member, not millions.
		if (params.status) {
			const filtered = items.filter((item) => item.status === params.status);
			return { items: filtered, totalCount: filtered.length };
		}

		return { items, totalCount: Number(counted?.count ?? 0) };
	}

	async issueInvoice(id: string, dueAt?: string): Promise<Invoice | undefined> {
		const now = new Date().toISOString();
		const existing = await this.store.db
			.selectFrom("invoices")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		if (!existing) return undefined;
		// Issuing twice keeps the first date. The date an invoice went out is a
		// fact about the past, and a second call is a retry, not a reissue.
		if ((existing as any).issuedAt) return this.row(existing, now);

		await this.store.db
			.updateTable("invoices")
			.set({
				issuedAt: now,
				dueAt: dueAt ?? (existing as any).dueAt,
				updatedAt: now,
			} as any)
			.where("id", "=", id)
			.execute();

		const updated = await this.store.db
			.selectFrom("invoices")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		return updated ? this.row(updated, now) : undefined;
	}

	/**
	 * Record a payment, once.
	 *
	 * The guard is the unique index on `providerRef`, not a read beforehand: two
	 * deliveries of the same webhook can both pass a check and both write, and
	 * only the database can settle which one did. So the update is conditional
	 * on the invoice not already being paid, and a `providerRef` already present
	 * anywhere makes the write fail — either way the answer is `false` and the
	 * caller treats it as "already handled".
	 */
	async markPaid(id: string, input: MarkPaidInput): Promise<boolean> {
		const now = new Date().toISOString();
		const paidAt = input.paidAt ?? now;

		const seen = await this.findByProviderRef(input.providerRef);
		if (seen) return false;

		try {
			const result = await this.store.db
				.updateTable("invoices")
				.set({
					paidAt,
					provider: input.provider,
					providerRef: input.providerRef,
					updatedAt: now,
				} as any)
				.where("id", "=", id)
				.where("paidAt", "is", null)
				.where("voidedAt", "is", null)
				.executeTakeFirst();
			return Number(result?.numUpdatedRows ?? 0) > 0;
		} catch {
			// The unique index refused it: another delivery won the race.
			return false;
		}
	}

	async voidInvoice(
		id: string,
		_reason?: string,
	): Promise<Invoice | undefined> {
		const now = new Date().toISOString();
		const existing = await this.store.db
			.selectFrom("invoices")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		if (!existing) return undefined;
		// A paid invoice is not withdrawn. Money moved; saying it never did
		// loses the only record that it happened. A refund is its own act.
		if ((existing as any).paidAt) return this.row(existing, now);

		await this.store.db
			.updateTable("invoices")
			.set({ voidedAt: now, updatedAt: now } as any)
			.where("id", "=", id)
			.execute();

		const updated = await this.store.db
			.selectFrom("invoices")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		return updated ? this.row(updated, now) : undefined;
	}
}
