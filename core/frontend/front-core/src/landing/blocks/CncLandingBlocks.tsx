import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

export type CncHeroData = {
	headline?: string;
	highlight?: string;
	description?: string;
	backgroundImage?: string;
	request?: { attachLabel?: string; submitLabel?: string; chips?: Array<string | { label?: string }> };
};

export type CncRailData = {
	kind?: "capabilities" | "machines" | "team" | "works";
	title?: string;
	meta?: string | Array<{ text: string; strong?: boolean }>;
	items?: Array<{
		id: string;
		title: string;
		copy?: string;
		meta?: string;
		image?: string;
		imageAlt?: string;
		role?: string;
		quote?: string;
		availability?: string;
		status?: string;
		bullets?: string[];
	}>;
};

export type ShopProofData = {
	eyebrow?: string;
	title?: string;
	copy?: string;
	points?: string[];
	metrics?: Array<{ label?: string; value?: string }>;
};

export type ReviewsData = {
	title?: string;
	aggregate?: { rating: number; count: number };
	reviews?: Array<{ id: string; name: string; role?: string; company?: string; text: string; rating: number; verified?: boolean; date?: string; avatarColor?: string }>;
};

export type CertificatesData = {
	title?: string;
	subtitle?: string;
	items?: Array<{ id?: string; title?: string; standard?: string; issuer?: string; validUntil?: string; description?: string; image?: string }>;
};

export type ContactsData = {
	title?: string;
	subtitle?: string;
	address?: string;
	phone?: string;
	email?: string;
	hours?: string[];
	mapQuery?: string;
	mapEmbedUrl?: string;
};

export type SalesIslandData = {
	enabled?: boolean;
	title?: string;
	lead?: string;
	brand?: string;
	price?: { amount: string; period?: string; note?: string };
	primaryCta?: { label: string; href?: string };
};

export function CncHeroRequestBlock({ id, data, composer }: { id: string; data: CncHeroData; composer?: ComponentChildren }) {
	const chips = (data.request?.chips ?? []).flatMap((chip) => {
		const label = typeof chip === "string" ? chip : chip.label;
		return label?.trim() ? [label] : [];
	});
	return <section class="cnc-hero" id={id}>
		{data.backgroundImage ? <img class="cnc-hero-image" src={data.backgroundImage} alt="" aria-hidden="true" /> : null}
		<div class="cnc-hero-shade" aria-hidden="true" />
		<div class="cnc-hero-content">
			<p class="cnc-eyebrow">Converged Manufacturing</p>
			<h1>{data.headline ?? "Precision CNC quotes"} {data.highlight ? <em>{data.highlight}</em> : null}</h1>
			{data.description ? <p class="cnc-hero-description">{data.description}</p> : null}
			<div class="cnc-hero-composer">{composer}</div>
			{chips.length ? <div class="cnc-hero-chips">{chips.map((label) => <span key={label}>{label}</span>)}</div> : null}
		</div>
	</section>;
}

export function CncRailBlock({ id, data }: { id: string; data: CncRailData }) {
	const items = data.items ?? [];
	const [active, setActive] = useState(0);
	if (!items.length) return null;
	const current = items[Math.min(active, items.length - 1)];
	return <section class="cnc-rail" id={id}>
		<header class="cnc-section-head"><div><p class="cnc-eyebrow">{data.kind ?? "manufacturing"}</p><h2>{data.title}</h2></div>
			{data.meta ? <p class="cnc-meta">{renderRailMeta(data.meta)}</p> : null}
		</header>
		<div class="cnc-rail-layout">
			<div class="cnc-rail-tabs" role="tablist" aria-label={data.title}>{items.map((item, index) => <button type="button" role="tab" aria-selected={index === active} class={index === active ? "is-active" : ""} onClick={() => setActive(index)} key={item.id}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}</div>
			<article class="cnc-rail-card">
				{current.image ? <img src={current.image} alt={current.imageAlt ?? current.title} /> : null}
				<div class="cnc-rail-card-copy"><p>{current.meta ?? current.role}</p><h3>{current.title}</h3>{current.copy ? <p>{current.copy}</p> : null}{current.quote ? <blockquote>{current.quote}</blockquote> : null}
					{current.bullets?.length ? <ul>{current.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
					{current.availability ? <span class={`cnc-status ${current.status === "free" ? "is-free" : ""}`}>{current.availability}</span> : null}
				</div>
			</article>
		</div>
	</section>;
}

export function ShopProofBlock({ id, data }: { id: string; data: ShopProofData }) {
	return <section class="cnc-proof" id={id}><div class="cnc-proof-copy"><p class="cnc-eyebrow">{data.eyebrow ?? "shop proof"}</p><h2>{data.title}</h2>{data.copy ? <p>{data.copy}</p> : null}{data.points?.length ? <ul>{data.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</div>
		<div class="cnc-proof-metrics">{data.metrics?.map((metric, index) => <div key={`${metric.label}-${index}`}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div></section>;
}

export function ReviewsBlock({ id, data }: { id: string; data: ReviewsData }) {
	const reviews = data.reviews ?? [];
	if (!reviews.length) return null;
	return <section class="cnc-reviews" id={id}><header class="cnc-section-head"><div><p class="cnc-eyebrow">Customer feedback</p><h2>{data.title ?? "Reviews"}</h2></div>{data.aggregate ? <p class="cnc-rating"><strong>{data.aggregate.rating.toFixed(1)}</strong> / 5 from {data.aggregate.count} reviews</p> : null}</header>
		<div class="cnc-review-grid">{reviews.map((review) => <article key={review.id} class="cnc-review"><div class="cnc-review-mark" style={{ background: review.avatarColor }} aria-hidden="true">{initials(review.name)}</div><div><p class="cnc-review-name">{review.name}{review.verified ? <span>Verified</span> : null}</p><p class="cnc-review-meta">{[review.role, review.company, review.date].filter(Boolean).join(" · ")}</p></div><p class="cnc-review-stars" aria-label={`${review.rating} out of 5`}>{"*".repeat(Math.round(review.rating))}</p><blockquote>{review.text}</blockquote></article>)}</div></section>;
}

export function CertificatesBlock({ id, data }: { id: string; data: CertificatesData }) {
	const items = data.items ?? [];
	if (!items.length) return null;
	return <section class="cnc-certificates" id={id}><header class="cnc-section-head"><div><p class="cnc-eyebrow">Quality system</p><h2>{data.title}</h2></div>{data.subtitle ? <p class="cnc-section-copy">{data.subtitle}</p> : null}</header><div class="cnc-certificate-grid">{items.map((item, index) => <article class="cnc-certificate" key={item.id ?? index}>{item.image ? <img src={item.image} alt={item.title ?? ""} /> : <div class="cnc-certificate-sheet"><small>{item.standard ?? "CERTIFICATE"}</small><strong>{item.issuer ?? "Quality system"}</strong><i /><i /><b>{item.validUntil ?? "active"}</b></div>}<h3>{item.title}</h3>{item.description ? <p>{item.description}</p> : null}</article>)}</div></section>;
}

export function ContactsMapBlock({ id, data }: { id: string; data: ContactsData }) {
	const query = data.mapQuery ?? data.address ?? "CNC machine shop";
	const map = data.mapEmbedUrl ?? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
	const phoneHref = data.phone?.replace(/[^+\d]/g, "");
	return <section class="cnc-contacts" id={id}><header class="cnc-section-head"><div><p class="cnc-eyebrow">Visit or send a drawing</p><h2>{data.title}</h2></div>{data.subtitle ? <p class="cnc-section-copy">{data.subtitle}</p> : null}</header><div class="cnc-contact-layout"><aside><p class="cnc-contact-address">{data.address}</p>{data.phone ? <a href={`tel:${phoneHref}`}>{data.phone}</a> : null}{data.email ? <a href={`mailto:${data.email}`}>{data.email}</a> : null}{data.hours?.map((hour) => <span key={hour}>{hour}</span>)}</aside><iframe title={data.title ?? "Map"} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section>;
}

export function SalesIslandBlock({ id, data }: { id: string; data: SalesIslandData }) {
	if (data.enabled === false) return null;
	return <section class="cnc-sales" id={id}><div><p class="cnc-eyebrow">{data.brand ?? "Converged"}</p><h2>{data.title}</h2>{data.lead ? <p>{data.lead}</p> : null}</div><div class="cnc-sales-action">{data.price ? <p><strong>{data.price.amount}</strong>{data.price.period}<small>{data.price.note}</small></p> : null}{data.primaryCta ? <a href={data.primaryCta.href ?? "#"}>{data.primaryCta.label}</a> : null}</div></section>;
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2); }

function renderRailMeta(meta: NonNullable<CncRailData["meta"]>) {
	if (typeof meta === "string") return meta;
	return meta.map((part, index) => part.strong ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>);
}
