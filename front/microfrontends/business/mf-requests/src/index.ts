import { BasePlugin } from "front-core";
import ACTIONS from "./functions";
import { MENU } from "./menu";
import Panel from "./Panel";

export const ID = "requests-mf";
export const GROUP = {
	id: "sales",
	title: "Sales",
	iconName: "IconBriefcase",
};
export { MENU };

export default new BasePlugin(ID, ACTIONS);
export {
	ManufacturingRequestPage,
	RequestDetailView,
} from "./views/RequestDetailView";
export { Panel };
