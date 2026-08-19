import { createFrontNrpcClientConfig } from "signal-channel";
import { createClassifierServiceClient } from "g-classifier";

export default createClassifierServiceClient(createFrontNrpcClientConfig());
