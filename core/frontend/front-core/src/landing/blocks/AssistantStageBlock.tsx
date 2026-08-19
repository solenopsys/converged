

export type AssistantStageData = {
	eyebrow: string;
	title: string;
	note: string;
};

export function AssistantStageBlock({
	id,
	data,
}: {
	id: string;
	data: AssistantStageData;
}) {
	return (
		<section class="assistant-stage" id={id} aria-label={data.eyebrow}>
			<div class="assistant-stage-copy">
				<p>{data.eyebrow}</p>
				<h2>{data.title}</h2>
			</div>
			<div class="assistant-stage-note">{data.note}</div>
		</section>
	);
}
