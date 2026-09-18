import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_invoices", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("invoices")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			// Human-readable and never reused. An id nobody can say out loud is
			// useless on a phone call about a payment.
			.addColumn("number", "integer", (col) => col.notNull())
			.addColumn("owner", "text", (col) => col.notNull())
			.addColumn("currency", "text", (col) => col.notNull())
			.addColumn("total", "real", (col) => col.notNull())
			.addColumn("periodFrom", "text", (col) => col.notNull())
			.addColumn("periodTo", "text", (col) => col.notNull())
			// The four facts the status is computed from. None of them is a status.
			.addColumn("issuedAt", "text")
			.addColumn("dueAt", "text")
			.addColumn("paidAt", "text")
			.addColumn("voidedAt", "text")
			.addColumn("provider", "text")
			// Unique, and that is the entire defence against a webhook delivered
			// twice: the second insert loses, so the second "payment" cannot
			// happen. Every provider retries, and a retry is indistinguishable
			// from a real second payment by anything except this column.
			.addColumn("providerRef", "text")
			.addColumn("createdAt", "text", (col) => col.notNull())
			.addColumn("updatedAt", "text", (col) => col.notNull())
			.execute();

		await this.store.db.schema
			.createIndex("invoices_provider_ref_idx")
			.ifNotExists()
			.on("invoices")
			.column("providerRef")
			.unique()
			.execute();

		// "My invoices, newest first" is the only listing a member ever asks for.
		await this.store.db.schema
			.createIndex("invoices_owner_created_idx")
			.ifNotExists()
			.on("invoices")
			.columns(["owner", "createdAt"])
			.execute();

		await this.store.db.schema
			.createIndex("invoices_number_idx")
			.ifNotExists()
			.on("invoices")
			.column("number")
			.unique()
			.execute();

		await this.store.db.schema
			.createTable("invoice_lines")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("invoiceId", "text", (col) => col.notNull())
			.addColumn("description", "text", (col) => col.notNull())
			.addColumn("category", "text", (col) => col.notNull())
			.addColumn("amount", "real", (col) => col.notNull())
			// Which ledger entry this line came from, when it came from one.
			// Unique, so the same charge cannot end up on two invoices — the
			// billing equivalent of the provider reference above.
			.addColumn("sourceEntryId", "text")
			.execute();

		await this.store.db.schema
			.createIndex("invoice_lines_invoice_idx")
			.ifNotExists()
			.on("invoice_lines")
			.column("invoiceId")
			.execute();

		await this.store.db.schema
			.createIndex("invoice_lines_source_idx")
			.ifNotExists()
			.on("invoice_lines")
			.column("sourceEntryId")
			.unique()
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("invoice_lines_source_idx")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropIndex("invoice_lines_invoice_idx")
			.ifExists()
			.execute();
		await this.store.db.schema.dropTable("invoice_lines").ifExists().execute();
		await this.store.db.schema
			.dropIndex("invoices_number_idx")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropIndex("invoices_owner_created_idx")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropIndex("invoices_provider_ref_idx")
			.ifExists()
			.execute();
		await this.store.db.schema.dropTable("invoices").ifExists().execute();
	}
}
