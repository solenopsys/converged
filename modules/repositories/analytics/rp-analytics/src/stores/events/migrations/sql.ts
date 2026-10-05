import AddContentFields from "./addContentFieldsSql";
import AddGeoFields from "./addGeoFieldsSql";
import AddGeoLocationFields from "./addGeoLocationFieldsSql";
import AddSessionIndex from "./addSessionIndexSql";
import CreateAnalyticsEvents from "./createAnalyticsEventsSql";

export default [
	CreateAnalyticsEvents,
	AddGeoFields,
	AddContentFields,
	AddGeoLocationFields,
	AddSessionIndex,
];
