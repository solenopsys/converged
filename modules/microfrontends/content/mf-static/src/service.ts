import { createFrontNrpcClientConfig } from "signal-channel";
import { createStaticServiceClient } from "g-static";

export default createStaticServiceClient(createFrontNrpcClientConfig());
