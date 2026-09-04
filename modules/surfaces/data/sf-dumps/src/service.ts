import { createDumpsServiceClient } from "g-dumps";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createDumpsServiceClient(createFrontNrpcClientConfig());
