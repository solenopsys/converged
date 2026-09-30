import { describe, expect, test } from "bun:test";
import { CsvStreamParser } from "./geolite-import";

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
