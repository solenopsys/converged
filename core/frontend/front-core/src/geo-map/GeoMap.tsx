import { useMemo, useState } from "preact/hooks";
import {
	buildGeoMap,
	type GeoMapOptions,
	type GeoMapPlace,
	type GeoMapPoint,
	type GeoMapSource,
} from "./engine";



export type GeoMapTheme = {

	land: string;
	landBorder: string;

	areas: readonly string[];
	areaBorder: string;
	borderWidth: number;
	point: string;
	pointOpacity: number;
};


export const GEO_MAP_LIGHT_THEME: GeoMapTheme = {
	land: "#e4ead5",
	landBorder: "#8fa377",
	areas: [
		"#eef2e4",
		"#e3ead3",
		"#d8e2c2",
		"#ccdab1",
		"#c1d2a0",
		"#b5ca8f",
		"#aac27e",
		"#9eba6d",
	],
	areaBorder: "#fbfbf8",
	borderWidth: 0.8,
	point: "#10240f",
	pointOpacity: 0.55,
};


export const GEO_MAP_DARK_THEME: GeoMapTheme = {
	land: "#1e3a5f",
	landBorder: "#3b82f6",
	areas: [
		"#14304f",
		"#1b3d63",
		"#224a78",
		"#29578d",
		"#3064a2",
		"#3771b7",
		"#3e7ecc",
		"#458be1",
	],
	areaBorder: "#0b1220",
	borderWidth: 0.9,
	point: "#8ec5ff",
	pointOpacity: 0.75,
};


const PALETTE_STEPS = 8;

const VARIABLE = {
	land: "--geo-map-land",
	landBorder: "--geo-map-land-border",
	areaBorder: "--geo-map-area-border",
	borderWidth: "--geo-map-border-width",
	point: "--geo-map-point",
	pointOpacity: "--geo-map-point-opacity",
	area: (index: number) => `--geo-map-area-${index}`,
} as const;


function themeRules(theme: GeoMapTheme): string {
	const areas = Array.from({ length: PALETTE_STEPS }, (_, index) => {
		const color = theme.areas[index % theme.areas.length];
		return `.geo-map__area--${index}{fill:var(${VARIABLE.area(index)},${color})}`;
	}).join("");

	return [
		`.geo-map__land{fill:var(${VARIABLE.land},${theme.land});stroke:var(${VARIABLE.landBorder},${theme.landBorder})}`,
		`.geo-map__area{stroke:var(${VARIABLE.areaBorder},${theme.areaBorder})}`,
		`.geo-map__land,.geo-map__area{stroke-width:var(${VARIABLE.borderWidth},${theme.borderWidth})}`,
		areas,
		`.geo-map__point{fill:var(${VARIABLE.point},${theme.point});fill-opacity:var(${VARIABLE.pointOpacity},${theme.pointOpacity});stroke:var(${VARIABLE.areaBorder},${theme.areaBorder});stroke-width:.5}`,
	].join("");
}

const GEO_MAP_STYLE = `${themeRules(GEO_MAP_LIGHT_THEME)}@media (prefers-color-scheme:dark){${themeRules(GEO_MAP_DARK_THEME)}}`;


function themeVariables(theme: GeoMapTheme): Record<string, string> {
	const variables: Record<string, string> = {
		[VARIABLE.land]: theme.land,
		[VARIABLE.landBorder]: theme.landBorder,
		[VARIABLE.areaBorder]: theme.areaBorder,
		[VARIABLE.borderWidth]: String(theme.borderWidth),
		[VARIABLE.point]: theme.point,
		[VARIABLE.pointOpacity]: String(theme.pointOpacity),
	};
	for (let index = 0; index < PALETTE_STEPS; index += 1) {
		variables[VARIABLE.area(index)] = theme.areas[index % theme.areas.length];
	}
	return variables;
}

type GeoMapView = { x: number; y: number; width: number; height: number };


const MAX_ZOOM = 40;

export type GeoMapProps = {
	source: GeoMapSource | null | undefined;
	places?: GeoMapPlace[];
	options?: GeoMapOptions;

	theme?: GeoMapTheme;
	className?: string;

	title?: string;

	interactive?: boolean;

	pointLabel?: (point: GeoMapPoint) => string;
};

export function GeoMap({
	source,
	places,
	options,
	theme,
	className,
	title,
	interactive,
	pointLabel,
}: GeoMapProps) {
	const layout = useMemo(
		() => buildGeoMap(source, places, options),
		[source, places, options],
	);
	const [view, setView] = useState<GeoMapView | null>(null);
	const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

	if (!layout) return null;

	const frame: GeoMapView = view ?? {
		x: 0,
		y: 0,
		width: layout.width,
		height: layout.height,
	};

	const clamp = (next: GeoMapView): GeoMapView => {
		const width = Math.min(
			layout.width,
			Math.max(layout.width / MAX_ZOOM, next.width),
		);
		const height = width * (layout.height / layout.width);
		return {
			width,
			height,
			x: Math.min(Math.max(0, next.x), layout.width - width),
			y: Math.min(Math.max(0, next.y), layout.height - height),
		};
	};


	const onWheel = (event: WheelEvent) => {
		event.preventDefault();
		const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const ratioX = (event.clientX - box.left) / box.width;
		const ratioY = (event.clientY - box.top) / box.height;
		const scale = event.deltaY > 0 ? 1.2 : 1 / 1.2;
		const width = frame.width * scale;
		const height = frame.height * scale;
		setView(
			clamp({
				width,
				height,
				x: frame.x + (frame.width - width) * ratioX,
				y: frame.y + (frame.height - height) * ratioY,
			}),
		);
	};

	const onPointerDown = (event: PointerEvent) => {
		(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
		setDrag({ x: event.clientX, y: event.clientY });
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!drag) return;
		const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const scale = frame.width / box.width;
		setView(
			clamp({
				...frame,
				x: frame.x - (event.clientX - drag.x) * scale,
				y: frame.y - (event.clientY - drag.y) * scale,
			}),
		);
		setDrag({ x: event.clientX, y: event.clientY });
	};

	const handlers = interactive
		? {
				onWheel,
				onPointerDown,
				onPointerMove,
				onPointerUp: () => setDrag(null),
				onPointerLeave: () => setDrag(null),
				onDblClick: () => setView(null),
			}
		: {};

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label={title}
			className={className ? `geo-map ${className}` : "geo-map"}
			style={{
				...(theme ? themeVariables(theme) : {}),
				...(interactive
					? { touchAction: "none", cursor: drag ? "grabbing" : "grab" }
					: {}),
			}}
			{...handlers}
		>
			<style>{GEO_MAP_STYLE}</style>
			{title ? <title>{title}</title> : null}
			{layout.areas.map((area, index) => (
				<path
					key={area.id}
					d={area.path}
					className={
						layout.subdivided
							? `geo-map__area geo-map__area--${index % PALETTE_STEPS}`
							: "geo-map__land"
					}
					vector-effect="non-scaling-stroke"
				/>
			))}
			{layout.points.map((point) => (
				<circle
					key={point.id}
					className="geo-map__point"
					cx={point.x}
					cy={point.y}
					r={point.radius}
					vector-effect="non-scaling-stroke"
				>
					<title>{pointLabel ? pointLabel(point) : point.name}</title>
				</circle>
			))}
		</svg>
	);
}
