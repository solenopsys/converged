import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import equipmentMigrations from "./stores/equipment/migrations";
import { EquipmentStoreService } from "./stores/equipment/service";

/**
 * The basic contour of the floor: registering a machine, finding it again,
 * reporting what it is doing. Who may see which machine is `access.test.ts`;
 * this suite runs as one operator and is about the record itself.
 */
describe("EquipmentStoreService in-memory", () => {
	let equipment: EquipmentStoreService;

	beforeEach(async () => {
		const store = new SqlStore(
			":memory:",
			equipmentMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		const impl = new EquipmentStoreService(store);
		equipment = new Proxy(impl, {
			get(target, property, receiver) {
				const value = Reflect.get(target, property, receiver);
				if (typeof value !== "function") return value;
				return (...args: unknown[]) =>
					runWithWorkspaceContext({ user: "operator" }, () =>
						(value as (...a: unknown[]) => unknown).apply(target, args),
					);
			},
		}) as EquipmentStoreService;
	});

	const page = { offset: 0, limit: 50 };

	it("registers a machine and reads back everything it was given", async () => {
		const id = await equipment.registerEquipment({
			kind: "fdm",
			name: "Bambu X1C #1",
			classifierNodeId: "bambulab/x1-carbon",
			deviceId: "printer-1",
			serialNumber: "00M09A351100001",
			location: "Bay 2",
			maintenanceIntervalDays: 90,
		});

		const saved = await equipment.getEquipment(id);
		expect(saved?.kind).toBe("fdm");
		expect(saved?.name).toBe("Bambu X1C #1");
		// Both of these used to be dropped on the way in: the column existed and
		// nothing wrote to it.
		expect(saved?.classifierNodeId).toBe("bambulab/x1-carbon");
		expect(saved?.deviceId).toBe("printer-1");
		expect(saved?.location).toBe("Bay 2");
		expect(saved?.status).toBe("idle");
	});

	it("lists machines and narrows the listing by kind, status and device key", async () => {
		await equipment.registerEquipment({
			kind: "fdm",
			deviceId: "printer-1",
			status: "running",
		});
		await equipment.registerEquipment({ kind: "cnc", deviceId: "mill-1" });

		expect((await equipment.listEquipment(page)).totalCount).toBe(2);
		expect(
			(await equipment.listEquipment({ ...page, kind: "cnc" })).items,
		).toHaveLength(1);
		expect(
			(await equipment.listEquipment({ ...page, status: "running" })).items[0]
				?.deviceId,
		).toBe("printer-1");

		// The way back from a telemetry row, which carries only `device_id`.
		const found = await equipment.listEquipment({
			...page,
			deviceId: "mill-1",
		});
		expect(found.items).toHaveLength(1);
		expect(found.items[0]?.kind).toBe("cnc");
		expect(found.totalCount).toBe(1);
	});

	it("reports a state change and clears the job when it is handed back empty", async () => {
		const id = await equipment.registerEquipment({ kind: "fdm" });

		await equipment.updateState(id, { status: "running", jobId: "order-7" });
		expect((await equipment.getEquipment(id))?.status).toBe("running");
		expect((await equipment.getEquipment(id))?.jobId).toBe("order-7");

		// Status alone leaves the job alone; an empty job ends it.
		await equipment.updateState(id, { status: "error" });
		expect((await equipment.getEquipment(id))?.jobId).toBe("order-7");
		await equipment.updateState(id, { status: "idle", jobId: "" });
		expect((await equipment.getEquipment(id))?.jobId).toBeUndefined();
	});

	it("corrects the device key and treats a blank one as no key", async () => {
		const id = await equipment.registerEquipment({
			kind: "fdm",
			deviceId: "wrong-1",
		});

		await equipment.patchEquipment(id, { deviceId: "printer-1" });
		expect((await equipment.getEquipment(id))?.deviceId).toBe("printer-1");

		await equipment.patchEquipment(id, { deviceId: "" });
		expect((await equipment.getEquipment(id))?.deviceId).toBeUndefined();
	});

	it("lets many machines have no device key but only one hold a given key", async () => {
		// Nothing reports for either of these yet, and that is a normal floor.
		await equipment.registerEquipment({ kind: "fdm" });
		await equipment.registerEquipment({ kind: "fdm", deviceId: "  " });
		expect((await equipment.listEquipment(page)).totalCount).toBe(2);

		await equipment.registerEquipment({
			kind: "fdm",
			name: "Bambu X1C #1",
			deviceId: "printer-1",
		});
		// Two machines under one key would pour their samples into one chart, and
		// the refusal names the machine holding it rather than the constraint.
		expect(
			equipment.registerEquipment({ kind: "sla", deviceId: "printer-1" }),
		).rejects.toThrow(/printer-1 belongs to Bambu X1C #1/);
	});

	it("lets a machine keep its own device key through an unrelated edit", async () => {
		const id = await equipment.registerEquipment({
			kind: "fdm",
			deviceId: "printer-1",
		});

		// Handing back the key it already holds is not a collision with itself.
		await equipment.patchEquipment(id, {
			deviceId: "printer-1",
			location: "Bay 3",
		});
		expect((await equipment.getEquipment(id))?.location).toBe("Bay 3");

		const other = await equipment.registerEquipment({ kind: "sla" });
		expect(
			equipment.patchEquipment(other, { deviceId: "printer-1" }),
		).rejects.toThrow(/already used/);
	});

	it("counts the floor by status and calls utilisation what is running now", async () => {
		await equipment.registerEquipment({ kind: "fdm", status: "running" });
		await equipment.registerEquipment({ kind: "fdm", status: "running" });
		await equipment.registerEquipment({ kind: "cnc", status: "maintenance" });
		await equipment.registerEquipment({ kind: "laser" });

		const dashboard = await equipment.getEquipmentDashboard();
		expect(dashboard.total).toBe(4);
		expect(
			dashboard.statusCounts.find((entry) => entry.status === "running")?.count,
		).toBe(2);
		expect(
			dashboard.statusCounts.find((entry) => entry.status === "idle")?.count,
		).toBe(1);
		expect(dashboard.utilizationPercent).toBe(50);
	});

	it("removes a machine and says whether there was one", async () => {
		const id = await equipment.registerEquipment({ kind: "fdm" });

		expect(await equipment.deleteEquipment(id)).toBe(true);
		expect(await equipment.getEquipment(id)).toBeUndefined();
		expect((await equipment.listEquipment(page)).totalCount).toBe(0);
	});
});
