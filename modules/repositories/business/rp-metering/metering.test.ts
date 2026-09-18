import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { MeterStoreService } from "./src/stores/meter/service";
import meterMigrations from "./src/stores/meter/migrations";

describe("metering", () => {
	let store: SqlStore;
	let meter: MeterStoreService;

	beforeEach(async () => {
		store = new SqlStore(":memory:", meterMigrations, new InMemoryMigrationState());
		await store.open();
		await store.migrate();
		meter = new MeterStoreService(store);
	});

	const use = (owner: string, resource: any, amount: number, at: string) =>
		meter.record([{ owner, resource, amount, at }]);

	it("sums a day per owner and per resource", async () => {
		await use("acme", "tokens", 1000, "2026-09-01T09:00:00.000Z");
		await use("acme", "tokens", 500, "2026-09-01T18:00:00.000Z");
		await use("acme", "bytes", 2048, "2026-09-01T18:00:00.000Z");
		await use("globex", "tokens", 70, "2026-09-01T18:00:00.000Z");

		const rows = await meter.dailyTotals({ owner: "acme" });
		expect(rows).toEqual([
			{ date: "2026-09-01", owner: "acme", resource: "bytes", amount: 2048 },
			{ date: "2026-09-01", owner: "acme", resource: "tokens", amount: 1500 },
		]);
	});

	it("keeps days apart", async () => {
		await use("acme", "ms", 300, "2026-09-01T23:59:59.000Z");
		await use("acme", "ms", 700, "2026-09-02T00:00:01.000Z");

		const rows = await meter.dailyTotals({ owner: "acme" });
		expect(rows.map((row) => [row.date, row.amount])).toEqual([
			["2026-09-01", 300],
			["2026-09-02", 700],
		]);
	});

	it("narrows to the period asked for", async () => {
		await use("acme", "tokens", 10, "2026-08-31T10:00:00.000Z");
		await use("acme", "tokens", 20, "2026-09-02T10:00:00.000Z");

		const rows = await meter.dailyTotals({ owner: "acme", from: "2026-09-01" });
		expect(rows).toHaveLength(1);
		expect(rows[0].amount).toBe(20);
	});

	it("lets a day be claimed once and never again", async () => {
		expect(await meter.claimDay("2026-09-01", "acme", "tokens")).toBe(true);
		expect(await meter.claimDay("2026-09-01", "acme", "tokens")).toBe(false);
	});

	it("claims each owner, resource and day separately", async () => {
		expect(await meter.claimDay("2026-09-01", "acme", "tokens")).toBe(true);
		expect(await meter.claimDay("2026-09-01", "acme", "bytes")).toBe(true);
		expect(await meter.claimDay("2026-09-01", "globex", "tokens")).toBe(true);
		expect(await meter.claimDay("2026-09-02", "acme", "tokens")).toBe(true);
	});
});
