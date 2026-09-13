import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import { ReviewInvitesStoreService } from "./invites";
import { ReviewsMetadataStoreService } from "./metadata";
import metadataMigrations from "./metadata/migrations";
import { ReviewSettingsStoreService } from "./settings";

/**
 * Reviews, the links that asked for them and the settings that shape both live
 * in one SQL store on purpose: they are read together on every screen, and a
 * second store would buy nothing but a join this service cannot do.
 */
export class StoresController extends StoreControllerAbstract {
	public metadata: ReviewsMetadataStoreService;
	public invites: ReviewInvitesStoreService;
	public settings: ReviewSettingsStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const metadataStore = await this.addStore(
			"metadata",
			StoreType.SQL,
			metadataMigrations,
		);

		this.metadata = new ReviewsMetadataStoreService(metadataStore as SqlStore);
		this.invites = new ReviewInvitesStoreService(metadataStore as SqlStore);
		this.settings = new ReviewSettingsStoreService(metadataStore as SqlStore);

		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
