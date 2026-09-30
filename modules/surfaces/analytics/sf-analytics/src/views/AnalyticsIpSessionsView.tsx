import { useUnit } from "effector-preact";
import { type HeaderAction, HeaderPanel, RefreshCw } from "front-core";
import { useEffect } from "preact/hooks";
import {
	$ipSessionError,
	$ipSessionOffset,
	$ipSessionPage,
	IP_SESSION_PAGE_SIZE,
	ipSessionsMounted,
	ipSessionsPageSelected,
	ipSessionsRefreshClicked,
	loadIpSessionsFx,
} from "../domain-ip";

export function AnalyticsIpSessionsView() {
	const { offset, page, error, loading, mount, refresh, selectPage } = useUnit({
		offset: $ipSessionOffset,
		page: $ipSessionPage,
		error: $ipSessionError,
		loading: loadIpSessionsFx.pending,
		mount: ipSessionsMounted,
		refresh: ipSessionsRefreshClicked,
		selectPage: ipSessionsPageSelected,
	});

	useEffect(() => mount(), [mount]);
	const pageNumber = Math.floor(offset / IP_SESSION_PAGE_SIZE) + 1;
	const pageCount = Math.max(
		1,
		Math.ceil(page.totalCount / IP_SESSION_PAGE_SIZE),
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{
					title: "IP activity",
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
				<div className="analytics-geolite-table-wrap" aria-busy={loading}>
					<table>
						<thead>
							<tr>
								<th>IP address</th>
								<th>Network</th>
								<th>Country</th>
								<th>City</th>
								<th>Visitor type</th>
								<th>Page</th>
								<th>Clicks</th>
								<th>Visible ms</th>
								<th>Last seen</th>
							</tr>
						</thead>
						<tbody>
							{page.items.map((row) => (
								<tr key={`${row.visitor_id}:${row.session_id}`}>
									<td>{row.ip_address}</td>
									<td>
										{row.asn ? `AS${row.asn} ` : ""}
										{row.asn_organization || row.network || "—"}
									</td>
									<td>{row.country_name || row.country_code || "—"}</td>
									<td>
										{[row.region_name, row.city_name]
											.filter(Boolean)
											.join(", ") || "—"}
									</td>
									<td>{row.user_type}</td>
									<td title={row.url}>{row.url || "/"}</td>
									<td>{row.clicks.toLocaleString()}</td>
									<td>{row.visible_ms.toLocaleString()}</td>
									<td>{new Date(row.last_seen).toLocaleString()}</td>
								</tr>
							))}
							{!page.items.length && (
								<tr>
									<td colSpan={9}>
										{loading ? "Loading…" : "No IP activity yet"}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
				<div className="analytics-geolite-pagination">
					<span>
						{page.totalCount
							? `${(offset + 1).toLocaleString()}–${Math.min(offset + IP_SESSION_PAGE_SIZE, page.totalCount).toLocaleString()} of ${page.totalCount.toLocaleString()}`
							: "0 sessions"}
					</span>
					<div>
						<button
							type="button"
							disabled={offset === 0 || loading}
							onClick={() =>
								selectPage(Math.max(0, offset - IP_SESSION_PAGE_SIZE))
							}
						>
							Previous
						</button>
						<span>
							Page {pageNumber} of {pageCount}
						</span>
						<button
							type="button"
							disabled={
								offset + IP_SESSION_PAGE_SIZE >= page.totalCount || loading
							}
							onClick={() => selectPage(offset + IP_SESSION_PAGE_SIZE)}
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
