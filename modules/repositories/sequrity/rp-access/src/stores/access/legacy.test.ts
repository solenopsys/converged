import { describe, expect, test } from "bun:test";
import { tagsFromGrantTree } from "nrpc";
import { normalizePermissions } from "./service";

describe("legacy permission arrays", () => {
  test("a flat array becomes a tree instead of vanishing", () => {
    expect(normalizePermissions(["usage/recordUsage(w)", "files/get(r)"])).toEqual({
      "*": { usage: { recordUsage: "w" }, files: { get: "r" } },
    });
  });

  test("tags inside a legacy array survive the conversion", () => {
    const tree = normalizePermissions(["tg/team-support/*(r)", "files/get(r)"]);
    expect(tagsFromGrantTree(tree)).toEqual(["team-support"]);
  });

  test("a tree is returned untouched", () => {
    const tree = { tg: { moderator: "rwx" } } as any;
    expect(normalizePermissions(tree)).toBe(tree);
  });

  test("an unreadable entry is dropped without taking the rest with it", () => {
    expect(normalizePermissions(["", "not a permission!!", "files/get(r)"])).toEqual({
      "*": { files: { get: "r" } },
    });
  });
});
