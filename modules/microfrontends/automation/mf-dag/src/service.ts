import { createFrontNrpcClientConfig } from "signal-channel";
import { createDagServiceClient } from "g-dag";

export default createDagServiceClient(createFrontNrpcClientConfig());
