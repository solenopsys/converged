import { stubClient } from "./rt-stub";
export const createPrintExtractorServiceRtClient = stubClient("printextractor", {
	extractFromSlice: ["input"],
	extractFromGcode: ["input"],
	estimateGeometry: ["input"],
});
