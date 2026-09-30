import { Unzip, UnzipInflate } from "fflate";
import type {
	AnalyticsServiceClient,
	GeoLiteAsnNetworkInput,
	GeoLiteCityNetworkInput,
	GeoLiteCountryNetworkInput,
	GeoLiteDataset,
	GeoLiteLocationInput,
} from "g-analytics/browser";

const BATCH_SIZE = 1_000;
type CsvKind = "network" | "locations";
type ImportRow =
	| GeoLiteCountryNetworkInput
	| GeoLiteCityNetworkInput
	| GeoLiteLocationInput
	| GeoLiteAsnNetworkInput;
type PendingChunk = {
	parser: CsvStreamParser;
	importer: CsvBatchImporter;
	kind: CsvKind;
	data: Uint8Array;
	final: boolean;
};

export async function importGeoLiteDatabase(
	client: AnalyticsServiceClient,
	dataset: GeoLiteDataset,
): Promise<number> {
	const accountId = process.env.MAXMIND_ACCOUNT_ID?.trim();
	const licenseKey = process.env.MAXMIND_LICENSE_KEY?.trim();
	if (!accountId || !licenseKey) {
		throw new Error(
			"Set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY to download GeoLite databases",
		);
	}
	const editions: Record<GeoLiteDataset, string> = {
		country: "GeoLite2-Country-CSV",
		city: "GeoLite2-City-CSV",
		asn: "GeoLite2-ASN-CSV",
	};
	const credentials = btoa(`${accountId}:${licenseKey}`);
	const response = await fetch(
		`https://download.maxmind.com/geoip/databases/${editions[dataset]}/download?suffix=zip`,
		{
			headers: { Authorization: `Basic ${credentials}` },
			redirect: "follow",
		},
	);
	if (!response.ok || !response.body) {
		throw new Error(`MaxMind download failed (${response.status})`);
	}

	const importId = crypto.randomUUID();
	const pending: PendingChunk[] = [];
	const seen = new Set<string>();
	let totalProcessed = 0;
	let networkRows = 0;
	let locationRows = 0;
	const unzip = new Unzip((file) => {
		const kind = getCsvKind(dataset, file.name);
		if (!kind) return;
		const parts = file.name.split("/");
		seen.add(parts[parts.length - 1] ?? file.name);
		let fileProcessed = 0;
		const importer = new CsvBatchImporter(
			client,
			dataset,
			kind,
			importId,
			(count) => {
				const previous = totalProcessed;
				totalProcessed += count - fileProcessed;
				fileProcessed = count;
				if (
					Math.floor(previous / 100_000) < Math.floor(totalProcessed / 100_000)
				) {
					console.log(`Imported ${totalProcessed.toLocaleString()} rows`);
				}
			},
		);
		const parser = new CsvStreamParser();
		file.ondata = (error, data, final) => {
			if (error) throw error;
			pending.push({ parser, importer, kind, data, final });
		};
		file.start();
	});
	unzip.register(UnzipInflate);

	const drain = async () => {
		while (pending.length) {
			const chunk = pending.shift();
			if (!chunk) continue;
			for (const row of chunk.parser.push(chunk.data, chunk.final)) {
				await chunk.importer.accept(row);
			}
			if (chunk.final) {
				const count = await chunk.importer.finish();
				if (chunk.kind === "network") networkRows += count;
				else locationRows += count;
			}
		}
	};

	const reader = response.body.getReader();
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			unzip.push(value, false);
			await drain();
		}
		unzip.push(new Uint8Array(0), true);
		await drain();
	} catch (error) {
		await reader.cancel(error).catch(() => {});
		throw error;
	} finally {
		reader.releaseLock();
	}

	const prefix =
		dataset === "asn" ? "ASN" : dataset === "city" ? "City" : "Country";
	const required = [
		`GeoLite2-${prefix}-Blocks-IPv4.csv`,
		`GeoLite2-${prefix}-Blocks-IPv6.csv`,
		...(dataset === "asn" ? [] : [`GeoLite2-${prefix}-Locations-en.csv`]),
	];
	const missing = required.filter((name) => !seen.has(name));
	if (missing.length)
		throw new Error(`Archive is missing ${missing.join(", ")}`);
	if (networkRows === 0 || (dataset !== "asn" && locationRows === 0)) {
		throw new Error(
			"GeoLite archive has no importable rows; import not finalized",
		);
	}

	const count = await client.completeGeoLiteImport(dataset, importId);
	console.log(
		`GeoLite2 ${dataset}: imported ${networkRows.toLocaleString()} networks${dataset === "asn" ? "" : ` and ${locationRows.toLocaleString()} locations`}; ${count.toLocaleString()} network records now stored.`,
	);
	return count;
}

function getCsvKind(
	dataset: GeoLiteDataset,
	entryName: string,
): CsvKind | null {
	const parts = entryName.split("/");
	const file = parts[parts.length - 1] ?? "";
	const prefix =
		dataset === "asn" ? "ASN" : dataset === "city" ? "City" : "Country";
	if (new RegExp(`^GeoLite2-${prefix}-Blocks-IPv[46]\\.csv$`).test(file)) {
		return "network";
	}
	if (dataset !== "asn" && file === `GeoLite2-${prefix}-Locations-en.csv`) {
		return "locations";
	}
	return null;
}

class CsvBatchImporter {
	private headers: string[] | null = null;
	private batch: ImportRow[] = [];
	private processed = 0;

	constructor(
		private readonly client: AnalyticsServiceClient,
		private readonly dataset: GeoLiteDataset,
		private readonly kind: CsvKind,
		private readonly importId: string,
		private readonly onProgress: (count: number) => void,
	) {}

	async accept(row: string[]): Promise<void> {
		if (!this.headers) {
			this.headers = row.map((value) => value.trim());
			return;
		}
		const values = Object.fromEntries(
			this.headers.map((header, index) => [header, row[index] ?? ""]),
		);
		const item = this.toInput(values);
		if (!item) return;
		this.batch.push(item);
		if (this.batch.length >= BATCH_SIZE) await this.flush();
	}

	async finish(): Promise<number> {
		await this.flush();
		return this.processed;
	}

	private toInput(values: Record<string, string>): ImportRow | null {
		if (this.kind === "locations" && this.dataset !== "asn") {
			const id = Number(values.geoname_id);
			if (!Number.isSafeInteger(id) || id <= 0) return null;
			return {
				dataset: this.dataset,
				geoname_id: id,
				continent_code: values.continent_code ?? "",
				continent_name: values.continent_name ?? "",
				country_code: values.country_iso_code ?? "",
				country_name: values.country_name ?? "",
				region_code: values.subdivision_1_iso_code ?? "",
				region_name: values.subdivision_1_name ?? "",
				city_name: values.city_name ?? "",
				time_zone: values.time_zone ?? "",
			};
		}
		const network = values.network?.trim();
		if (!network) return null;
		if (this.dataset === "asn") {
			const asn = Number(values.autonomous_system_number);
			if (!Number.isSafeInteger(asn) || asn <= 0) return null;
			return {
				network,
				asn,
				organization: values.autonomous_system_organization ?? "",
			};
		}
		const geonameId = Number(values.geoname_id);
		const registeredId = Number(values.registered_country_geoname_id);
		const ids = {
			...(Number.isSafeInteger(geonameId) && geonameId > 0
				? { geoname_id: geonameId }
				: {}),
			...(Number.isSafeInteger(registeredId) && registeredId > 0
				? { registered_country_geoname_id: registeredId }
				: {}),
		};
		return { network, ...ids };
	}

	private async flush(): Promise<void> {
		if (this.batch.length === 0) return;
		const rows = this.batch;
		this.batch = [];
		if (this.kind === "locations") {
			await this.client.importGeoLiteLocationsBatch(
				this.importId,
				this.dataset as "country" | "city",
				rows as GeoLiteLocationInput[],
			);
		} else if (this.dataset === "country") {
			await this.client.importGeoLiteCountryBatch(
				this.importId,
				rows as GeoLiteCountryNetworkInput[],
			);
		} else if (this.dataset === "city") {
			await this.client.importGeoLiteCityBatch(
				this.importId,
				rows as GeoLiteCityNetworkInput[],
			);
		} else {
			await this.client.importGeoLiteAsnBatch(
				this.importId,
				rows as GeoLiteAsnNetworkInput[],
			);
		}
		this.processed += rows.length;
		this.onProgress(this.processed);
	}
}

export class CsvStreamParser {
	private decoder = new TextDecoder();
	private field = "";
	private row: string[] = [];
	private quoted = false;
	private quotePending = false;

	push(bytes: Uint8Array, final: boolean): string[][] {
		const text = this.decoder.decode(bytes, { stream: !final });
		const rows: string[][] = [];
		for (const char of text) {
			if (this.quotePending) {
				this.quotePending = false;
				if (char === '"') {
					this.field += '"';
					continue;
				}
				this.quoted = false;
			}
			if (this.quoted) {
				if (char === '"') this.quotePending = true;
				else this.field += char;
				continue;
			}
			if (char === '"' && this.field.length === 0) this.quoted = true;
			else if (char === ",") {
				this.row.push(this.field);
				this.field = "";
			} else if (char === "\n") {
				this.row.push(this.field.replace(/\r$/, ""));
				this.field = "";
				rows.push(this.row);
				this.row = [];
			} else this.field += char;
		}
		if (final) {
			if (this.quotePending) {
				this.quotePending = false;
				this.quoted = false;
			}
			if (this.field.length > 0 || this.row.length > 0) {
				this.row.push(this.field.replace(/\r$/, ""));
				rows.push(this.row);
				this.field = "";
				this.row = [];
			}
		}
		return rows;
	}
}
