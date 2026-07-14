import { metadata } from "g-calls";
import { createHttpBackend } from "nrpc";
import { CallsServiceImpl } from "./service";

const plugin = (config: any) => {
	return createHttpBackend({
		metadata,
		serviceImpl: new CallsServiceImpl(config),
	})(config);
};

export default plugin;
