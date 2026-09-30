import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Unzip, UnzipInflate } from "fflate";
import type {
	AnalyticsServiceClient,
	GeoLiteAsnNetworkInput,
	GeoLiteCityNetworkInput,
	GeoLiteCountryNetworkInput,
	GeoLiteDataset,
	GeoLiteImportBatch,
	GeoLiteLocationInput,
} from "g-analytics/browser";

const BATCH_SIZE = 1_000;
const encoder = new TextEncoder();
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
	fileName: string;
	data: Uint8Array;
	final: boolean;
};
type ImportProgress = {
	fileName: string;
	phase: string;
	processedRows: number;
	completedBatches: number;
	batchNumber: number;
	batchRows: number;
	startedAt: number;
};

export async function importGeoLiteDatabase(
	client: AnalyticsServiceClient,
	dataset: GeoLiteDataset,
): Promise<number> {
	const editions: Record<GeoLiteDataset, string> = {
		country: "GeoLite2-Country-CSV",
		city: "GeoLite2-City-CSV",
		asn: "GeoLite2-ASN-CSV",
	};
	const archivePath = await getGeoLiteArchive(dataset, editions[dataset]);
	const archive = Bun.file(archivePath);
	console.log(
		`GeoLite2 ${dataset}: reading archive ${archivePath} (${archive.size.toLocaleString()} bytes)`,
	);

	const importId = crypto.randomUUID();
	const pending: PendingChunk[] = [];
	const seen = new Set<string>();
	const progress: ImportProgress = {
		fileName: "archive",
		phase: "decompressing archive",
		processedRows: 0,
		completedBatches: 0,
		batchNumber: 0,
		batchRows: 0,
		startedAt: Date.now(),
	};
	let networkRows = 0;
	let locationRows = 0;
	const unzip = new Unzip((file) => {
		const kind = getCsvKind(dataset, file.name);
		if (!kind) return;
		const parts = file.name.split("/");
		seen.add(parts[parts.length - 1] ?? file.name);
		console.log(`GeoLite2 ${dataset}: reading ${file.name}`);
		const importer = new CsvBatchImporter(
			client,
			dataset,
			kind,
			importId,
			progress,
		);
		const parser = new CsvStreamParser();
		file.ondata = (error, data, final) => {
			if (error) throw error;
			pending.push({
				parser,
				importer,
				kind,
				fileName: file.name,
				data,
				final,
			});
		};
		file.start();
	});
	unzip.register(UnzipInflate);

	const drain = async () => {
		while (pending.length) {
			const chunk = pending.shift();
			if (!chunk) continue;
			progress.fileName = chunk.fileName;
			progress.phase = "parsing CSV";
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

	const reader = archive.stream().getReader();
	const heartbeat = setInterval(() => {
		const elapsedSeconds = Math.max(
			1,
			(Date.now() - progress.startedAt) / 1_000,
		);
		const rowsPerSecond = Math.round(progress.processedRows / elapsedSeconds);
		console.log(
			`GeoLite2 ${dataset}: ${progress.fileName} | ${progress.phase} | batch ${progress.batchNumber} (${progress.batchRows} rows), ${progress.completedBatches} complete | ${progress.processedRows.toLocaleString()} rows at ${rowsPerSecond.toLocaleString()}/s`,
		);
	}, 10_000);
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			unzip.push(value, false);
			await drain();
		}
		unzip.push(new Uint8Array(0), true);
		await drain();

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

		progress.phase = "finalizing database import";
		console.log(
			`GeoLite2 ${dataset}: finalizing ${progress.processedRows.toLocaleString()} rows`,
		);
		const count = await client.completeGeoLiteImport(dataset, importId);
		const elapsedSeconds = Math.max(
			1,
			(Date.now() - progress.startedAt) / 1_000,
		);
		console.log(
			`GeoLite2 ${dataset}: imported ${networkRows.toLocaleString()} networks${dataset === "asn" ? "" : ` and ${locationRows.toLocaleString()} locations`}; ${count.toLocaleString()} network records now stored in ${elapsedSeconds.toFixed(1)}s.`,
		);
		return count;
	} catch (error) {
		await reader.cancel(error).catch(() => {});
		console.error(
			`GeoLite2 ${dataset}: stopped during ${progress.phase} in ${progress.fileName}; ${progress.processedRows.toLocaleString()} rows and ${progress.completedBatches} batches completed`,
		);
		throw error;
	} finally {
		reader.releaseLock();
		clearInterval(heartbeat);
	}
}

async function getGeoLiteArchive(
	dataset: GeoLiteDataset,
	edition: string,
): Promise<string> {
	const archiveDir =
		process.env.GEOLITE_ARCHIVE_DIR?.trim() ||
		join(process.cwd(), "data", "geolite");
	await mkdir(archiveDir, { recursive: true });
	const archivePath = join(archiveDir, `${edition}.zip`);
	if (await isFileFromToday(archivePath)) {
		console.log(`GeoLite2 ${dataset}: reusing today's archive ${archivePath}`);
		return archivePath;
	}

	const accountId = process.env.MAXMIND_ACCOUNT_ID?.trim();
	const licenseKey = process.env.MAXMIND_LICENSE_KEY?.trim();
	if (!accountId || !licenseKey) {
		throw new Error(
			`No today's ${edition}.zip archive found. Set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY to download it`,
		);
	}

	console.log(`GeoLite2 ${dataset}: requesting archive from MaxMind`);
	let downloadWaitSeconds = 0;
	const downloadHeartbeat = setInterval(() => {
		downloadWaitSeconds += 10;
		console.log(
			`GeoLite2 ${dataset}: still waiting for MaxMind archive headers (${downloadWaitSeconds}s)`,
		);
	}, 10_000);
	let response: Response;
	try {
		response = await fetch(
			`https://download.maxmind.com/geoip/databases/${edition}/download?suffix=zip`,
			{
				headers: {
					Authorization: `Basic ${btoa(`${accountId}:${licenseKey}`)}`,
				},
				redirect: "follow",
			},
		);
	} finally {
		clearInterval(downloadHeartbeat);
	}
	if (!response.ok) {
		const detail = (await response.text()).replace(/\s+/g, " ").trim();
		throw new Error(
			`MaxMind download failed (${response.status})${detail ? `: ${detail.slice(0, 500)}` : ""}`,
		);
	}
	if (!response.body) {
		throw new Error("MaxMind download returned an empty response body");
	}

	const temporaryPath = `${archivePath}.${process.pid}.part`;
	try {
		await pipeline(
			Readable.fromWeb(response.body),
			createWriteStream(temporaryPath, { flags: "w" }),
		);
		await rename(temporaryPath, archivePath);
	} catch (error) {
		await unlink(temporaryPath).catch(() => {});
		throw error;
	}
	console.log(`GeoLite2 ${dataset}: saved archive ${archivePath}`);
	return archivePath;
}

async function isFileFromToday(path: string): Promise<boolean> {
	try {
		const modifiedAt = (await stat(path)).mtime;
		const today = new Date();
		return (
			modifiedAt.getFullYear() === today.getFullYear() &&
			modifiedAt.getMonth() === today.getMonth() &&
			modifiedAt.getDate() === today.getDate()
		);
	} catch {
		return false;
	}
}

async function stageBatchInCache(
	rows: ImportRow[],
): Promise<GeoLiteImportBatch["ref"]> {
	const configuredServiceUrl =
		process.env.SERVICES_URL || process.env.SERVICES_BASE;
	if (!configuredServiceUrl && isRemoteFujinTarget(process.env.FUJIN_WS_URL)) {
		throw new Error(
			"SERVICES_BASE must target the same deployment as FUJIN_WS_URL; refusing to stage GeoLite batches in localhost cache",
		);
	}
	const serviceUrl = configuredServiceUrl || "http://127.0.0.1:3000/services";
	const endpoint = new URL(serviceUrl);
	const basePath = endpoint.pathname
		.replace(/\/services\/*$/, "")
		.replace(/\/*$/, "");
	endpoint.pathname = `${basePath}/cache/blob`;
	endpoint.search = "";
	endpoint.hash = "";
	const headers: Record<string, string> = {
		"Content-Type": "application/octet-stream",
	};
	const serviceToken = process.env.SERVICE_TOKEN?.trim();
	const scope =
		process.env.STORAGE_SCOPE?.trim() || process.env.WORKSPACE?.trim();
	if (serviceToken) headers.Authorization = `Bearer ${serviceToken}`;
	if (scope) headers["X-Storage-Scope"] = scope;

	const response = await fetch(endpoint, {
		method: "POST",
		headers,
		body: encoder.encode(JSON.stringify(rows)),
	});
	if (!response.ok) {
		const detail = (await response.text()).replace(/\s+/g, " ").trim();
		throw new Error(
			`Cache upload failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
		);
	}
	const value = (await response.json()) as {
		cacheKey?: unknown;
		sizeBytes?: unknown;
	};
	if (typeof value.cacheKey !== "string" || !value.cacheKey) {
		throw new Error("Cache upload returned an invalid reference");
	}
	return {
		cacheKey: value.cacheKey,
		sizeBytes:
			typeof value.sizeBytes === "number" ? value.sizeBytes : undefined,
	};
}

function isRemoteFujinTarget(value?: string): boolean {
	if (!value?.trim()) return false;
	try {
		const host = new URL(value).hostname;
		return !["localhost", "127.0.0.1", "::1"].includes(host);
	} catch {
		return value.startsWith("/");
	}
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
		private readonly progress: ImportProgress,
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
		this.progress.batchNumber += 1;
		this.progress.batchRows = rows.length;
		this.progress.phase = "uploading batch to HTTP cache";
		const ref = await stageBatchInCache(rows);
		this.progress.phase = "waiting for NRPC/SQL insert";
		await this.client.importGeoLiteBatch({
			importId: this.importId,
			dataset: this.dataset,
			kind: this.kind,
			ref,
		});
		const previousRows = this.progress.processedRows;
		this.processed += rows.length;
		this.progress.processedRows += rows.length;
		this.progress.completedBatches += 1;
		this.progress.phase = "streaming CSV";
		if (
			Math.floor(previousRows / 10_000) <
			Math.floor(this.progress.processedRows / 10_000)
		) {
			console.log(
				`GeoLite2 ${this.dataset}: ${this.progress.processedRows.toLocaleString()} rows (${this.progress.completedBatches} batches)`,
			);
		}
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
