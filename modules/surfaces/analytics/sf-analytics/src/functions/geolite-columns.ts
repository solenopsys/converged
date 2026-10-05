import { getTableColumns } from "front-core";

export const geoLiteColumns = getTableColumns([
	{ id: "index", title: "#", type: "number", width: 72 },
	{ id: "network", title: "Network", type: "text", minWidth: 180 },
	{ id: "country_code", title: "Code", type: "text", width: 90 },
	{ id: "country_name", title: "Country", type: "text", minWidth: 170 },
	{ id: "region_name", title: "Region", type: "text", minWidth: 150 },
	{ id: "city_name", title: "City", type: "text", minWidth: 150 },
	{ id: "geoname_id", title: "GeoName ID", type: "number", width: 130 },
	{ id: "asn", title: "ASN", type: "number", width: 100 },
	{ id: "organization", title: "Provider", type: "text", minWidth: 220 },
]);
