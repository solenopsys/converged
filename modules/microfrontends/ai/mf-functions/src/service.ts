import { createFunctionsServiceClient } from "g-functions";
import { createFrontNrpcClientConfig } from "signal-channel";

export const functionsClient = createFunctionsServiceClient(createFrontNrpcClientConfig());
