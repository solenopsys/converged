import { useEffect, useRef, useState } from "preact/hooks";
import { initDiagramRuntime } from "../diagram/client";
import { V2Diagram } from "../diagram/components";
import type { V2DiagramData } from "../diagram/types";



export type ProductCase = {
	eyebrow: string;

	tab: string;
	title: string;

	markdown?: string;
	description?: string;

	diagram: string;
};

export type ProductCasesData = {
	eyebrow: string;
	cases: ProductCase[];
};

export type DiagramsData = Record<string, V2DiagramData>;

export function ProductCasesBlock({
	id,
	data,
	diagrams,
}: {
	id: string;
	data: ProductCasesData;
	diagrams: DiagramsData;
}) {
	const [activeIndex, setActiveIndex] = useState(0);
	const sectionRef = useRef<HTMLElement>(null);
	const activeIndexRef = useRef(0);
	const scrollLockUntilRef = useRef(0);
	const cases = data.cases;
	const activateCase = (index: number) => {
		activeIndexRef.current = index;
		setActiveIndex(index);
	};

	useEffect(() => {
		initDiagramRuntime();
	}, []);

	useEffect(() => {
		const hosts = [...(sectionRef.current?.querySelectorAll<HTMLElement>(".product-case-diagram") ?? [])];
		const updateScale = () => {
			const maximumScale = window.matchMedia("(max-width: 900px)").matches ? 0.31 : 0.62;
			hosts.forEach((host) => {
				const stage = host.querySelector<HTMLElement>(".product-case-v2.v2-stage");
				if (!stage || !host.clientWidth || !host.clientHeight) return;

				const scale = Math.min(maximumScale, host.clientWidth / stage.offsetWidth, host.clientHeight / stage.offsetHeight);
				host.style.setProperty("--product-case-diagram-scale", String(scale));
			});
		};

		const observer = new ResizeObserver(updateScale);
		hosts.forEach((host) => observer.observe(host));
		window.addEventListener("resize", updateScale);
		updateScale();

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateScale);
		};
	}, []);

	useEffect(() => {
		const handleWheel = (event: WheelEvent) => {
			if (event.ctrlKey || event.deltaY === 0) return;
			const section = sectionRef.current;
			if (!section) return;

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

		window.addEventListener("wheel", handleWheel, { passive: false });
		return () => window.removeEventListener("wheel", handleWheel);
	}, [cases.length]);

	return (
		<section class="product-case-scroll" id={id} aria-label={data.eyebrow} ref={sectionRef}>
			<div class="product-case-stage">
				<div class="product-case-topline">
					<span>{data.eyebrow}</span>
					<span>
						{String(activeIndex + 1).padStart(2, "0")} /{" "}
						{String(cases.length).padStart(2, "0")}
					</span>
				</div>
				<div class="product-case-layout">
					<div class="product-case-tabs" role="tablist" aria-label={data.eyebrow}>
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
								class={`product-case-panel${activeIndex === index ? " is-active" : ""}`}
								id={`${id}-case-${index}`}
								key={item.title}
								role="tabpanel"
							>
								<div class="product-case-copy">
									<p>{item.eyebrow}</p>
									<h2>{item.title}</h2>
									<div class="product-case-description">
										{descriptionParagraphs(item.description).map((paragraph) => (
											<p class={paragraph.isOutcome ? "is-outcome" : undefined} key={paragraph.text}>
												{paragraph.text}
											</p>
										))}
									</div>
								</div>
								<div class="product-case-diagram">
									<V2Diagram
										className="v2-ink product-case-v2"
										diagram={resolveDiagram(diagrams, item.diagram)}
									/>
								</div>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

function descriptionParagraphs(description?: string): Array<{ text: string; isOutcome: boolean }> {
	return (description ?? "")
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => {
			const outcome = /^\*\*(.+)\*\*$/.exec(paragraph);
			return { text: outcome?.[1] ?? paragraph, isOutcome: Boolean(outcome) };
		});
}


function resolveDiagram(diagrams: DiagramsData, name: string): V2DiagramData {
	const diagram = diagrams?.[name];
	if (!diagram) {
		throw new Error(`[landing] unknown diagram scene: ${name}`);
	}
	return diagram;
}
