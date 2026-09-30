import {
	type ColumnStore,
	type SqlStore,
	StoreControllerAbstract,
	StoreType,
} from "back-core";
import ipSessionMigrations from "./activity/migrations";
import { IpSessionsStoreService } from "./activity/service";
import eventMigrations from "./events/migrations";
import hotEventMigrations from "./events/migrations/sql";
import { AnalyticsStoreService } from "./events/service";
import asnMigrations from "./geo/asn/migrations";
import { GeoAsnStoreService } from "./geo/asn/service";
import cityMigrations from "./geo/city/migrations";
import { GeoCityStoreService } from "./geo/city/service";
import countryMigrations from "./geo/country/migrations";
import { GeoCountryStoreService } from "./geo/country/service";

export class StoresController extends StoreControllerAbstract {
	public hot!: AnalyticsStoreService;
	public cold!: AnalyticsStoreService;
	public ipSessions!: IpSessionsStoreService;
	public geoCountry!: GeoCountryStoreService;
	public geoAsn!: GeoAsnStoreService;
	public geoCity!: GeoCityStoreService;

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
		const ipSessions = await this.addStore(
			"ip_sessions",
			StoreType.SQL,
			ipSessionMigrations,
		);
		const geoCountry = await this.addStore(
			"geo_country",
			StoreType.SQL,
			countryMigrations,
		);
		const geoAsn = await this.addStore("geo_asn", StoreType.SQL, asnMigrations);
		const geoCity = await this.addStore(
			"geo_city",
			StoreType.SQL,
			cityMigrations,
		);
		this.hot = new AnalyticsStoreService(hot as SqlStore | ColumnStore);
		this.cold = new AnalyticsStoreService(cold as ColumnStore);
		this.ipSessions = new IpSessionsStoreService(ipSessions as SqlStore);
		this.geoCountry = new GeoCountryStoreService(geoCountry as SqlStore);
		this.geoAsn = new GeoAsnStoreService(geoAsn as SqlStore);
		this.geoCity = new GeoCityStoreService(geoCity as SqlStore);
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
