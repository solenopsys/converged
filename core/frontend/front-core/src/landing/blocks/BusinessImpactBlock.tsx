export type BusinessImpactMetric = {
	metric: string;
	change: string;
	detail: string;
};

export type BusinessImpactData = {
	eyebrow: string;
	title: string;
	description: string;
	note: string;
	metrics: BusinessImpactMetric[];
	headers?: {
		metric?: string;
		potential?: string;
		driver?: string;
	};
};

const DEFAULT_HEADERS = {
	metric: "Metric",
	potential: "Potential",
	driver: "Driver",
};

export function BusinessImpactBlock({
	id,
	data,
}: {
	id: string;
	data: BusinessImpactData;
}) {
	return (
		<section class="business-impact" id={id} aria-label={data.eyebrow}>
			<div class="business-impact-inner">
				<div class="business-impact-copy">
					<p>{data.eyebrow}</p>
					<h2>{data.title}</h2>
					<div>{data.description}</div>
				</div>
				<div class="business-impact-table-wrap">
					<table class="business-impact-table">
						<thead>
							<tr>
								<th scope="col">{data.headers?.metric ?? DEFAULT_HEADERS.metric}</th>
								<th scope="col">{data.headers?.potential ?? DEFAULT_HEADERS.potential}</th>
								<th scope="col">{data.headers?.driver ?? DEFAULT_HEADERS.driver}</th>
							</tr>
						</thead>
						<tbody>
							{data.metrics.map((item) => (
								<tr key={item.metric}>
									<th scope="row">{item.metric}</th>
									<td>{item.change}</td>
									<td>{item.detail}</td>
								</tr>
							))}
						</tbody>
					</table>
					<p class="business-impact-note">{data.note}</p>
				</div>
			</div>
		</section>
	);
}
