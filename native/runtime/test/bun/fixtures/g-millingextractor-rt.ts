import { stubClient } from "./rt-stub";
export const createMillingExtractorServiceRtClient = stubClient("millingextractor", {
	extract: ["input"],
});
