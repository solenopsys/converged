import { createDomain } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { GeoLiteDatabaseRow, GeoLiteDataset } from "g-analytics";
import analytics from "./service";

const domain = createDomain("analytics-geolite");

const datasetFromParams = (params: Record<string, unknown>): GeoLiteDataset => {
	const presets = Array.isArray(params.presets) ? params.presets : [];
	const selectedId = presets.find(
		(preset) =>
			typeof preset === "object" &&
			preset !== null &&
			"id" in preset &&
			typeof preset.id === "string" &&
			preset.id.startsWith("analytics.geolite."),
	)?.id;
	if (selectedId === "analytics.geolite.city") return "city";
	if (selectedId === "analytics.geolite.asn") return "asn";
	return "country";
};

export const geoLiteStore = createInfiniteTableStore<
	GeoLiteDatabaseRow & { index: number }
>(
	domain,
	async (params) => {
		const offset = Number(params.offset ?? 0);
		const page = await analytics.listGeoLiteDatabase(
			datasetFromParams(params),
			params.limit,
			offset,
		);
		return {
			...page,
			items: page.items.map((row, rowIndex) => ({
				...row,
				index: offset + rowIndex + 1,
			})),
		};
	},
	"analytics-geolite-databases",
);
