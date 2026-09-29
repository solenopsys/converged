import {
	ColumnStore,
	SqlStore,
	StoreControllerAbstract,
	StoreType,
} from "back-core";
import eventMigrations from "./events/migrations";
import hotEventMigrations from "./events/migrations/sql";
import { AnalyticsStoreService } from "./events/service";
import countryMigrations from "./geo/country/migrations";
import { GeoCountryStoreService } from "./geo/country/service";
import asnMigrations from "./geo/asn/migrations";
import { GeoAsnStoreService } from "./geo/asn/service";

export class StoresController extends StoreControllerAbstract {
	public hot!: AnalyticsStoreService;
	public cold!: AnalyticsStoreService;
	public geoCountry!: GeoCountryStoreService;
	public geoAsn!: GeoAsnStoreService;

	constructor(msName: string) {
		super(msName);
	}

	async init(): Promise<void> {
		const existingHotType = this.existingHotStoreType();
		const hotIsColumn = existingHotType === "column";
		const hot = await this.addStore(
			"hot",
			hotIsColumn ? StoreType.COLUMN : StoreType.SQL,
			hotIsColumn ? eventMigrations : hotEventMigrations,
		);
		const cold = await this.addStore("cold", StoreType.COLUMN, eventMigrations);
		const geoCountry = await this.addStore(
			"geo_country",
			StoreType.SQL,
			countryMigrations,
		);
		const geoAsn = await this.addStore("geo_asn", StoreType.SQL, asnMigrations);
		this.hot = new AnalyticsStoreService(hot as SqlStore | ColumnStore);
		this.cold = new AnalyticsStoreService(cold as ColumnStore);
		this.geoCountry = new GeoCountryStoreService(geoCountry as SqlStore);
		this.geoAsn = new GeoAsnStoreService(geoAsn as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}

	private existingHotStoreType(): string | undefined {
		try {
			return this.conn.getManifest(this.msName, "hot").storeType;
		} catch {
			return undefined;
		}
	}
}
