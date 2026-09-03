import { beforeAll, describe, expect, test } from "bun:test";
import {
	Category,
	objectRegistry,
	registerMicrofrontend,
	setOf,
} from "front-core/object-runtime";
import {
	collectStatisticSections,
	resolveStatistic,
	sectionLabel,
} from "./statistic-catalog";

const TotalChart = () => null;
const LegacyStatsScreen = () => null;
const CompaniesReadout = () => null;

beforeAll(() => {
	// A microfrontend split into blocks: one type per chart.
	registerMicrofrontend({
		id: "mf-companies",
		types: [
			{
				id: "companies.statistic.summary",
				label: "Companies",
				categories: [Category.Statistic],
				statistic: { role: "summary", component: CompaniesReadout },
			},
			{
				id: "companies.statistic.total",
				label: "Companies",
				categories: [Category.Statistic],
				statistic: { component: TotalChart, props: { field: "total" } },
			},
			{
				id: "companies.statistic.by-status",
				label: "Companies by status",
				categories: [Category.Statistic],
				statistic: { component: TotalChart, size: "lg" },
			},
			{
				id: "companies.company",
				label: "Company",
				categories: [Category.Business],
			},
		],
		views: [],
		operations: [],
	});

	// A microfrontend still on one statistics screen for the whole service.
	registerMicrofrontend({
		id: "mf-logs",
		types: [
			{
				id: "logs.statistic",
				label: "Log statistic",
				categories: [Category.Statistic],
			},
		],
		views: [
			{
				id: "logs.statistic.dashboard",
				accepts: setOf("logs.statistic"),
				component: LegacyStatsScreen,
			},
		],
		operations: [],
	});

	// Declared but never imported: the index knows the type, not the component.
	objectRegistry.declare("mf-sales", {
		id: "mf-sales",
		types: [
			{
				id: "sales.statistic",
				label: "Sales statistic",
				categories: [Category.Statistic],
			},
		],
		views: [],
		operations: [],
	});
});

describe("statistic catalog", () => {
	test("groups statistic types into a section per microfrontend", () => {
		const sections = collectStatisticSections();
		const owners = sections.map((section) => section.owner);

		expect(owners).toContain("mf-companies");
		expect(owners).toContain("mf-logs");
		expect(owners).toContain("mf-sales");
	});

	test("keeps non-statistic types out of the dashboard", () => {
		const companies = collectStatisticSections().find(
			(section) => section.owner === "mf-companies",
		);

		expect(companies?.widgets.map((widget) => widget.typeId)).toEqual([
			"companies.statistic.by-status",
			"companies.statistic.total",
		]);
	});

	test("reports whether a section's microfrontend is imported", () => {
		const sections = collectStatisticSections();
		const loaded = (owner: string) =>
			sections.find((section) => section.owner === owner)?.loaded;

		expect(loaded("mf-companies")).toBe(true);
		expect(loaded("mf-sales")).toBe(false);
	});

	test("mounts a declared chart with its declared props and size", () => {
		const [byStatus, total] =
			collectStatisticSections().find(
				(section) => section.owner === "mf-companies",
			)?.widgets ?? [];

		expect(resolveStatistic(total)).toEqual({
			Component: TotalChart,
			props: { field: "total" },
			size: "sm",
		});
		expect(resolveStatistic(byStatus)?.size).toBe("lg");
	});

	test("falls back to the service's own statistics view, full width", () => {
		const [widget] =
			collectStatisticSections().find((section) => section.owner === "mf-logs")
				?.widgets ?? [];
		const mounted = resolveStatistic(widget);

		expect(mounted?.Component).toBe(LegacyStatsScreen);
		expect(mounted?.size).toBe("full");
		expect(mounted?.props.reference).toEqual({
			kind: "set",
			type: "logs.statistic",
			selection: { kind: "query" },
		});
	});

	test("mounts nothing until the owning microfrontend is imported", () => {
		const [widget] =
			collectStatisticSections().find((section) => section.owner === "mf-sales")
				?.widgets ?? [];

		expect(resolveStatistic(widget)).toBeNull();
	});

	test("keeps the summary out of the block list", () => {
		const companies = collectStatisticSections().find(
			(section) => section.owner === "mf-companies",
		);

		expect(companies?.summary?.typeId).toBe("companies.statistic.summary");
		expect(companies?.widgets.map((widget) => widget.typeId)).not.toContain(
			"companies.statistic.summary",
		);
	});

	test("mounts the summary component for a collapsed section", () => {
		const summary = collectStatisticSections().find(
			(section) => section.owner === "mf-companies",
		)?.summary;

		expect(resolveStatistic(summary!)?.Component).toBe(CompaniesReadout);
	});

	test("leaves services without a readout with no summary", () => {
		const logs = collectStatisticSections().find(
			(section) => section.owner === "mf-logs",
		);

		expect(logs?.summary).toBeUndefined();
	});

	test("names a section after its module", () => {
		expect(sectionLabel("mf-companies")).toBe("Companies");
		expect(sectionLabel("mf-dag")).toBe("Dag");
	});
});
