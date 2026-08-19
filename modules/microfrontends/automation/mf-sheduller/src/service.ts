import { createFrontNrpcClientConfig } from "signal-channel";
import { createShedullerServiceClient } from "g-sheduller";

export default createShedullerServiceClient(createFrontNrpcClientConfig());
