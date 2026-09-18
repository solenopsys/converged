import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import invoicesMigrations from "./invoices/migrations";
import { InvoicesStoreService } from "./invoices/service";

export class StoresController extends StoreControllerAbstract {
	public invoices!: InvoicesStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init(): Promise<void> {
		const store = await this.addStore(
			"invoices",
			StoreType.SQL,
			invoicesMigrations,
		);
		this.invoices = new InvoicesStoreService(store as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
