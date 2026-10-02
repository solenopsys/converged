import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import { ClientRepository } from "./clients/client.repository";
import { ContactRepository } from "./clients/contact.repository";
import clientsMigrations from "./clients/migrations";

export class StoresController extends StoreControllerAbstract {
	public clientsStore: SqlStore;
	public clients: ClientRepository;
	public contacts: ContactRepository;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		this.clientsStore = (await this.addStore(
			"clients",
			StoreType.SQL,
			clientsMigrations,
		)) as SqlStore;
		this.clients = new ClientRepository(this.clientsStore);
		this.contacts = new ContactRepository(this.clientsStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
