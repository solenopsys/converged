import {
	StoreControllerAbstract,
	StoreType,
	KVStore,
	JsonStore,
	getCurrentStorageScope,
	isCloudStorageScopeRequired,
} from "back-core";
import { AccessStoreService } from "./access/service";

export class StoresController extends StoreControllerAbstract {
	public access: AccessStoreService;
	private readonly migratedLegacyScopes = new Set<string>();

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const accessStore = await this.addStore("access", StoreType.KVS, []);
		const presetsStore = await this.addStore("presets", StoreType.JSON, []);
		this.access = new AccessStoreService(
			accessStore as KVStore,
			presetsStore as JsonStore,
		);
		await this.startAll();
		await this.migrateAll();
	}

	async migrateLegacyPresetsForCurrentScope(): Promise<void> {
		const scope = getCurrentStorageScope();
		if (!scope && isCloudStorageScopeRequired()) return;

		await this.ensureCurrentScopeReady();
		const key = scope ?? "__global__";
		if (this.migratedLegacyScopes.has(key)) return;

		await this.access.migrateLegacyPresetsFromAccessStore();
		this.migratedLegacyScopes.add(key);
	}

	async destroy() {
		await this.closeAll();
	}
}
