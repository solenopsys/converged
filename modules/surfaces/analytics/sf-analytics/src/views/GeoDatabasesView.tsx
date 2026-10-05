import { EntityListView } from "front-core";
import { setRef, type DomainRef } from "front-core/object-runtime";
import { geoLiteStore } from "../domain-geolite";
import { geoLiteColumns } from "../functions/geolite-columns";

export function GeoDatabasesView({ reference }: { reference?: DomainRef }) {
	return (
		<EntityListView
			reference={reference ?? setRef("analytics.geodatabase", { kind: "query" })}
			tableId="analytics-geolite-databases"
			store={geoLiteStore}
			columns={geoLiteColumns}
		title="IP databases"
			selectable={false}
		/>
	);
}
