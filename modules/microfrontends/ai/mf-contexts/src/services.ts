import { createContextsServiceClient } from "g-contexts";
import { createFrontNrpcClientConfig } from "signal-channel";

export const contextsClient = createContextsServiceClient(
	createFrontNrpcClientConfig(),
);
