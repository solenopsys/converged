import { useUnit } from "effector-preact";
import { type HeaderAction, HeaderPanel, RefreshCw } from "front-core";
import type { GeoLiteDataset } from "g-analytics";
import { useEffect } from "preact/hooks";
import {
	$geoLiteDataset,
	$geoLiteError,
	$geoLiteOffset,
	$geoLitePage,
	$geoLiteStatus,
	GEO_PAGE_SIZE,
	geoLiteDatasetSelected,
	geoLitePageSelected,
	geoLiteTableRefreshClicked,
	loadGeoLitePageFx,
	loadGeoLiteStatusFx,
} from "../domain-geolite";

const datasets: Array<{ id: GeoLiteDataset; label: string }> = [
	{ id: "country", label: "Country" },
	{ id: "city", label: "City" },
	{ id: "asn", label: "ASN" },
];

export function GeoDatabasesView() {
	const {
		dataset,
		offset,
		page,
		status,
		error,
		loading,
		selectDataset,
		selectPage,
		refresh,
		loadStatus,
	} = useUnit({
		dataset: $geoLiteDataset,
		offset: $geoLiteOffset,
		page: $geoLitePage,
		status: $geoLiteStatus,
		error: $geoLiteError,
		loading: loadGeoLitePageFx.pending,
		selectDataset: geoLiteDatasetSelected,
		selectPage: geoLitePageSelected,
		refresh: geoLiteTableRefreshClicked,
		loadStatus: loadGeoLiteStatusFx,
	});

	useEffect(() => {
		void loadStatus();
		selectDataset("country");
	}, [loadStatus, selectDataset]);

	const currentStatus = status.find((item) => item.dataset === dataset);
	const pageNumber = Math.floor(offset / GEO_PAGE_SIZE) + 1;
	const pageCount = Math.max(1, Math.ceil(page.totalCount / GEO_PAGE_SIZE));

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{
					title: "IP databases",
					actions: [
						{
							id: "refresh",
							label: "Refresh",
							icon: RefreshCw as HeaderAction["icon"],
							event: refresh,
							variant: "outline" as const,
						},
					],
				}}
			/>
			<div className="analytics-geolite flex-1 overflow-auto p-4">
				<nav className="analytics-geolite-tabs" aria-label="GeoLite database">
					{datasets.map((item) => {
						const count =
							status.find((entry) => entry.dataset === item.id)?.records ?? 0;
						return (
							<button
								key={item.id}
								type="button"
								aria-pressed={dataset === item.id}
								onClick={() => selectDataset(item.id)}
							>
								{item.label}
								<span>{count.toLocaleString()}</span>
							</button>
						);
					})}
				</nav>
				<p className="analytics-geolite-count">
					{currentStatus?.records.toLocaleString() ?? "0"} network records
					{currentStatus?.updated_at
						? ` · Updated ${new Date(currentStatus.updated_at).toLocaleString()}`
						: ""}
				</p>
				<div className="analytics-geolite-table-wrap" aria-busy={loading}>
					<table>
						<thead>
							<tr>
								{columnsFor(dataset).map((column) => (
									<th key={column.key}>{column.label}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{page.items.map((row) => (
								<tr key={row.network}>
									{columnsFor(dataset).map((column) => (
										<td key={column.key}>{row[column.key] || "—"}</td>
									))}
								</tr>
							))}
							{!page.items.length && (
								<tr>
									<td colSpan={columnsFor(dataset).length}>
										{loading ? "Loading…" : "No records"}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
				<div className="analytics-geolite-pagination">
					<span>
						{page.totalCount
							? `${(offset + 1).toLocaleString()}–${Math.min(offset + GEO_PAGE_SIZE, page.totalCount).toLocaleString()} of ${page.totalCount.toLocaleString()}`
							: "0 records"}
					</span>
					<div>
						<button
							type="button"
							disabled={offset === 0 || loading}
							onClick={() => selectPage(Math.max(0, offset - GEO_PAGE_SIZE))}
						>
							Previous
						</button>
						<span>
							Page {pageNumber} of {pageCount}
						</span>
						<button
							type="button"
							disabled={offset + GEO_PAGE_SIZE >= page.totalCount || loading}
							onClick={() => selectPage(offset + GEO_PAGE_SIZE)}
						>
							Next
						</button>
					</div>
				</div>
				{error && (
					<p className="analytics-geolite-error" role="alert">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}

const columnsFor = (dataset: GeoLiteDataset) => {
	if (dataset === "country") {
		return [
			{ key: "network", label: "Network" },
			{ key: "country_code", label: "Code" },
			{ key: "country_name", label: "Country" },
			{ key: "geoname_id", label: "GeoName ID" },
		] as const;
	}
	if (dataset === "city") {
		return [
			{ key: "network", label: "Network" },
			{ key: "country_code", label: "Code" },
			{ key: "country_name", label: "Country" },
			{ key: "region_name", label: "Region" },
			{ key: "city_name", label: "City" },
			{ key: "geoname_id", label: "GeoName ID" },
		] as const;
	}
	return [
		{ key: "network", label: "Network" },
		{ key: "asn", label: "ASN" },
		{ key: "organization", label: "Provider" },
	] as const;
};
