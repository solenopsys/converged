import { defineSurface } from "front-core/object-runtime";
import { presentLanding } from "./functions";

export default defineSurface({
	id: "sf-landing",
	label: "Landing",
	purpose: "The public landing page",
	types: [],
	views: [],
	operations: [
		{
			id: "landing.open",
			operator: "open",
			label: "Open landing page",
			access: "public",
			invoke: () => presentLanding(),
		},
	],
});
