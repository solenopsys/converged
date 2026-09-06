import { describe, expect, test } from "bun:test";
import { defaultTopic, occurrencesFor, planFor } from "./schedule";
import type { CronEntry } from "./types";

const base: CronEntry = {
  id: "01J",
  name: "Nightly report",
  expression: "0 3 * * *",
  provider: "dag",
  action: "runWorkflow",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("schedule planning", () => {
  test("a name becomes a readable topic", () => {
    expect(defaultTopic(base)).toBe("cron.nightly-report");
    expect(defaultTopic({ ...base, name: "!!!" })).toBe("cron.01J");
  });

  test("occurrences are absolute instants inside the window", () => {
    const from = new Date("2026-03-01T02:00:00.000Z");
    const found = occurrencesFor({ ...base, timezone: "UTC" }, from, 2 * 60 * 60 * 1000);
    expect(found).toEqual([new Date("2026-03-01T03:00:00.000Z").getTime()]);
  });

  test("a window that contains nothing yields nothing", () => {
    const from = new Date("2026-03-01T04:00:00.000Z");
    expect(occurrencesFor({ ...base, timezone: "UTC" }, from, 60_000)).toEqual([]);
  });

  test("a paused entry and an unparseable one are both simply absent", () => {
    const from = new Date("2026-03-01T02:00:00.000Z");
    const horizon = 2 * 60 * 60 * 1000;
    expect(occurrencesFor({ ...base, status: "paused" }, from, horizon)).toEqual([]);
    // One operator's typo must not take the whole plan down.
    const plan = planFor(
      [
        { ...base, id: "bad", expression: "not a cron", timezone: "UTC" },
        { ...base, timezone: "UTC" },
      ],
      from,
      horizon,
    );
    expect(plan.map((item) => item.cronId)).toEqual(["01J"]);
  });

  test("provider and action survive as payload metadata, not as instructions", () => {
    const from = new Date("2026-03-01T02:00:00.000Z");
    const [item] = planFor([{ ...base, timezone: "UTC" }], from, 2 * 60 * 60 * 1000);
    expect(item.topic).toBe("cron.nightly-report");
    expect(item.payload).toMatchObject({ provider: "dag", action: "runWorkflow" });
  });
});
