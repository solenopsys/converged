import { VectorImage, type VectorImageData } from "./VectorImage";

export function VectorImageBlock({
	id,
	data,
}: {
	id: string;
	data: VectorImageData;
}) {
	return (
		<section class="vector-image-block" id={id}>
			<div class="vector-image-block-head">
				{data.kicker ? <p class="vector-image-block-kicker">{data.kicker}</p> : null}
				{data.title ? <h2>{data.title}</h2> : null}
				{data.description ? (
					<p class="vector-image-block-description">{data.description}</p>
				) : null}
			</div>
			<VectorImage data={data} />
		</section>
	);
}
