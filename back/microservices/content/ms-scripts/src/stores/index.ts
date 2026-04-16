import { FileStore, StoreControllerAbstract, StoreType } from "back-core";

export class StoresController extends StoreControllerAbstract {
	public fileStore!: FileStore;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const fileStore = await this.addStore("scripts", StoreType.FILES, []);
		this.fileStore = fileStore as FileStore;

		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
