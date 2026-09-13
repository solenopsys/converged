import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import staffMigrations from "./stores/staff/migrations";
import { StaffStoreService } from "./stores/staff/service";

/**
 * The address is what joins a card to an identity, so the only interesting
 * questions are how it is matched and who is allowed to match on it.
 */
describe("the address on a staff card", () => {
	let store: SqlStore;
	let staff: StaffStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			staffMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		staff = new StaffStoreService(store);
	});

	it("matches however the address was typed", async () => {
		await as("hr", () =>
			staff.createStaff({ name: "Anna", email: "  Anna@Shop.test " } as any),
		);

		const found = await as("boris", () =>
			staff.getStaffByEmail("ANNA@shop.test"),
		);
		expect(found).toMatchObject({ name: "Anna", email: "anna@shop.test" });
	});

	it("answers nothing for an address nobody filed", async () => {
		expect(
			await as("hr", () => staff.getStaffByEmail("ghost@shop.test")),
		).toBeUndefined();
		expect(await as("hr", () => staff.getStaffByEmail("  "))).toBeUndefined();
	});

	it("does not let the lookup reach a colleague the caller is not shown", async () => {
		const anna = await as("hr", () =>
			staff.createStaff({ name: "Anna", email: "anna@shop.test" } as any),
		);
		await staff.access.setVisibility(anna, "private");
		await staff.access.grant(anna, "team-hr");

		// Otherwise the roster becomes a way to probe for addresses: "is this
		// person here?" answered for a card the caller may not read.
		expect(
			await as("boris", () => staff.getStaffByEmail("anna@shop.test")),
		).toBeUndefined();
		expect(
			await as("clerk", () => staff.getStaffByEmail("anna@shop.test"), [
				"team-hr",
			]),
		).toMatchObject({ id: anna });
	});

	it("keeps the address and the language on the card", async () => {
		const id = await as("hr", () =>
			staff.createStaff({
				name: "Anna",
				email: "anna@shop.test",
				lang: "ru",
				contact: "@anna",
			} as any),
		);

		expect(await as("hr", () => staff.getStaff(id))).toMatchObject({
			email: "anna@shop.test",
			lang: "ru",
			contact: "@anna",
		});
	});

	it("re-points the address when the card is edited", async () => {
		const id = await as("hr", () =>
			staff.createStaff({ name: "Anna", email: "anna@shop.test" } as any),
		);

		await as("hr", () =>
			staff.updateStaff(id, { email: "Anna.New@Shop.test" }),
		);

		expect(
			await as("hr", () => staff.getStaffByEmail("anna@shop.test")),
		).toBeUndefined();
		expect(
			await as("hr", () => staff.getStaffByEmail("anna.new@shop.test")),
		).toMatchObject({ id });
	});

	it("finds a card by address through the roster search", async () => {
		await as("hr", () =>
			staff.createStaff({ name: "Anna", email: "anna@shop.test" } as any),
		);

		const found = await as("boris", () =>
			staff.listStaff({ offset: 0, limit: 10, query: "anna@shop" } as any),
		);
		expect(found.items).toHaveLength(1);
	});

	it("narrows the roster by role, which is what the projection tabs do", async () => {
		await as("hr", () =>
			staff.createStaff({ name: "Anna", role: "operator" } as any),
		);
		await as("hr", () =>
			staff.createStaff({ name: "Boris", role: "manager" } as any),
		);

		const operators = await as("carol", () =>
			staff.listStaff({ offset: 0, limit: 10, role: "operator" } as any),
		);
		expect(operators.items.map((item) => item.name)).toEqual(["Anna"]);
	});
});
