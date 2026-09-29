import { useUnit } from "effector-preact";
import { type HeaderAction, HeaderPanel, RefreshCw } from "front-core";
import { useEffect } from "preact/hooks";
import {
	$analyticsSummary,
	pollRealtimeRequested,
	realtimeMounted,
	refreshAnalyticsClicked,
} from "../domain-stats";
import "../workspace.css";

export function AnalyticsRealtimeView() {
	const summary = useUnit($analyticsSummary);
	useEffect(() => {
		realtimeMounted();
		const timer = window.setInterval(pollRealtimeRequested, 15_000);
		return () => window.clearInterval(timer);
	}, []);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{
					title: "Realtime",
					actions: [
						{
							id: "refresh",
							label: "Refresh",
							icon: RefreshCw as HeaderAction["icon"],
							event: refreshAnalyticsClicked,
							variant: "outline" as const,
						},
					],
				}}
			/>
			<div
				className="analytics-realtime flex-1 overflow-auto p-4"
				aria-live="polite"
			>
				<div className="analytics-live-counts">
					<div>
						<span>Active visitors</span>
						<strong>{summary.active_visitors.toLocaleString()}</strong>
					</div>
					<div>
						<span>Active sessions</span>
						<strong>{summary.active_sessions.toLocaleString()}</strong>
					</div>
					<div>
						<span>Updated</span>
						<strong>
							{summary.updated_at
								? new Date(summary.updated_at).toLocaleTimeString()
								: "--"}
						</strong>
					</div>
				</div>
				<div className="analytics-live-grid">
					<section className="analytics-uri-summary">
						<h2>Page views by URI (last 4 hours)</h2>
						<table>
							<thead>
								<tr>
									<th>URI</th>
									<th>Page views</th>
								</tr>
							</thead>
							<tbody>
								{summary.page_views_by_uri.map((page) => (
									<tr key={page.url}>
										<td>{page.url || "/"}</td>
										<td>{page.page_views.toLocaleString()}</td>
									</tr>
								))}
							</tbody>
						</table>
						{summary.page_views_by_uri.length === 0 && (
							<p className="analytics-empty">
								No page views in the last four hours.
							</p>
						)}
					</section>
					<section>
						<h2>Pages right now</h2>
						<table>
							<thead>
								<tr>
									<th>Page</th>
									<th>Sessions</th>
									<th>Visitors</th>
								</tr>
							</thead>
							<tbody>
								{summary.active_pages.map((page) => (
									<tr key={page.url}>
										<td>{page.url}</td>
										<td>{page.sessions}</td>
										<td>{page.visitors}</td>
									</tr>
								))}
							</tbody>
						</table>
						{summary.active_pages.length === 0 && (
							<p className="analytics-empty">
								No active pages in the last five minutes.
							</p>
						)}
					</section>
					<section>
						<h2>Visitors by country</h2>
						<table>
							<thead>
								<tr>
									<th>Country</th>
									<th>Sessions</th>
									<th>Visitors</th>
								</tr>
							</thead>
							<tbody>
								{summary.active_countries.map((country) => (
									<tr key={country.country_code}>
										<td>
											{country.country_name}{" "}
											<span className="analytics-country-code">
												{country.country_code}
											</span>
										</td>
										<td>{country.sessions}</td>
										<td>{country.visitors}</td>
									</tr>
								))}
							</tbody>
						</table>
						{summary.active_countries.length === 0 && (
							<p className="analytics-empty">No country data yet.</p>
						)}
					</section>
				</div>
				<p className="analytics-updated-note">
					Active means an event received within the last five minutes.
				</p>
			</div>
		</div>
	);
}
