import { ContextObject } from "./context";

export const ID = ContextObject.surface;
export const GROUP = {
	id: "ai",
	title: "AI",
	iconName: "IconBrain",
};
export { objects } from "./objects";

import definition from "./objects";

export default definition;
