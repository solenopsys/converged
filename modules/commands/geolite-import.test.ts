import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import type { AnalyticsServiceClient } from "g-analytics/browser";
import { CsvStreamParser, importGeoLiteDatabase } from "./geolite-import";

describe("GeoLite CSV streaming parser", () => {
	test("parses quoted commas, CRLF and chunk boundaries", () => {
		const parser = new CsvStreamParser();
		const encoder = new TextEncoder();
		const rows = [
			...parser.push(encoder.encode('network,name\r\n"1.2.3.0/24","A,'), false),
			...parser.push(encoder.encode(' B"\r\n'), false),
			...parser.push(new Uint8Array(), true),
		];

		expect(rows).toEqual([
			["network", "name"],
			["1.2.3.0/24", "A, B"],
		]);
	});

	test("preserves UTF-8 characters split between chunks", () => {
		const parser = new CsvStreamParser();
		const encoded = new TextEncoder().encode("1,Москва\n");
		const rows = [
			...parser.push(encoded.slice(0, 4), false),
			...parser.push(encoded.slice(4), true),
		];

		expect(rows).toEqual([["1", "Москва"]]);
	});
});

describe("GeoLite import transport", () => {
	const previousFetch = globalThis.fetch;
	const previousEnv = new Map<string, string | undefined>();
	let cacheServer: ReturnType<typeof Bun.serve> | undefined;
	let archiveDirectory: string | undefined;

	afterEach(async () => {
		globalThis.fetch = previousFetch;
		for (const [name, value] of previousEnv) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		previousEnv.clear();
		cacheServer?.stop(true);
		cacheServer = undefined;
		if (archiveDirectory)
			await rm(archiveDirectory, { recursive: true, force: true });
		archiveDirectory = undefined;
	});

	test("stages CSV batches over HTTP and sends only cache refs over NRPC", async () => {
		archiveDirectory = await mkdtemp(join(tmpdir(), "geolite-import-"));
		const env = {
			MAXMIND_ACCOUNT_ID: "test-account",
			MAXMIND_LICENSE_KEY: "test-license",
			GEOLITE_ARCHIVE_DIR: archiveDirectory,
			SERVICES_URL: "",
			STORAGE_SCOPE: "test-scope",
			SERVICE_TOKEN: "test-token",
		};
		for (const [name, value] of Object.entries(env)) {
			previousEnv.set(name, process.env[name]);
			process.env[name] = value;
		}

		const cached = new Map<string, Uint8Array>();
		let uploads = 0;
		cacheServer = Bun.serve({
			port: 0,
			fetch: async (request) => {
				expect(new URL(request.url).pathname).toBe("/cache/blob");
				expect(request.headers.get("x-storage-scope")).toBe("test-scope");
				expect(request.headers.get("authorization")).toBe("Bearer test-token");
				const bytes = new Uint8Array(await request.arrayBuffer());
				const cacheKey = `cache:test:${++uploads}`;
				cached.set(cacheKey, bytes);
				return Response.json({ cacheKey, sizeBytes: bytes.byteLength });
			},
		});
		process.env.SERVICES_URL = `http://127.0.0.1:${cacheServer.port}/services`;

		const archive = zipSync({
			"GeoLite2-Country_20260930/GeoLite2-Country-Blocks-IPv4.csv": strToU8(
				"network,geoname_id,registered_country_geoname_id\n1.0.0.0/24,1,\n",
			),
			"GeoLite2-Country_20260930/GeoLite2-Country-Blocks-IPv6.csv": strToU8(
				"network,geoname_id,registered_country_geoname_id\n2001:db8::/32,1,\n",
			),
			"GeoLite2-Country_20260930/GeoLite2-Country-Locations-en.csv": strToU8(
				"geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name,subdivision_1_iso_code,subdivision_1_name,city_name,time_zone\n1,en,NA,North America,US,United States,,,,\n",
			),
		});
		let maxmindRequests = 0;
		globalThis.fetch = (async (input, init) => {
			const url = String(input);
			if (url.startsWith("https://download.maxmind.com/")) {
				maxmindRequests += 1;
				return new Response(archive, { status: 200 });
			}
			return previousFetch(input, init);
		}) as typeof fetch;

		const batches: Array<{ kind: string; rows: unknown[] }> = [];
		const client = {
			async importGeoLiteBatch(batch: {
				importId: string;
				dataset: "country" | "city" | "asn";
				kind: "network" | "locations";
				ref: { cacheKey: string };
			}) {
				expect(batch).not.toHaveProperty("rows");
				const bytes = cached.get(batch.ref.cacheKey);
				expect(bytes).toBeDefined();
				const rows = JSON.parse(new TextDecoder().decode(bytes));
				batches.push({ kind: batch.kind, rows });
				return rows.length;
			},
			async completeGeoLiteImport() {
				return 2;
			},
		} as unknown as AnalyticsServiceClient;

		await expect(importGeoLiteDatabase(client, "country")).resolves.toBe(2);
		expect(
			await Bun.file(
				join(archiveDirectory, "GeoLite2-Country-CSV.zip"),
			).exists(),
		).toBe(true);
		expect(maxmindRequests).toBe(1);
		expect(uploads).toBe(3);
		expect(batches.map((batch) => batch.kind)).toEqual([
			"network",
			"network",
			"locations",
		]);
		expect(batches[0]?.rows[0]).toMatchObject({ network: "1.0.0.0/24" });
		expect(batches[2]?.rows[0]).toMatchObject({
			dataset: "country",
			country_code: "US",
		});

		delete process.env.MAXMIND_ACCOUNT_ID;
		delete process.env.MAXMIND_LICENSE_KEY;
		await expect(importGeoLiteDatabase(client, "country")).resolves.toBe(2);
		expect(maxmindRequests).toBe(1);
	});
});
