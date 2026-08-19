import { Fragment } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import Vivus from "vivus";
import { getTheme, subscribeTheme, type Theme } from "../../theme";

export type VectorTool = "brush" | "marker" | "pen" | "pencil";

export type VectorImageSettings = {
	tool?: VectorTool;
	thickness?: number;
	size?: number;
	color?: string;
	colorDark?: string;
};

export type VectorImageAnimation = {
	enabled?: boolean;
	type?: "fade" | "steps" | "sync" | "delayed";
	duration?: number;
	delay?: number;
	steps?: number;
	stepDuration?: number;
	minLength?: number;
	start?: "autostart" | "manual" | "inViewport";
};

export type VectorImageLabel = {
	text?: string;
	subtext?: string;
	strong?: string;
	groups?: string[][];
	className?: string;
	top?: string;
	left?: string;
	right?: string;
	bottom?: string;
	width?: string;
	transform?: string;
};

export type VectorImageData = {
	kicker?: string;
	title?: string;
	description?: string;
	image: {
		src: string;
		alt: string;
		caption?: string;
		settings?: VectorImageSettings;
		labels?: VectorImageLabel[];
	};
};

const DEFAULT_TOOL: VectorTool = "pen";
const DEFAULT_COLOR = "#000000";
const BLUEPRINT_LINE = "#e6f0ff";
const DEFAULT_THICKNESS = 1;

const SVG_NS = "http://www.w3.org/2000/svg";

type Layer = { width: number; color: string | null; opacity: number };

const TOOL_LAYERS: Record<VectorTool, Layer[]> = {
	brush: [
		{ width: 2.75, color: null, opacity: 0.048 },
		{ width: 1.5, color: null, opacity: 0.4 },
	],
	marker: [
		{ width: 3.5, color: "#888888", opacity: 1 },
		{ width: 2.5, color: null, opacity: 1 },
	],
	pen: [{ width: 1.0, color: null, opacity: 1 }],
	pencil: [
		{ width: 1.9, color: "#aaaaaa", opacity: 1 },
		{ width: 1.5, color: null, opacity: 0.75 },
	],
};

function hexRgb(color: string): [number, number, number] {
	const value = color.replace("#", "").trim();
	if (value.length === 3) {
		return [
			parseInt(value[0] + value[0], 16),
			parseInt(value[1] + value[1], 16),
			parseInt(value[2] + value[2], 16),
		];
	}
	return [
		parseInt(value.slice(0, 2), 16),
		parseInt(value.slice(2, 4), 16),
		parseInt(value.slice(4, 6), 16),
	];
}

function mixToward(base: string, target: string, t: number): string {
	const a = hexRgb(base);
	const b = hexRgb(target);
	const channels = a.map((channel, index) =>
		Math.round(channel + (b[index] - channel) * t),
	);
	return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function bandColor(base: string, gray: number, theme: Theme): string {
	// gray: source stroke lightness from 0 (darkest) to 1 (lightest).
	// Light theme: ink mixed toward white — gray pencil lines on paper.
	// Dark theme: blueprint — dark strokes burn brightest, light strokes fall back
	// toward the blue, so the drawing keeps depth instead of glowing flat white.
	const t = Math.pow(gray, 0.7);
	return theme === "dark"
		? mixToward(BLUEPRINT_LINE, "#6e92c9", t)
		: mixToward(base, "#ffffff", t);
}

function lineColor(settings: VectorImageSettings): string {
	return settings.color ?? DEFAULT_COLOR;
}

type StepTarget = { path: SVGPathElement; length: number };

function prepareSteps(svg: SVGSVGElement, minLength: number): StepTarget[] {
	const targets: StepTarget[] = [];
	for (const path of Array.from(svg.querySelectorAll("path"))) {
		const length = path.getTotalLength();
		if (!Number.isFinite(length) || length <= 0 || length < minLength) continue;
		path.style.strokeDasharray = `${length} ${length}`;
		path.style.strokeDashoffset = String(length);
		targets.push({ path, length });
	}
	return targets;
}

function playSteps(
	svg: SVGSVGElement,
	targets: StepTarget[],
	steps: number,
	stepDuration: number,
	onComplete: () => void,
): () => void {
	let timer: number | null = null;
	let frame = 0;
	const total = Math.max(1, steps);
	const stop = () => {
		if (timer !== null) window.clearTimeout(timer);
		timer = null;
	};
	const step = () => {
		frame += 1;
		const progress = Math.min(1, frame / total);
		for (const { path, length } of targets) {
			path.style.strokeDashoffset = String(length * (1 - progress));
		}
		if (progress < 1) {
			timer = window.setTimeout(step, stepDuration);
			return;
		}
		for (const { path } of targets) {
			path.style.strokeDasharray = "";
			path.style.strokeDashoffset = "";
		}
		stop();
		onComplete();
	};
	timer = window.setTimeout(step, 0);
	return stop;
}

type Stroke = { el: SVGPathElement; gray: number };

const GLOW_FILTER_ID = "vector-glow";

function addGlowFilter(svg: SVGSVGElement): void {
	const filter = document.createElementNS(SVG_NS, "filter");
	filter.setAttribute("id", GLOW_FILTER_ID);
	filter.setAttribute("x", "-60%");
	filter.setAttribute("y", "-60%");
	filter.setAttribute("width", "220%");
	filter.setAttribute("height", "220%");

	const flood = document.createElementNS(SVG_NS, "feFlood");
	flood.setAttribute("flood-color", "#8fc1ff");
	flood.setAttribute("flood-opacity", "0.35");
	flood.setAttribute("result", "vector-glow-color");

	const haloBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
	haloBlur.setAttribute("in", "SourceAlpha");
	haloBlur.setAttribute("stdDeviation", "35");
	haloBlur.setAttribute("result", "vector-glow-halo-alpha");

	const halo = document.createElementNS(SVG_NS, "feComposite");
	halo.setAttribute("in", "vector-glow-color");
	halo.setAttribute("in2", "vector-glow-halo-alpha");
	halo.setAttribute("operator", "in");
	halo.setAttribute("result", "vector-glow-halo");

	const coreBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
	coreBlur.setAttribute("in", "SourceAlpha");
	coreBlur.setAttribute("stdDeviation", "15");
	coreBlur.setAttribute("result", "vector-glow-core-alpha");

	const core = document.createElementNS(SVG_NS, "feComposite");
	core.setAttribute("in", "vector-glow-color");
	core.setAttribute("in2", "vector-glow-core-alpha");
	core.setAttribute("operator", "in");
	core.setAttribute("result", "vector-glow-core");

	const merge = document.createElementNS(SVG_NS, "feMerge");
	for (const node of ["vector-glow-halo", "vector-glow-core", "SourceGraphic"]) {
		const mergeNode = document.createElementNS(SVG_NS, "feMergeNode");
		mergeNode.setAttribute("in", node);
		merge.appendChild(mergeNode);
	}

	filter.appendChild(flood);
	filter.appendChild(haloBlur);
	filter.appendChild(halo);
	filter.appendChild(coreBlur);
	filter.appendChild(core);
	filter.appendChild(merge);
	svg.insertBefore(filter, svg.firstChild);
}

function buildSvg(svg: SVGSVGElement, settings: VectorImageSettings, theme: Theme): void {
	const tool = settings.tool ?? DEFAULT_TOOL;
	const thickness = settings.thickness ?? DEFAULT_THICKNESS;
	const color = lineColor(settings);

	const defs = svg.querySelector("defs");
	const strokes: Stroke[] = defs
		? Array.from(defs.querySelectorAll("path")).map((path) => ({
				el: path as SVGPathElement,
				gray: Number(path.getAttribute("data-gray") ?? 0),
		  }))
		: [];

	Array.from(svg.childNodes).forEach((child) => {
		if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === "defs") return;
		svg.removeChild(child);
	});
	svg.removeAttribute("width");
	svg.removeAttribute("height");
	svg.removeAttribute("style");

	const cloneStroke = (stroke: Stroke): SVGPathElement => {
		const clone = stroke.el.cloneNode(true) as SVGPathElement;
		clone.removeAttribute("id");
		return clone;
	};

	for (const layer of TOOL_LAYERS[tool]) {
		const group = document.createElementNS(SVG_NS, "g");
		group.setAttribute("fill", "none");
		group.setAttribute("stroke-width", String(Number(layer.width.toFixed(2)) * thickness));
		group.setAttribute("stroke-opacity", String(layer.opacity));
		group.setAttribute("stroke-linecap", "round");
		group.setAttribute("stroke-linejoin", "round");
		if (theme === "dark") group.setAttribute("filter", `url(#${GLOW_FILTER_ID})`);
		const layerColor = theme === "dark" && layer.color ? "#8fafe0" : layer.color;
		if (layerColor) {
			group.setAttribute("stroke", layerColor);
			for (const stroke of strokes) group.appendChild(cloneStroke(stroke));
		} else {
			const bands = [...new Set(strokes.map((stroke) => stroke.gray))].sort(
				(a, b) => a - b,
			);
			for (const gray of bands) {
				const band = document.createElementNS(SVG_NS, "g");
				band.setAttribute("stroke", bandColor(color, gray, theme));
				if (theme === "dark") band.setAttribute("stroke-opacity", "0.88");
				for (const stroke of strokes) {
					if (stroke.gray === gray) band.appendChild(cloneStroke(stroke));
				}
				group.appendChild(band);
			}
		}
		svg.appendChild(group);
	}
	if (theme === "dark") addGlowFilter(svg);
	defs?.remove();
	svg.setAttribute("class", "vector-image-svg");
}

export function VectorImage({
	data,
	className,
	imageClassName,
	loading = "lazy",
	animation = true,
	onComplete,
}: {
	data: VectorImageData;
	className?: string;
	imageClassName?: string;
	loading?: "eager" | "lazy";
	animation?: VectorImageAnimation | boolean;
	onComplete?: () => void;
}) {
	const frameRef = useRef<HTMLDivElement>(null);
	const vivusRef = useRef<Vivus | null>(null);
	const stopStepsRef = useRef<(() => void) | null>(null);
	const stepTargetsRef = useRef<StepTarget[]>([]);
	const animatedRef = useRef(false);
	const observerRef = useRef<IntersectionObserver | null>(null);
	const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
	const [svgViewBox, setSvgViewBox] = useState<string | undefined>(undefined);
	const [failed, setFailed] = useState(false);
	const [drawn, setDrawn] = useState(false);

	const animationConfig: VectorImageAnimation =
		typeof animation === "object" ? animation : { enabled: Boolean(animation) };
	const animationEnabled = animationConfig.enabled ?? true;
	const animationType = animationConfig.type ?? "steps";
	const animationDuration = animationConfig.duration ?? 90;
	const animationDelay = animationConfig.delay ?? Math.round(animationDuration / 3);
	const animationStart = animationConfig.start ?? "inViewport";
	const animationSteps = animationConfig.steps ?? 24;
	const animationStepDuration = animationConfig.stepDuration ?? 30;
	const animationMinLength = animationConfig.minLength ?? 24;

	const stopAnimation = () => {
		stopStepsRef.current?.();
		stopStepsRef.current = null;
		vivusRef.current?.destroy();
		vivusRef.current = null;
		observerRef.current?.disconnect();
		observerRef.current = null;
	};

	const startAnimation = (svg: SVGSVGElement) => {
		svg.classList.remove("vector-image-waiting");
		if (animationType === "fade") {
			svg.setAttribute("class", "vector-image-svg vector-image-anim-fade");
			svg.addEventListener(
				"animationend",
				() => {
					if (animatedRef.current) return;
					animatedRef.current = true;
					setDrawn(true);
					onComplete?.();
				},
				{ once: true },
			);
		} else if (animationType === "steps") {
			stepTargetsRef.current = prepareSteps(svg, animationMinLength);
			stopStepsRef.current = playSteps(
				svg,
				stepTargetsRef.current,
				animationSteps,
				animationStepDuration,
				() => {
					if (animatedRef.current) return;
					animatedRef.current = true;
					setDrawn(true);
					onComplete?.();
				},
			);
		} else {
			vivusRef.current = new Vivus(svg, {
				type: animationType,
				duration: animationDuration,
				delay: animationDelay,
				dashGap: 0,
				start: animationStart,
				selfDestroy: true,
				callback: () => {
					if (animatedRef.current) return;
					animatedRef.current = true;
					setDrawn(true);
					onComplete?.();
				},
			});
		}
	};

	useEffect(() => {
		let cancelled = false;
		let disposeTheme: (() => void) | undefined;
		const settings = data.image.settings ?? {};
		const apply = async (theme: Theme) => {
			const frame = frameRef.current;
			if (!frame || cancelled) return;
			try {
				const response = await fetch(data.image.src, { cache: "force-cache" });
				if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
				const text = await response.text();
				if (cancelled || !frame.isConnected) return;
				const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
				const svg = parsed.documentElement as unknown as SVGSVGElement;
				if (svg.tagName.toLowerCase() !== "svg") {
					// Растровый src (png/jpg) — не векторизуем: показываем <img> и лейблы сразу.
					setFailed(true);
					setDrawn(true);
					return;
				}
				stopAnimation();
				buildSvg(svg, settings, theme);
				setSvgViewBox(svg.getAttribute("viewBox") ?? undefined);
				setSvgMarkup(svg.innerHTML);
			} catch {
				setFailed(true);
				setDrawn(true);
			}
		};

		void apply(getTheme());
		disposeTheme = subscribeTheme((theme) => void apply(theme));
		return () => {
			cancelled = true;
			stopAnimation();
			disposeTheme?.();
		};
	}, [
		data.image.src,
		data.image.settings,
		animationEnabled,
		animationType,
		animationDuration,
		animationDelay,
		animationStart,
		animationSteps,
		animationStepDuration,
		animationMinLength,
	]);

	useEffect(() => {
		if (!svgMarkup) return;
		const frame = frameRef.current;
		if (!frame) return;
		const svg = frame.querySelector("svg");
		if (!svg) return;
		if (animationEnabled && !animatedRef.current) {
			if (typeof IntersectionObserver === "undefined") {
				startAnimation(svg);
				return;
			}
			observerRef.current = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					observerRef.current?.disconnect();
					observerRef.current = null;
					const current = frameRef.current?.querySelector("svg");
					if (current) startAnimation(current);
				},
				{ threshold: 0.25 },
			);
			observerRef.current.observe(frame);
		} else {
			setDrawn(true);
		}
		return () => {
			observerRef.current?.disconnect();
			observerRef.current = null;
		};
	}, [
		svgMarkup,
		animationEnabled,
		animationType,
		animationDuration,
		animationDelay,
		animationStart,
		animationSteps,
		animationStepDuration,
		animationMinLength,
	]);

	const wrapperClass = [
		"vector-image",
		drawn ? "vector-image--drawn" : "",
		failed ? "vector-image--fallback" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			class={wrapperClass}
			role="img"
			aria-label={data.image.alt}
		>
			<div
				class="vector-image-frame"
				ref={frameRef}
				data-tool={data.image.settings?.tool ?? DEFAULT_TOOL}
				style={data.image.settings?.size ? { width: `${data.image.settings.size}%` } : undefined}
			>
				{svgMarkup ? (
					<svg
						class={[
							"vector-image-svg",
							animationEnabled && !drawn ? "vector-image-waiting" : "",
						]
							.filter(Boolean)
							.join(" ")}
						viewBox={svgViewBox}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: built from trusted SVG markup
						dangerouslySetInnerHTML={{ __html: svgMarkup }}
					/>
				) : (
					<img
						class={imageClassName}
						src={data.image.src}
						alt={data.image.alt}
						loading={loading}
					/>
				)}
				{data.image.labels?.map((label, index) => (
					<aside
						class={["vector-image-label", label.className].filter(Boolean).join(" ")}
						// biome-ignore lint/suspicious/noArrayIndexKey: label order is its identity
						key={index}
						style={{
							top: label.top,
							left: label.left,
							right: label.right,
							bottom: label.bottom,
							width: label.width,
							transform: label.transform,
						}}
					>
						{label.strong ? <strong>{label.strong}</strong> : null}
						{label.groups
							? label.groups.map((group, groupIndex) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: group order is its identity
									<Fragment key={groupIndex}>
										{groupIndex > 0 ? <hr /> : null}
										{group.map((line) => (
											<span key={line}>{line}</span>
										))}
									</Fragment>
							  ))
							: null}
						{label.groups ? null : label.text ? <span>{label.text}</span> : null}
						{label.groups ? null : label.subtext ? <small>{label.subtext}</small> : null}
					</aside>
				))}
			</div>
		</div>
	);
}
