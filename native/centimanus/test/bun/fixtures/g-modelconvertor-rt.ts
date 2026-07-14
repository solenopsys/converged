import { stubClient } from "./rt-stub";
export const createModelConvertorServiceRtClient = stubClient("modelconvertor", {
	convert: ["input"],
});
