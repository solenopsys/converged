import { useEffect, useRef, useState } from "preact/hooks";
import { initDiagramRuntime } from "../diagram/client";
import { V2Diagram } from "../diagram/components";
import type { V2DiagramConfig, V2DiagramTexts } from "../diagram/types";
import { VectorImage, type VectorImageData } from "./VectorImage";

export type ProductCase = {
	eyebrow: string;

	tab: string;
	title: string;

	markdown?: string;
	description?: string;

	diagram?: string;
	image?: VectorImageData["image"];
};

export type ProductCasesData = {
	eyebrow: string;
	cases: ProductCase[];
};

export type DiagramsData = Record<string, V2DiagramConfig>;
export type DiagramTextsData = Record<string, V2DiagramTexts>;

export function ProductCasesBlock({
	id,
	data,
	diagrams,
	diagramTexts,
}: {
	id: string;
	data: ProductCasesData;
	diagrams?: DiagramsData;
	diagramTexts?: DiagramTextsData;
}) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [isCompact, setIsCompact] = useState(false);
	const sectionRef = useRef<HTMLElement>(null);
	const activeIndexRef = useRef(0);
	const scrollLockUntilRef = useRef(0);
	const touchStartYRef = useRef<number | null>(null);
	const cases = data.cases;
	const activateCase = (index: number) => {
		activeIndexRef.current = index;
		setActiveIndex(index);
	};

	useEffect(() => {
		initDiagramRuntime();
	}, []);

	useEffect(() => {
		const section = sectionRef.current;
		if (!section) return;
		const update = () => setIsCompact(section.clientWidth <= 900);
		const observer = new ResizeObserver(update);
		observer.observe(section);
		update();
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const hosts = [
			...(sectionRef.current?.querySelectorAll<HTMLElement>(
				".product-case-diagram",
			) ?? []),
		];
		const updateScale = () => {
			const maximumScale = 0.9;
			hosts.forEach((host) => {
				const stage = host.querySelector<HTMLElement>(
					".product-case-v2.v2-stage",
				);
				if (!stage || !host.clientWidth) return;

				const sectionWidth =
					host.closest<HTMLElement>(".product-case-scroll")?.clientWidth ??
					window.innerWidth;
				const fittedWidth = host.clientWidth / stage.offsetWidth;
				const scale =
					sectionWidth <= 900
						? Math.min(maximumScale, fittedWidth)
						: Math.min(
								maximumScale,
								fittedWidth,
								(host.clientHeight - 20) / stage.offsetHeight,
							);
				host.style.setProperty("--product-case-diagram-scale", String(scale));
				if (sectionWidth <= 900) {
					host.style.height = `${stage.offsetHeight * scale}px`;
				} else {
					host.style.removeProperty("height");
				}
			});
		};

		const observer = new ResizeObserver(updateScale);
		hosts.forEach((host) => {
			observer.observe(host);
			const stage = host.querySelector<HTMLElement>(
				".product-case-v2.v2-stage",
			);
			if (stage) observer.observe(stage);
		});
		window.addEventListener("resize", updateScale);
		updateScale();

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateScale);
		};
	}, []);

	useEffect(() => {
		const handleWheel = (event: WheelEvent) => {
			const section = sectionRef.current;
			if (!section || event.ctrlKey || event.deltaY === 0) return;

			const bounds = section.getBoundingClientRect();
			const viewportHeight = window.innerHeight;
			const isPinned = bounds.top <= 1 && bounds.bottom >= viewportHeight - 1;
			if (!isPinned) return;

			const direction = Math.sign(event.deltaY);
			const nextIndex = activeIndexRef.current + direction;
			if (nextIndex < 0 || nextIndex >= cases.length) return;

			event.preventDefault();
			if (Date.now() < scrollLockUntilRef.current) return;
			scrollLockUntilRef.current = Date.now() + 360;
			activateCase(nextIndex);
		};
		const isPinned = () => {
			const section = sectionRef.current;
			if (!section) return false;
			const bounds = section.getBoundingClientRect();
			return bounds.top <= 1 && bounds.bottom >= window.innerHeight - 1;
		};
		const handleTouchStart = (event: TouchEvent) => {
			touchStartYRef.current = event.touches[0]?.clientY ?? null;
		};
		const handleTouchMove = (event: TouchEvent) => {
			const startY = touchStartYRef.current;
			const currentY = event.touches[0]?.clientY;
			if (startY == null || currentY == null || !isPinned()) return;

			const delta = startY - currentY;
			if (Math.abs(delta) < 36) return;
			const direction = Math.sign(delta);
			const nextIndex = activeIndexRef.current + direction;
			if (nextIndex < 0 || nextIndex >= cases.length) return;

			event.preventDefault();
			touchStartYRef.current = currentY;
			if (Date.now() < scrollLockUntilRef.current) return;
			scrollLockUntilRef.current = Date.now() + 360;
			activateCase(nextIndex);
		};
		const handleTouchEnd = () => {
			touchStartYRef.current = null;
		};

		window.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("touchstart", handleTouchStart, { passive: true });
		window.addEventListener("touchmove", handleTouchMove, { passive: false });
		window.addEventListener("touchend", handleTouchEnd, { passive: true });
		return () => {
			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener("touchstart", handleTouchStart);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
		};
	}, [cases.length]);

	return (
		<section
			class={`product-case-scroll${isCompact ? " is-compact" : ""}`}
			id={id}
			aria-label={data.eyebrow}
			ref={sectionRef}
		>
			<div class="product-case-stage">
				<div class="product-case-topline">
					<span>{data.eyebrow}</span>
					<span>
						{String(activeIndex + 1).padStart(2, "0")} /{" "}
						{String(cases.length).padStart(2, "0")}
					</span>
				</div>
				<div class="product-case-layout">
					<fieldset class="product-case-mobile-nav" aria-label={data.eyebrow}>
						<legend class="sr-only">{data.eyebrow}</legend>
						<button
							type="button"
							aria-label="Previous capability"
							disabled={activeIndex === 0}
							onClick={() => activateCase(activeIndex - 1)}
						>
							<span aria-hidden="true">←</span>
						</button>
						<span class="product-case-mobile-nav-label">
							<small>{String(activeIndex + 1).padStart(2, "0")}</small>
							{cases[activeIndex]?.tab}
						</span>
						<button
							type="button"
							aria-label="Next capability"
							disabled={activeIndex === cases.length - 1}
							onClick={() => activateCase(activeIndex + 1)}
						>
							<span aria-hidden="true">→</span>
						</button>
					</fieldset>
					<div
						class="product-case-tabs"
						role="tablist"
						aria-label={data.eyebrow}
					>
						{cases.map((item, index) => (
							<button
								aria-controls={`${id}-case-${index}`}
								aria-selected={activeIndex === index}
								class={`product-case-tab${activeIndex === index ? " is-active" : ""}`}
								key={item.tab}
								onClick={() => activateCase(index)}
								role="tab"
								type="button"
							>
								<i aria-hidden="true" />
								<span>
									{String(index + 1).padStart(2, "0")}. {item.tab}
								</span>
							</button>
						))}
					</div>
					<div class="product-case-panels">
						{cases.map((item, index) => (
							<article
								aria-hidden={activeIndex !== index}
								class={`product-case-panel${activeIndex === index ? " is-active" : ""}${item.image || item.diagram ? "" : " product-case-panel--no-visual"}`}
								id={`${id}-case-${index}`}
								key={item.title}
								role="tabpanel"
							>
								<div class="product-case-copy">
									<p>{item.eyebrow}</p>
									<h2>{item.title}</h2>
									<div class="product-case-description">
										{descriptionParagraphs(item.description).map(
											(paragraph) => (
												<p
													class={paragraph.isOutcome ? "is-outcome" : undefined}
													key={paragraph.text}
												>
													{paragraph.text}
												</p>
											),
										)}
									</div>
								</div>
								{(item.diagram || item.image) && (
									<div class="product-case-diagram">
										{item.image ? (
											<VectorImage data={{ image: item.image }} />
										) : item.diagram ? (
											<V2Diagram
												className="v2-ink product-case-v2"
												config={resolveDiagram(diagrams, item.diagram)}
												texts={diagramTexts?.[item.diagram]}
											/>
										) : null}
									</div>
								)}
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

function descriptionParagraphs(
	description?: string,
): Array<{ text: string; isOutcome: boolean }> {
	return (description ?? "")
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => {
			const outcome = /^\*\*(.+)\*\*$/.exec(paragraph);
			return { text: outcome?.[1] ?? paragraph, isOutcome: Boolean(outcome) };
		});
}

function resolveDiagram(
	diagrams: DiagramsData | undefined,
	name: string,
): V2DiagramConfig {
	const diagram = diagrams?.[name];
	if (!diagram) {
		throw new Error(`[landing] unknown diagram scene: ${name}`);
	}
	return diagram;
}
