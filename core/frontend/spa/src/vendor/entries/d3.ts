// The import-map exposes this file as the small shared `d3` runtime. Keep the
// surface explicit: importing the umbrella `d3` package would pull every D3
// family into the vendor layer even though the UI uses only these functions.
export { extent, max, min } from "d3-array";
export {
	geoArea,
	geoBounds,
	geoCentroid,
	geoEquirectangular,
	geoMercator,
	geoPath,
} from "d3-geo";
export { scaleBand, scaleLinear, scalePoint, scaleTime } from "d3-scale";
export { arc, curveLinear, curveMonotoneX, line, pie } from "d3-shape";
