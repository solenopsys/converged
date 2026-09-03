import { createStaticServiceClient } from "g-static";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createStaticServiceClient(createFrontNrpcClientConfig());
