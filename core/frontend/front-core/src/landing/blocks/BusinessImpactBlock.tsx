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
								<th scope="col">Показатель</th>
								<th scope="col">Потенциал</th>
								<th scope="col">За счёт чего</th>
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
