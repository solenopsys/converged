import { stubClient } from "./rt-stub";
export const createFilesServiceRtClient = stubClient("files", {
	materialize: ["fileId"],
	detectType: ["input"],
	unzip: ["input"],
	persist: ["input"],
	saveCollection: ["collection"],
});
