import { createShedullerServiceClient } from "g-sheduller";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createShedullerServiceClient(createFrontNrpcClientConfig());
