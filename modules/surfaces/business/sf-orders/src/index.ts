import definition from "./objects";
import "./dashboard-widgets";

export const ID = "orders-sf";
export const GROUP = {
	id: "sales",
	title: "Sales",
	iconName: "IconBriefcase",
};
export default definition;
export { OrdersDashboardView } from "./views/OrdersDashboardView";
