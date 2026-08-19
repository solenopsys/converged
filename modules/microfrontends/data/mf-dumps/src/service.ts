import { createFrontNrpcClientConfig } from "signal-channel";
import { createDumpsServiceClient } from "g-dumps";

export default createDumpsServiceClient(createFrontNrpcClientConfig());
