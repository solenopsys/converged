import { SqlMigration, type SqlStore } from "back-core";

/**
 * Who the work is for.
 *
 * There is no customer directory in this platform, so the order is the shop's
 * only record of the person who asked for the work. The review funnel is the
 * first process that has to write to them after it is finished, and it cannot
 * be handed the address on every run.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_order_customer", store);
	}

	async up(): Promise<void> {
		for (const column of ["customerName", "customerEmail", "customerLang"]) {
			await this.store.db.schema
				.alterTable("orders")
				.addColumn(column, "text")
				.execute();
		}
	}

	async down(): Promise<void> {}
}
