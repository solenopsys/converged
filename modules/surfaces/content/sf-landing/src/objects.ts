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
			labelKey: "operations.open.label",
			description: "Open the public landing page.",
			descriptionKey: "operations.open.description",
			access: "public",
			invoke: () => presentLanding(),
		},
	],
});
