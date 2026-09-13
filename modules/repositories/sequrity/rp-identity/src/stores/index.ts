import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import usersMigrations from "./users/migrations";
import { UsersStoreService } from "./users/service";

export class StoresController extends StoreControllerAbstract {
	public users: UsersStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const usersStore = await this.addStore(
			"users",
			StoreType.SQL,
			usersMigrations,
		);
		this.users = new UsersStoreService(usersStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
