import {
	geoArea,
	geoBounds,
	geoCentroid,
	geoEquirectangular,
	geoMercator,
	geoPath,
} from "d3";




export type GeoMapGeometry = {
	type: string;
	coordinates?: unknown;
	geometries?: GeoMapGeometry[];
};

export type GeoMapFeature = {
	type: "Feature";
	id?: string | number;
	properties?: Record<string, unknown> | null;
	geometry: GeoMapGeometry | null;
};

export type GeoMapSource =
	| { type: "FeatureCollection"; features: GeoMapFeature[] }
	| GeoMapFeature
	| GeoMapGeometry;


export type GeoMapPlace = {
	id?: string;
	name?: string;
	latitude: number;
	longitude: number;
	value?: number;
};


export type GeoMapFrame = [[number, number], [number, number]];

export type GeoMapArea = {
	id: string;
	name: string;

	path: string;
};

export type GeoMapPoint = {
	id: string;
	name: string;
	x: number;
	y: number;
	radius: number;
	value: number;
};

export type GeoMapLayout = {
	width: number;
	height: number;

	areas: GeoMapArea[];
	points: GeoMapPoint[];

	subdivided: boolean;
};

export type GeoMapOptions = {
	width?: number;
	height?: number;
	padding?: number;

	frame?: GeoMapFrame;

	precision?: number;

	radius?: [number, number];

	maxPoints?: number;
};

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 420;
const DEFAULT_PADDING = 8;
const DEFAULT_PRECISION = 1;
const DEFAULT_RADIUS: [number, number] = [1.5, 10];
const DEFAULT_MAX_POINTS = 500;

const MERCATOR_LIMIT = 80;

const DENSIFY_STEP_DEGREES = 1;


function featuresOf(source: GeoMapSource | null | undefined): GeoMapFeature[] {
	if (!source || typeof source !== "object") return [];
	const collection = source as { type?: string; features?: unknown };
	if (collection.type === "FeatureCollection") {
		const list = Array.isArray(collection.features)
			? (collection.features as GeoMapFeature[])
			: [];
		return list.filter((feature) => Boolean(feature?.geometry));
	}
	if (collection.type === "Feature") {
		const feature = source as GeoMapFeature;
		return feature.geometry ? [feature] : [];
	}
	if (typeof collection.type === "string") {
		return [
			{ type: "Feature", properties: {}, geometry: source as GeoMapGeometry },
		];
	}
	return [];
}


function normalized(geometry: GeoMapGeometry): GeoMapGeometry {
	if (geometry.type === "GeometryCollection") {
		return {
			...geometry,
			geometries: (geometry.geometries ?? []).map(normalized),
		};
	}
	if (!geometry.coordinates) return geometry;

	const walk = (value: unknown): unknown => {
		if (!Array.isArray(value)) return value;
		if (typeof value[0] === "number") {
			const [longitude, ...rest] = value as number[];
			return [((((longitude + 180) % 360) + 360) % 360) - 180, ...rest];
		}
		return value.map(walk);
	};

	return { ...geometry, coordinates: walk(geometry.coordinates) };
}


function densified(geometry: GeoMapGeometry): GeoMapGeometry {
	if (geometry.type === "GeometryCollection") {
		return {
			...geometry,
			geometries: (geometry.geometries ?? []).map(densified),
		};
	}
	if (!geometry.coordinates || geometry.type === "Point") return geometry;


	const shortest = (from: number, to: number) =>
		((to - from + 540) % 360) - 180;

	const line = (points: number[][]): number[][] => {
		const dense: number[][] = [];
		points.forEach((point, index) => {
			dense.push(point);
			const next = points[index + 1];
			if (!next) return;
			const deltaLongitude = shortest(point[0], next[0]);
			const deltaLatitude = next[1] - point[1];
			const steps = Math.floor(
				Math.max(Math.abs(deltaLongitude), Math.abs(deltaLatitude)) /
					DENSIFY_STEP_DEGREES,
			);
			for (let step = 1; step < steps; step += 1) {
				const ratio = step / steps;
				dense.push([
					point[0] + deltaLongitude * ratio,
					point[1] + deltaLatitude * ratio,
				]);
			}
		});
		return dense;
	};

	const walk = (value: unknown, depth: number): unknown => {
		if (!Array.isArray(value)) return value;
		if (depth === 0) return line(value as number[][]);
		return value.map((item) => walk(item, depth - 1));
	};

	const depth =
		geometry.type === "MultiPolygon" ? 2 : geometry.type === "Polygon" ? 1 : 0;
	return { ...geometry, coordinates: walk(geometry.coordinates, depth) };
}


function rewound(geometry: GeoMapGeometry): GeoMapGeometry {
	if (geometry.type === "GeometryCollection") {
		return {
			...geometry,
			geometries: (geometry.geometries ?? []).map(rewound),
		};
	}

	const reverse = (rings: number[][][]) =>
		geoArea({ type: "Polygon", coordinates: rings } as never) > 2 * Math.PI
			? rings.map((ring) => [...ring].reverse())
			: rings;

	if (geometry.type === "Polygon") {
		return {
			...geometry,
			coordinates: reverse(geometry.coordinates as number[][][]),
		};
	}
	if (geometry.type === "MultiPolygon") {
		return {
			...geometry,
			coordinates: (geometry.coordinates as number[][][][]).map(reverse),
		};
	}
	return geometry;
}


function overlaps(
	[[west, south], [east, north]]: GeoMapFrame,
	[[frameWest, frameSouth], [frameEast, frameNorth]]: GeoMapFrame,
): boolean {
	if (north < frameSouth || south > frameNorth) return false;
	const spans = (from: number, to: number): Array<[number, number]> =>
		to >= from
			? [[from, to]]
			: [
					[from, 180],
					[-180, to],
				];
	return spans(west, east).some(([left, right]) =>
		spans(frameWest, frameEast).some(
			([frameLeft, frameRight]) => left <= frameRight && frameLeft <= right,
		),
	);
}


function areaName(feature: GeoMapFeature, index: number): string {
	const properties = (feature.properties ?? {}) as Record<string, unknown>;
	for (const key of ["name", "NAME_1", "NAME", "shapeName"]) {
		const value = properties[key];
		if (typeof value === "string" && value.trim().length > 0) return value;
	}
	return `area-${index + 1}`;
}

function areaId(feature: GeoMapFeature, index: number): string {
	if (typeof feature.id === "string" || typeof feature.id === "number") {
		return String(feature.id);
	}
	return `${areaName(feature, index)}-${index}`;
}


function pathSink(precision: number) {
	const factor = 10 ** precision;
	const round = (value: number) => Math.round(value * factor) / factor;
	const parts: string[] = [];
	let lastX = Number.NaN;
	let lastY = Number.NaN;

	return {
		moveTo(x: number, y: number) {
			lastX = round(x);
			lastY = round(y);
			parts.push(`M${lastX},${lastY}`);
		},
		lineTo(x: number, y: number) {
			const nextX = round(x);
			const nextY = round(y);
			if (nextX === lastX && nextY === lastY) return;
			lastX = nextX;
			lastY = nextY;
			parts.push(`L${nextX},${nextY}`);
		},
		arc(x: number, y: number, radius: number) {
			const cx = round(x);
			const cy = round(y);
			const r = round(radius);
			parts.push(
				`A${r},${r} 0 1,1 ${round(cx - r)},${cy}A${r},${r} 0 1,1 ${round(cx + r)},${cy}Z`,
			);
			lastX = round(cx + r);
			lastY = cy;
		},
		closePath() {
			parts.push("Z");
		},
		reset() {
			parts.length = 0;
			lastX = Number.NaN;
			lastY = Number.NaN;
		},
		toString() {
			return parts.join("");
		},
	};
}


function frameGeometry([
	[west, south],
	[east, north],
]: GeoMapFrame): GeoMapGeometry {
	return {
		type: "MultiPoint",
		coordinates: [
			[west, south],
			[east, south],
			[east, north],
			[west, north],
		],
	};
}

function projectionFor(
	collection: { type: "FeatureCollection"; features: GeoMapFeature[] },
	options: {
		width: number;
		height: number;
		padding: number;
		frame?: GeoMapFrame;
	},
) {
	const [[west, south], [east, north]] =
		options.frame ?? (geoBounds(collection as never) as GeoMapFrame);
	const polar = Math.max(Math.abs(south), Math.abs(north)) > MERCATOR_LIMIT;
	const projection = polar ? geoEquirectangular() : geoMercator();
	projection.rotate([
		-(options.frame
			? west + (east >= west ? east - west : east + 360 - west) / 2
			: geoCentroid(collection as never)[0]),
		0,
	]);

	const { width, height, padding } = options;
	projection.fitExtent(
		[
			[padding, padding],
			[width - padding, height - padding],
		],
		(options.frame ? frameGeometry(options.frame) : collection) as never,
	);
	projection.clipExtent([
		[-width, -height],
		[2 * width, 2 * height],
	]);

	return projection;
}

function buildPoints(
	projection: ReturnType<typeof geoMercator>,
	places: GeoMapPlace[],
	options: {
		width: number;
		height: number;
		radius: [number, number];
		maxPoints: number;
		precision: number;
	},
): GeoMapPoint[] {
	const { width, height, maxPoints, precision } = options;
	const [minRadius, maxRadius] = options.radius;
	const factor = 10 ** precision;
	const round = (value: number) => Math.round(value * factor) / factor;

	const usable = places.filter(
		(place) =>
			Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude),
	);
	const peak = usable.reduce(
		(acc, place) => Math.max(acc, place.value ?? 0),
		0,
	);

	const points: GeoMapPoint[] = [];
	usable.forEach((place, index) => {
		const projected = projection([place.longitude, place.latitude]);
		if (!projected) return;
		const [x, y] = projected;
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		if (x < 0 || y < 0 || x > width || y > height) return;
		const value = Math.max(0, place.value ?? 0);
		const ratio = peak > 0 ? Math.sqrt(value / peak) : 0;
		points.push({
			id: place.id ?? `${place.name ?? "place"}-${index}`,
			name: place.name ?? "",
			x: round(x),
			y: round(y),
			radius: round(minRadius + ratio * (maxRadius - minRadius)),
			value,
		});
	});

	return points
		.sort((left, right) => right.radius - left.radius)
		.slice(0, maxPoints);
}


export function buildGeoMap(
	source: GeoMapSource | null | undefined,
	places: GeoMapPlace[] = [],
	options: GeoMapOptions = {},
): GeoMapLayout | null {
	const parsed = featuresOf(source);
	if (parsed.length === 0) return null;

	const width = options.width ?? DEFAULT_WIDTH;
	const height = options.height ?? DEFAULT_HEIGHT;
	const padding = options.padding ?? DEFAULT_PADDING;
	const precision = options.precision ?? DEFAULT_PRECISION;

	const rewoundFeatures = parsed.map((feature) => ({
		...feature,
		geometry: feature.geometry
			? rewound(densified(normalized(feature.geometry)))
			: null,
	}));
	const features = options.frame
		? rewoundFeatures.filter((feature) =>
				overlaps(
					geoBounds(feature as never) as GeoMapFrame,
					options.frame as GeoMapFrame,
				),
			)
		: rewoundFeatures;
	if (features.length === 0) return null;

	features.sort(
		(left, right) => geoArea(right as never) - geoArea(left as never),
	);

	const collection = { type: "FeatureCollection", features } as const;

	const projection = projectionFor(collection, {
		width,
		height,
		padding,
		frame: options.frame,
	});

	const sink = pathSink(precision);
	const path = geoPath(projection, sink);
	const areas: GeoMapArea[] = [];
	features.forEach((feature, index) => {
		sink.reset();
		path(feature as never);
		const drawn = sink.toString();
		if (drawn.length === 0) return;
		areas.push({
			id: areaId(feature, index),
			name: areaName(feature, index),
			path: drawn,
		});
	});
	if (areas.length === 0) return null;

	return {
		width,
		height,
		areas,
		points: buildPoints(projection, places, {
			width,
			height,
			radius: options.radius ?? DEFAULT_RADIUS,
			maxPoints: options.maxPoints ?? DEFAULT_MAX_POINTS,
			precision,
		}),
		subdivided: areas.length > 1,
	};
}
