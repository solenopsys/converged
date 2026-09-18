import { Access, getCurrentWorkspaceContext, isServiceActor } from "nrpc";
import { StoresController } from "./stores";
import type {
	CreateInvoiceInput,
	Invoice,
	InvoiceId,
	InvoiceListParams,
	InvoicesService,
	InvoiceWithLines,
	ISODateString,
	MarkPaidInput,
	PaginatedResult,
} from "./types";

const REPOSITORY_ID = "rp-invoices";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) {
		const error: any = new Error("Authenticated caller is required");
		error.statusCode = 401;
		throw error;
	}
	return actor;
}

/**
 * Whose invoices are being asked about.
 *
 * A person is always asking about their own, whatever they named — an invoice
 * says what a company was charged, and that is nobody else's to read. A service
 * may name anyone, which is how the assembling job and the payment webhook
 * work across the whole ledger.
 */
function ownerFor(claimed: string | undefined): string {
	const actor = requireActor();
	if (!isServiceActor()) return actor;
	return claimed?.trim() || actor;
}

function badRequest(message: string): never {
	const error: any = new Error(message);
	error.statusCode = 400;
	throw error;
}

function notFound(id: string): never {
	const error: any = new Error(`No invoice ${id}`);
	error.statusCode = 404;
	throw error;
}

export class InvoicesServiceImpl implements InvoicesService {
	private stores!: StoresController;
	private initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	// Issuing an invoice is the club's act. A member who could write their own
	// would write one for nothing and mark it paid.
	@Access("internal")
	async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithLines> {
		await this.ensureReady();
		if (!input?.periodFrom || !input?.periodTo) {
			badRequest("periodFrom and periodTo are required");
		}
		if (!Array.isArray(input.lines) || input.lines.length === 0) {
			// An invoice with no lines is a demand for nothing. It would still get
			// a number, still be sent, and still be unpayable.
			badRequest("An invoice needs at least one line");
		}
		for (const line of input.lines) {
			if (!line?.description?.trim())
				badRequest("Every line needs a description");
			if (!Number.isFinite(line.amount))
				badRequest("Every line needs an amount");
		}
		return this.stores.invoices.createInvoice({
			...input,
			owner: ownerFor(input.owner),
			lines: input.lines.map((line) => ({
				...line,
				description: line.description.trim(),
			})),
		});
	}

	@Access("user")
	async getInvoice(id: InvoiceId): Promise<InvoiceWithLines | undefined> {
		await this.ensureReady();
		const invoice = await this.stores.invoices.getInvoice(id);
		if (!invoice) return undefined;
		// Somebody else's invoice is `undefined`, not a refusal: saying "you may
		// not see this" confirms it exists, and the id is guessable enough that
		// the difference matters.
		if (!isServiceActor() && invoice.owner !== requireActor()) return undefined;
		return invoice;
	}

	@Access("user")
	async listInvoices(
		params: InvoiceListParams,
	): Promise<PaginatedResult<Invoice>> {
		await this.ensureReady();
		return this.stores.invoices.listInvoices({
			...params,
			owner: ownerFor(params.owner),
		});
	}

	@Access("internal")
	async issueInvoice(id: InvoiceId, dueAt?: ISODateString): Promise<Invoice> {
		await this.ensureReady();
		const issued = await this.stores.invoices.issueInvoice(id, dueAt);
		if (!issued) notFound(id);
		return issued;
	}

	// Only a service says money arrived. A member who could mark their own
	// invoice paid has found a way to not pay it.
	@Access("internal")
	async markPaid(id: InvoiceId, input: MarkPaidInput): Promise<boolean> {
		await this.ensureReady();
		if (!input?.provider?.trim() || !input?.providerRef?.trim()) {
			// Without a provider reference there is nothing to make the write
			// idempotent, and this is the one write in the system that must not
			// happen twice.
			badRequest("provider and providerRef are required");
		}
		return this.stores.invoices.markPaid(id, {
			provider: input.provider.trim(),
			providerRef: input.providerRef.trim(),
			...(input.paidAt ? { paidAt: input.paidAt } : {}),
		});
	}

	@Access("internal")
	async voidInvoice(id: InvoiceId, reason?: string): Promise<Invoice> {
		await this.ensureReady();
		const voided = await this.stores.invoices.voidInvoice(id, reason);
		if (!voided) notFound(id);
		return voided;
	}

	@Access("internal")
	async findByProviderRef(providerRef: string): Promise<Invoice | undefined> {
		await this.ensureReady();
		return this.stores.invoices.findByProviderRef(providerRef);
	}

	// What the assembler asks before building a period, so the same charge does
	// not land on two invoices.
	@Access("internal")
	async billedEntryIds(entryIds: string[]): Promise<string[]> {
		await this.ensureReady();
		return this.stores.invoices.billedEntryIds(entryIds ?? []);
	}

	private async ensureReady(): Promise<void> {
		await this.initPromise;
	}
}

export default InvoicesServiceImpl;
