import { HeaderPanelLayout, RefreshCw } from "front-core";
import { useEffect } from "preact/compat";
import { tr } from "../config";
import {
	ConversionIndicator,
	OrdersIndicator,
	PrintingIndicator,
	RequestsIndicator,
	UtilizationIndicator,
} from "../dashboard-widgets";
import { ordersViewMounted, refreshOrdersClicked } from "../domain-orders";

// The orders area's own screen: how much work there is, not what the work is.
//
// It used to carry its own table and its own status tabs, which is the thing
// this surface now has a projection for — `orders.order.table` with a preset per
// status group. What is left is the readout, assembled from the same statistic
// components the pinnable dashboard mounts, so a tile cannot say one thing here
// and another there.

export const OrdersDashboardView = () => {
	useEffect(() => {
		ordersViewMounted();
	}, []);

	const headerConfig = {
		title: tr("menu.orders"),
		actions: [
			{
				id: "refresh",
				label: tr("actions.refresh"),
				icon: RefreshCw,
				event: refreshOrdersClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig} contentClassName="p-4">
			<div className="flex h-full min-h-0 flex-col gap-4 overflow-auto">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<RequestsIndicator />
					<OrdersIndicator />
					<PrintingIndicator />
					<UtilizationIndicator />
				</div>
				<div className="shrink-0">
					<ConversionIndicator />
				</div>
				<p className="text-sm text-muted-foreground">{tr("overview.hint")}</p>
			</div>
		</HeaderPanelLayout>
	);
};
