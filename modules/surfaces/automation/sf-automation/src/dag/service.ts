import { createDagServiceClient } from "g-dag";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createDagServiceClient(createFrontNrpcClientConfig());
