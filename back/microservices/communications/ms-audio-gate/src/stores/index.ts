import { JsonStore, StoreControllerAbstract, StoreType } from "back-core";
import { PhoneNumberStoreService } from "./phone-numbers/service";

export class StoresController extends StoreControllerAbstract {
	public phoneNumbers!: PhoneNumberStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const phoneNumbersStore = await this.addStore(
			"phone-numbers",
			StoreType.JSON,
			[],
		);

		this.phoneNumbers = new PhoneNumberStoreService(
			phoneNumbersStore as JsonStore,
		);

		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
