import { ArrowDown } from "../../icons";
import type { ComponentChildren } from "preact";
import { VectorImage, type VectorImageData } from "./VectorImage";



export type HeroData = {
	wordmark: { label: string; suffix?: string; href: string };

	menu?: Array<{ href: string; label: string }>;
	kicker: string;
	headline: string;
	description: string;
	explore: { href: string; label: string };
	image: VectorImageData["image"];
	index?: string;
};

export function HeroBlock({
	id,
	data,
	composer,
}: {
	id: string;
	data: HeroData;

	composer?: ComponentChildren;

	menu?: Array<{ href: string; label: string }>;
}) {
	return (
		<header class="landing-hero" id={id}>
			<div class="landing-hero-layout">
				<div class="landing-hero-copy">
					<p class="landing-kicker">{data.kicker}</p>
					<h1>{data.headline}</h1>
					<p class="landing-description">{data.description}</p>
					<div class="landing-hero-composer">{composer}</div>
					<a class="landing-explore" href={data.explore.href}>
						{data.explore.label}{" "}
						<ArrowDown aria-hidden="true" size={17} />
					</a>
				</div>

				<div class="landing-workshop-visual" aria-label={data.image.caption ?? data.image.alt}>
					<VectorImage data={{ image: data.image }} />
				</div>
			</div>

			{data.index ? (
				<div class="landing-index" aria-hidden="true">
					<span>{data.index}</span>
					<i />
				</div>
			) : null}
		</header>
	);
}
