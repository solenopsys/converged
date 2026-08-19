import React from "preact/compat";
import { OrdersDashboardView } from "./views/OrdersDashboardView";

function Panel({ bus }: { bus: any }) {
	return <OrdersDashboardView bus={bus} />;
}

export default Panel;
