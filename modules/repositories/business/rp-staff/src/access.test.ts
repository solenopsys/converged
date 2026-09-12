import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import staffMigrations from "./stores/staff/migrations";
import { StaffStoreService } from "./stores/staff/service";

/**
 * The roster stays a roster — everyone at the shop sees who works there. What
 * the tags settle is the other two questions: a record is edited by the person
 * it describes or by HR, and a shift or an absence is seen by exactly whoever
 * sees the member it hangs on.
 */
describe("who sees which staff records", () => {
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

  const hire = (name: string, userId?: string, hr = "hr") =>
    as(hr, () => staff.createStaff({ name, userId } as any));

  it("shows the roster to any authenticated caller", async () => {
    await hire("Anna", "anna");
    await hire("Boris", "boris");

    const listed = await as("carol", () =>
      staff.listStaff({ offset: 0, limit: 10 } as any),
    );
    expect(listed.items).toHaveLength(2);
    expect(listed.totalCount).toBe(2);
  });

  it("shows nothing to a caller with no token", async () => {
    await hire("Anna", "anna");

    expect(
      (await staff.listStaff({ offset: 0, limit: 10 } as any)).totalCount,
    ).toBe(0);
  });

  it("lets the employee and HR edit the record, and nobody else", async () => {
    const anna = await hire("Anna", "anna");

    await as("boris", async () => {
      expect(staff.updateStaff(anna, { role: "manager" })).rejects.toThrow(
        AccessDeniedError,
      );
    });
    expect(
      await as("anna", () => staff.updateStaff(anna, { contact: "@anna" })),
    ).toBeUndefined();
    expect(
      await as("hr", () => staff.updateStaff(anna, { role: "operator" })),
    ).toBeUndefined();
  });

  it("moves the personal tag when a record is re-pointed at another identity", async () => {
    const record = await hire("Anna", "anna");

    await as("hr", () => staff.updateStaff(record, { userId: "anna2" }));

    expect(await staff.access.tagsOf(record)).not.toContain("u-anna");
    await as("anna", async () => {
      expect(staff.updateStaff(record, { role: "operator" })).rejects.toThrow(
        AccessDeniedError,
      );
    });
    expect(
      await as("anna2", () => staff.updateStaff(record, { role: "operator" })),
    ).toBeUndefined();
  });

  it("gives a shift and an absence the member's audience", async () => {
    const anna = await hire("Anna", "anna");
    const shift = await as("hr", () =>
      staff.createShift({
        staffId: anna,
        startAt: "2026-09-14T08:00:00.000Z",
        endAt: "2026-09-14T17:00:00.000Z",
      } as any),
    );
    const absence = await as("hr", () =>
      staff.createAbsence({
        staffId: anna,
        startAt: "2026-09-20T00:00:00.000Z",
        endAt: "2026-09-21T00:00:00.000Z",
      } as any),
    );

    expect((await staff.access.tagsOf(shift)).sort()).toEqual(
      (await staff.access.tagsOf(anna)).sort(),
    );
    expect((await staff.access.tagsOf(absence)).sort()).toEqual(
      (await staff.access.tagsOf(anna)).sort(),
    );
  });

  it("narrows a member's shifts and leave along with the member", async () => {
    const anna = await hire("Anna", "anna");
    await staff.access.setVisibility(anna, "private");
    await staff.access.grant(anna, "team-hr");
    const shift = await as("hr", () =>
      staff.createShift({
        staffId: anna,
        startAt: "2026-09-14T08:00:00.000Z",
        endAt: "2026-09-14T17:00:00.000Z",
      } as any),
    );

    expect(await as("boris", () => staff.getStaff(anna))).toBeUndefined();
    expect(await as("boris", () => staff.getShift(shift))).toBeUndefined();
    expect(
      (
        await as("boris", () =>
          staff.listShifts({ offset: 0, limit: 10 } as any),
        )
      ).totalCount,
    ).toBe(0);
    expect(
      await as("clerk", () => staff.getShift(shift), ["team-hr"]),
    ).toMatchObject({ id: shift });
    expect(await as("anna", () => staff.getShift(shift))).toMatchObject({
      id: shift,
    });
  });

  it("refuses to schedule on a member the caller cannot see", async () => {
    const anna = await hire("Anna", "anna");
    await staff.access.setVisibility(anna, "private");

    await as("boris", async () => {
      expect(
        staff.createShift({
          staffId: anna,
          startAt: "2026-09-14T08:00:00.000Z",
          endAt: "2026-09-14T17:00:00.000Z",
        } as any),
      ).rejects.toThrow(AccessDeniedError);
    });
  });

  it("does not let the search reach a colleague the caller is not shown", async () => {
    const anna = await hire("Anna", "anna");
    await staff.access.setVisibility(anna, "private");

    const found = await as("boris", () =>
      staff.listStaff({ offset: 0, limit: 10, query: "Anna" } as any),
    );
    expect(found.items).toHaveLength(0);
    expect(found.totalCount).toBe(0);
  });

  it("forgets the tags of a deleted record", async () => {
    const anna = await hire("Anna", "anna");
    expect(await as("hr", () => staff.deleteStaff(anna))).toBe(true);
    expect(await staff.access.tagsOf(anna)).toEqual([]);
  });
});
