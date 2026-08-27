import { describe, expect, test } from "bun:test";
import { mountActionFromUrl, urlForMountAction } from "./workspace-url";

describe("workspace URL", () => {
	test("writes a mounted workspace tab to the console route", () => {
		expect(urlForMountAction("https://example.test/about?language=ru", "orders.list"))
			.toBe("/console?language=ru&mount=orders.list");
	});

	test("reads a mount only from the console route", () => {
		expect(mountActionFromUrl("https://example.test/console?mount=orders.list"))
			.toBe("orders.list");
		expect(mountActionFromUrl("https://example.test/?mount=orders.list")).toBeNull();
	});
});
