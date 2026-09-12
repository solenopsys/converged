import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import equipmentMigrations from "./stores/equipment/migrations";
import { EquipmentStoreService } from "./stores/equipment/service";
import logsMigrations from "./stores/logs/migrations";
import { EquipmentLogsStoreService } from "./stores/logs/service";
import scheduleMigrations from "./stores/schedule/migrations";
import { ScheduleStoreService } from "./stores/schedule/service";

/**
 * Three stores, three relations. The shop floor keeps seeing its machines; what
 * the tags add is that reporting state or booking time is the machine's
 * people's, and that a log line and a slot carry the audience of the machine
 * they hang on even though they cannot join to it.
 */
describe("who sees which machines, logs and slots", () => {
  let equipment: EquipmentStoreService;
  let logs: EquipmentLogsStoreService;
  let schedule: ScheduleStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  const openStore = async (migrations: any) => {
    const store = new SqlStore(
      ":memory:",
      migrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    return store;
  };

  beforeEach(async () => {
    equipment = new EquipmentStoreService(await openStore(equipmentMigrations));
    logs = new EquipmentLogsStoreService(
      await openStore(logsMigrations),
      equipment.access,
    );
    schedule = new ScheduleStoreService(
      await openStore(scheduleMigrations),
      equipment.access,
    );
  });

  const register = (actor: string, kind = "printer") =>
    as(actor, () => equipment.registerEquipment({ kind } as any));

  it("shows the machines to any authenticated caller and to no anonymous one", async () => {
    await register("agent-1");

    expect(
      (await as("alice", () => equipment.listEquipment({} as any))).totalCount,
    ).toBe(1);
    expect((await equipment.listEquipment({} as any)).totalCount).toBe(0);
  });

  it("refuses a state report from someone who only sees the machine", async () => {
    const printer = await register("agent-1");

    await as("alice", async () => {
      expect(
        equipment.updateState(printer, { status: "maintenance" } as any),
      ).rejects.toThrow(AccessDeniedError);
    });
    expect(
      await as("agent-1", () =>
        equipment.updateState(printer, { status: "running" } as any),
      ),
    ).toBeUndefined();
  });

  it("gives a log line and a slot the machine's audience", async () => {
    const printer = await register("agent-1");
    const line = await as("alice", () =>
      logs.addLog({
        equipmentId: printer,
        eventType: "job.finished",
        description: "done",
      } as any),
    );
    const slot = await as("alice", () =>
      schedule.createSlot({
        equipmentId: printer,
        startAt: "2026-09-14T08:00:00.000Z",
        endAt: "2026-09-14T10:00:00.000Z",
      } as any),
    );

    const machineTags = (await equipment.access.tagsOf(printer)).sort();
    expect((await logs.access.tagsOf(line)).sort()).toEqual(machineTags);
    expect((await schedule.access.tagsOf(slot)).sort()).toEqual(machineTags);
  });

  it("keeps a narrowed machine's log lines and slots narrowed with it", async () => {
    const printer = await register("agent-1");
    await equipment.access.setVisibility(printer, "private");
    await equipment.access.grant(printer, "team-lab");

    const line = await as(
      "tech",
      () =>
        logs.addLog({
          equipmentId: printer,
          eventType: "job.finished",
          description: "done",
        } as any),
      ["team-lab"],
    );

    expect(
      (await as("alice", () => logs.listLogs({} as any))).totalCount,
    ).toBe(0);
    expect(
      (await as("tech", () => logs.listLogs({} as any), ["team-lab"])).items.map(
        (l) => l.id,
      ),
    ).toEqual([line]);
  });

  it("refuses to log against or book a machine the caller cannot see", async () => {
    const printer = await register("agent-1");
    await equipment.access.setVisibility(printer, "private");

    await as("alice", async () => {
      expect(
        logs.addLog({
          equipmentId: printer,
          eventType: "job.finished",
          description: "done",
        } as any),
      ).rejects.toThrow(AccessDeniedError);
      expect(
        schedule.createSlot({
          equipmentId: printer,
          startAt: "2026-09-14T08:00:00.000Z",
          endAt: "2026-09-14T10:00:00.000Z",
        } as any),
      ).rejects.toThrow(AccessDeniedError);
    });
  });

  it("refuses to move a booking the caller only sees", async () => {
    const printer = await register("agent-1");
    const slot = await as("planner", () =>
      schedule.createSlot({
        equipmentId: printer,
        startAt: "2026-09-14T08:00:00.000Z",
        endAt: "2026-09-14T10:00:00.000Z",
      } as any),
    );

    await as("alice", async () => {
      expect(
        schedule.patchSlot(slot, { status: "cancelled" as any }),
      ).rejects.toThrow(AccessDeniedError);
    });
    expect(
      await as("agent-1", () =>
        schedule.patchSlot(slot, { status: "done" as any }),
      ),
    ).toBeUndefined();
  });

  it("does not let the dashboard count machines the caller cannot see", async () => {
    await register("agent-1");
    await register("agent-2");

    expect(
      (await as("alice", () => equipment.getEquipmentDashboard())).total,
    ).toBe(2);
    expect((await equipment.getEquipmentDashboard()).total).toBe(0);
  });
});
