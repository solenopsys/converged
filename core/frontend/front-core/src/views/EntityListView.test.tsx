import { describe, expect, test } from "bun:test";
import { setRef } from "front-core/object-runtime";
import { valuesFromSelectionFilter } from "../table/filter-header";
import type { TableFilterConfig } from "../table/filter-header";
import { infinityFilterParams, referenceBaseFilters } from "./EntityListView";

const twoFilters: TableFilterConfig[] = [
	{ id: "type", label: "Type", type: "multi-select" },
	{ id: "role", label: "Role", type: "search" },
];

describe("EntityListView infinity contract", () => {
	test("two configured filters each drive their own predicate clause", () => {
		const params = infinityFilterParams(
			{ type: ["EMAIL"], role: "acme" },
			undefined,
			twoFilters,
		);
		expect(Object.keys(params.filter as object)).toEqual(["type", "role"]);
	});

	test("editing configured filters sends one canonical filter predicate", () => {
		const params = infinityFilterParams(
			{ type: ["EMAIL", "PHONE"], role: "acme" },
			undefined,
			twoFilters,
		);
		expect(params).toEqual({
			filter: {
				type: { in: ["EMAIL", "PHONE"] },
				role: { contains: "acme" },
			},
		});
	});

	test("a base filter from the reference is anded with header edits, not replaced", () => {
		const params = infinityFilterParams(
			{ role: "acme" },
			{ filter: { ownerId: { eq: "42" } } },
			twoFilters,
		);
		expect(params).toEqual({
			filter: {
				AND: [{ ownerId: { eq: "42" } }, { role: { contains: "acme" } }],
			},
		});
	});

	test("a SetRef with a query selection restores into the header controls", () => {
		const reference = setRef("sales.contact", {
			kind: "query",
			filter: { type: { in: ["EMAIL"] }, role: { eq: "founder" } },
		});
		const base = referenceBaseFilters(reference);
		const restored = valuesFromSelectionFilter(twoFilters, base);
		expect(restored).toEqual({ type: ["EMAIL"], role: "founder" });
	});

	test("a SetRef selected by ids carries no base filter to restore", () => {
		const reference = setRef("sales.contact", {
			kind: "ids",
			ids: ["1", "2"],
		});
		expect(referenceBaseFilters(reference)).toBeUndefined();
	});

	test("predicate construction is generic across unrelated filter configs, not branched per object", () => {
		const contactLike = infinityFilterParams(
			{ type: ["EMAIL"] },
			undefined,
			[{ id: "type", label: "Type", type: "multi-select" }],
		);
		const unrelatedFilters: TableFilterConfig[] = [
			{ id: "storageClass", label: "Storage class", type: "select" },
		];
		const dumpLike = infinityFilterParams(
			{ storageClass: "s3" },
			undefined,
			unrelatedFilters,
		);
		expect(contactLike).toEqual({ filter: { type: { in: ["EMAIL"] } } });
		expect(dumpLike).toEqual({ filter: { storageClass: { contains: "s3" } } });
	});
});
