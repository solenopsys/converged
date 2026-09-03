import { describe, expect, test } from "bun:test";
import { objectRef } from "front-core/object-runtime";
import { referenceFromUrl, urlForReference } from "./workspace-url";

describe("workspace URL", () => {
	test("reads references only from the console route", () => {
		const encoded = encodeURIComponent(
			JSON.stringify(objectRef("orders.order", "42")),
		);
		expect(
			referenceFromUrl(`https://example.test/console?ref=${encoded}`),
		).not.toBeNull();
		expect(referenceFromUrl(`https://example.test/?ref=${encoded}`)).toBeNull();
	});

	test("round-trips an object reference", () => {
		const ref = objectRef("requests.request", "42");
		const url = urlForReference(
			"https://example.test/console?language=ru",
			ref,
		);
		expect(url).toStartWith("/console/?");
		expect(referenceFromUrl(`https://example.test${url}`)).toEqual(ref);
	});
});
