export type InvoiceId = string;
export type ISODateString = string;

/**
 * What an invoice line was for. The same vocabulary `rp-billing` files entries
 * under, because a line is almost always a period's worth of entries in one
 * category and the two would otherwise have to be translated.
 */
export type InvoiceCategory = "tokens" | "resources" | "module" | "membership";

/**
 * Derived from four timestamps, never stored.
 *
 * A stored status is a second copy of what the dates already say, and the two
 * part company the first time nobody runs the job that marks things overdue.
 * Computed, an invoice is overdue exactly when it is overdue, and there is
 * nothing to run.
 *
 *   voidedAt  → void      — withdrawn; it was never owed
 *   paidAt    → paid      — money arrived, and the provider reference proves it
 *   !issuedAt → draft     — being assembled; nobody has been asked for anything
 *   past due  → overdue
 *   otherwise → issued
 */
export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";

export type InvoiceLine = {
	id: string;
	invoiceId: InvoiceId;
	description: string;
	category: InvoiceCategory;
	/** Whole currency units, like `rp-billing`. */
	amount: number;
	/**
	 * The billing entry this line was built from, when it was built from one.
	 *
	 * This is what stops a period being invoiced twice: the assembler asks which
	 * entries have already been billed instead of trusting a date range it
	 * computed itself.
	 */
	sourceEntryId?: string;
};

export type Invoice = {
	id: InvoiceId;
	/** Human-readable and never reused: "#2026-041" is what people say out loud. */
	number: number;
	owner: string;
	currency: string;
	/** The sum of the lines, kept here so a list does not have to join. */
	total: number;
	status: InvoiceStatus;
	/** What the invoice covers. Both ends inclusive of the day. */
	periodFrom: ISODateString;
	periodTo: ISODateString;
	issuedAt?: ISODateString;
	dueAt?: ISODateString;
	paidAt?: ISODateString;
	voidedAt?: ISODateString;
	/** Which provider took the money — `lemonsqueezy`, or whatever replaces it. */
	provider?: string;
	/**
	 * The provider's own id for the payment.
	 *
	 * Unique across the table, and that uniqueness is the whole defence against
	 * a webhook delivered twice. Every payment provider retries, and a retry
	 * that marks an invoice paid a second time is indistinguishable from a
	 * second payment.
	 */
	providerRef?: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };

export type InvoiceLineInput = {
	description: string;
	category: InvoiceCategory;
	amount: number;
	sourceEntryId?: string;
};

/**
 * The lines come in with the invoice.
 *
 * `rp-invoices` cannot read `rp-billing` — repositories do not call each other
 * — so whoever assembles an invoice reads the ledger and hands the result over,
 * exactly as a ticket's thread is minted before the ticket.
 */
export type CreateInvoiceInput = {
	owner?: string;
	currency?: string;
	periodFrom: ISODateString;
	periodTo: ISODateString;
	dueAt?: ISODateString;
	lines: InvoiceLineInput[];
};

export type MarkPaidInput = {
	provider: string;
	providerRef: string;
	paidAt?: ISODateString;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type InvoiceListParams = {
	offset: number;
	limit: number;
	owner?: string;
	/** Filters on the derived status, which means it is computed, not indexed. */
	status?: InvoiceStatus;
	from?: ISODateString;
	to?: ISODateString;
};

export interface InvoicesService {
	/** Assembling an invoice is the club's act, never a member's. */
	createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithLines>;

	/** Left out, the caller's own. A person only ever sees their own invoices. */
	getInvoice(id: InvoiceId): Promise<InvoiceWithLines | undefined>;

	listInvoices(params: InvoiceListParams): Promise<PaginatedResult<Invoice>>;

	/** Stamps `issuedAt` and the due date: from here on somebody owes money. */
	issueInvoice(id: InvoiceId, dueAt?: ISODateString): Promise<Invoice>;

	/**
	 * Money arrived.
	 *
	 * Answers `false` when this provider reference has already been recorded —
	 * against this invoice or any other — rather than throwing, because a
	 * duplicate webhook is a normal event and not an error anybody should page
	 * about. The first delivery wins.
	 */
	markPaid(id: InvoiceId, input: MarkPaidInput): Promise<boolean>;

	/** Withdraw an invoice. A paid one cannot be withdrawn — refunds are their
	 *  own act, and pretending otherwise loses the record that money moved. */
	voidInvoice(id: InvoiceId, reason?: string): Promise<Invoice>;

	/** For a webhook that knows only the provider's id. */
	findByProviderRef(providerRef: string): Promise<Invoice | undefined>;

	/** Which of these entry ids are already on some invoice. */
	billedEntryIds(entryIds: string[]): Promise<string[]>;
}
